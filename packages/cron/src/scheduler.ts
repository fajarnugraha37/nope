import type {
  AtTriggerOptions,
  CreateSchedulerOptions,
  ExecuteNowOptions,
  ExecuteNowResult,
  JobDefinition,
  JobHandle,
  JobName,
  RunId,
  Scheduler,
  SchedulerEventName,
  SchedulerListener,
  TriggerHandle,
  TriggerOptions,
} from "./api.js";
import { EventBus } from "./events/bus.js";
import { createPlan } from "./planner/plan.js";
import { JobRunner } from "./queue/runner.js";
import { Semaphore } from "./queue/semaphore.js";
import { TokenBucket } from "./queue/rateLimiter.js";
import { createInMemoryStore, InMemoryStore } from "./store/memory.js";
import type { PersistedTrigger, RunRecord, Store } from "./store/interfaces.js";
import { createSystemClock, type Clock } from "./util/clock.js";
import { createCronError } from "./util/errors.js";
import { createLogger, type Logger } from "./util/logger.js";
import { coerceDate } from "./util/parse.js";

const DEFAULT_HEARTBEAT_MS = 30_000;
const DEFAULT_STALLED_MS = 90_000;
const DEFAULT_MISFIRE_TOLERANCE_MS = 60_000;
const MAX_MISFIRE_SKIP = 1_000;

class SchedulerEngine implements Scheduler {
  readonly id: string;
  readonly clock: Clock;
  readonly store: Store;
  readonly logger: Logger;

  private readonly events = new EventBus();
  private readonly jobs = new Map<JobName, JobDefinition>();
  private readonly plans = new Map<string, ReturnType<typeof createPlan>>();
  private readonly runner = new JobRunner();
  private readonly globalSemaphore?: Semaphore;
  private readonly globalRateLimiter?: TokenBucket;
  private readonly jobSemaphores = new Map<JobName, Semaphore>();
  private readonly jobRateLimiters = new Map<JobName, TokenBucket>();
  private readonly runCapacity = new Map<RunId, () => void>();
  private readonly handledRuns = new Set<RunId>();
  private readonly runProgress = new Map<RunId, number>();
  private readonly ready: Promise<void>;
  private readonly activeRuns = new Set<Promise<void>>();
  private readonly heartbeatIntervalMs: number;
  private readonly stalledAfterMs: number;
  private readonly misfireToleranceMs: number;
  private readonly ownerId: string;

  private stopped = false;
  private paused = false;
  private loopScheduled = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private monitorTimer: ReturnType<typeof setInterval> | undefined;
  private stalledCheckInFlight = false;
  private pollIntervalMs = 250;
  private leaseMs = 30_000;

  constructor(options: CreateSchedulerOptions = {}) {
    this.id = options.id ?? "scheduler-" + Math.random().toString(36).slice(2);
    this.ownerId = this.id;
    this.clock = options.clock ?? createSystemClock();
    this.logger = options.logger ?? createLogger({ name: "cron" });
    this.store = options.store ?? new InMemoryStore({ clock: this.clock });
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_MS;
    this.stalledAfterMs = options.stalledAfterMs ?? DEFAULT_STALLED_MS;
    this.misfireToleranceMs = options.misfireToleranceMs ?? DEFAULT_MISFIRE_TOLERANCE_MS;
    this.globalSemaphore = options.maxConcurrentRuns && options.maxConcurrentRuns > 0 ? new Semaphore(options.maxConcurrentRuns) : undefined;
    this.globalRateLimiter = options.globalRateLimit ? new TokenBucket(options.globalRateLimit) : undefined;
    this.ready = this.bootstrap();
  }

  private async bootstrap() {
    await this.store.init();
    await this.hydrateJobs();
    await this.hydrateTriggers();
    this.armTimer();
    this.armStalledMonitor();
  }

  private async hydrateJobs() {
    const jobs = await this.store.listJobs();
    for (const job of jobs) {
      this.jobs.set(job.name, job.definition);
      this.configureJobControls(job.definition);
    }
  }

  private async hydrateTriggers() {
    const triggers = await this.store.listTriggers();
    for (const trigger of triggers) {
      this.ensurePlan(trigger);
    }
  }

  on<T extends SchedulerEventName>(event: T, listener: SchedulerListener<T>): () => void {
    return this.events.on(event, listener);
  }

  async registerJob<TPayload, TResult>(definition: JobDefinition<TPayload, TResult>): Promise<JobHandle> {
    await this.ready;
    if (!definition.handler && !definition.worker) {
      throw createCronError("E_CONFIGURATION", `Job '${definition.name}' must provide a handler or worker`);
    }
    this.jobs.set(definition.name, definition as JobDefinition<unknown, unknown>);
    this.configureJobControls(definition as JobDefinition<unknown, unknown>);
    await this.store.upsertJob({
      name: definition.name,
      definition: definition as JobDefinition<unknown, unknown>,
      paused: false,
      createdAt: this.clock.now(),
      updatedAt: this.clock.now(),
    });
    return {
      name: definition.name,
      pause: () => this.setJobPaused(definition.name, true),
      resume: () => this.setJobPaused(definition.name, false),
      unregister: () => this.unregisterJob(definition.name),
    };
  }

  async schedule(jobName: JobName, options: TriggerOptions): Promise<TriggerHandle> {
    await this.ready;
    const job = this.jobs.get(jobName);
    if (!job) {
      throw createCronError("E_NOT_FOUND", `Job '${jobName}' is not registered`);
    }
    const plan = createPlan(options);
    const now = this.clock.now();
    const nextRunAt = plan.next(now);
    if (!nextRunAt) {
      throw createCronError("E_STATE", "Unable to compute first fire time for trigger");
    }
    const triggerId = options.idempotencyKey ?? this.generateTriggerId(jobName);
    const nextRunId = this.generateRunId(triggerId);
    const record: PersistedTrigger = {
      id: triggerId,
      job: jobName,
      options,
      nextRunAt,
      lastRunAt: undefined,
      failureCount: 0,
      misfirePolicy: options.misfirePolicy ?? "skip",
      priority: options.priority ?? 0,
      paused: false,
      revision: 0,
      metadata: { ...(options.metadata ?? {}), nextRunId },
    };
    await this.store.upsertTrigger(record);
    this.plans.set(triggerId, plan);
    this.events.emit("scheduled", {
      triggerId,
      job: jobName,
      runId: nextRunId,
      scheduledAt: nextRunAt,
      queuedAt: now,
    });
    this.armTimer();
    return this.createTriggerHandle(triggerId);
  }

  async executeNow(jobName: JobName, options: ExecuteNowOptions = {}): Promise<ExecuteNowResult> {
    await this.ready;
    const job = this.jobs.get(jobName);
    if (!job) {
      throw createCronError("E_NOT_FOUND", `Job '${jobName}' is not registered`);
    }
    const now = this.clock.now();
    const immediateOptions: ExecuteNowOptions = options ?? {};
    const { runAt: requestedRunAt, ...overrides } = immediateOptions;
    const resolvedRunAt = requestedRunAt ? coerceDate(requestedRunAt) : now;
    const normalizedRunAt = resolvedRunAt.getTime() < now.getTime() ? now : resolvedRunAt;
    const triggerOptions: TriggerOptions = {
      kind: "at",
      runAt: normalizedRunAt,
      ...(overrides as Omit<AtTriggerOptions, "kind" | "runAt">),
    };
    const plan = createPlan(triggerOptions);
    const nextRunAt = plan.next(now);
    if (!nextRunAt) {
      throw createCronError("E_STATE", "Unable to compute first fire time for executeNow trigger");
    }
    const triggerId = triggerOptions.idempotencyKey ?? this.generateTriggerId(jobName);
    const nextRunId = this.generateRunId(triggerId);
    const record: PersistedTrigger = {
      id: triggerId,
      job: jobName,
      options: triggerOptions,
      nextRunAt,
      lastRunAt: undefined,
      failureCount: 0,
      misfirePolicy: triggerOptions.misfirePolicy ?? "skip",
      priority: triggerOptions.priority ?? 0,
      paused: false,
      revision: 0,
      metadata: { ...(triggerOptions.metadata ?? {}), nextRunId },
    };
    await this.store.upsertTrigger(record);
    this.plans.set(triggerId, plan);
    this.events.emit("scheduled", {
      triggerId,
      job: jobName,
      runId: nextRunId,
      scheduledAt: nextRunAt,
      queuedAt: now,
    });
    await this.processTrigger(record, now);
    return { triggerId, runId: nextRunId };
  }

  async pauseAll(): Promise<void> {
    await this.ready;
    this.paused = true;
    this.events.emit("paused", { scope: "scheduler", at: this.clock.now() });
  }

  async resumeAll(): Promise<void> {
    await this.ready;
    this.paused = false;
    this.events.emit("resumed", { scope: "scheduler", at: this.clock.now() });
    this.armTimer();
  }

  async shutdown(options?: { graceful?: boolean; graceMs?: number }): Promise<void> {
    await this.ready;
    this.stopped = true;
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.stopStalledMonitor();
    if (options?.graceful) {
      const limit = options.graceMs ?? 5_000;
      await Promise.race([
        Promise.allSettled(Array.from(this.activeRuns)),
        new Promise((resolve) => setTimeout(resolve, limit)),
      ]);
    }
    this.events.emit("shutdown", { at: this.clock.now(), graceful: Boolean(options?.graceful) });
  }

  private async setJobPaused(name: JobName, paused: boolean) {
    await this.store.setJobPaused(name, paused);
    const scope = { scope: "job" as const, identifier: name, at: this.clock.now() };
    this.events.emit(paused ? "paused" : "resumed", scope);
  }

  private async unregisterJob(name: JobName) {
    this.jobs.delete(name);
    this.jobSemaphores.delete(name);
    this.jobRateLimiters.delete(name);
    await this.store.removeJob(name);
  }

  private createTriggerHandle(triggerId: string): TriggerHandle {
    return {
      id: triggerId,
      pause: () => this.updateTriggerPaused(triggerId, true),
      resume: () => this.updateTriggerPaused(triggerId, false),
      cancel: () => this.cancelTrigger(triggerId),
    };
  }

  private async updateTriggerPaused(triggerId: string, paused: boolean) {
    const trigger = await this.store.getTrigger(triggerId);
    if (!trigger) {
      return;
    }
    trigger.paused = paused;
    await this.store.upsertTrigger(trigger);
    const payload = { scope: "trigger" as const, identifier: triggerId, at: this.clock.now() };
    this.events.emit(paused ? "paused" : "resumed", payload);
  }

  private async cancelTrigger(triggerId: string) {
    const trigger = await this.store.getTrigger(triggerId);
    if (!trigger) {
      return;
    }
    await this.store.deleteTrigger(triggerId);
    this.plans.delete(triggerId);
    this.events.emit("canceled", {
      triggerId,
      job: trigger.job,
      runId: (trigger.metadata?.nextRunId as string) ?? "",
      reason: "canceled",
    });
  }

  private ensurePlan(trigger: PersistedTrigger) {
    if (this.plans.has(trigger.id)) {
      return this.plans.get(trigger.id)!;
    }
    const plan = createPlan(trigger.options);
    this.plans.set(trigger.id, plan);
    return plan;
  }

  async getRun(runId: RunId): Promise<RunRecord | undefined> {
    await this.ready;
    return this.store.getRun(runId);
  }

  private armTimer() {
    if (this.stopped || this.paused) {
      return;
    }
    if (this.loopScheduled) {
      return;
    }
    this.loopScheduled = true;
    this.timer = setTimeout(() => this.tick(), this.pollIntervalMs);
    if (typeof this.timer === "object" && "unref" in this.timer && typeof (this.timer as any).unref === "function") {
      (this.timer as any).unref();
    }
  }

  private armStalledMonitor() {
    if (this.monitorTimer || this.stopped) {
      return;
    }
    const interval = Math.max(250, Math.min(this.heartbeatIntervalMs, Math.floor(this.stalledAfterMs / 2)));
    this.monitorTimer = setInterval(() => {
      this.checkStalledRuns().catch((error) => this.logger.error("stalled monitor failure", error));
    }, interval);
    if (typeof this.monitorTimer === "object" && "unref" in this.monitorTimer && typeof (this.monitorTimer as any).unref === "function") {
      (this.monitorTimer as any).unref();
    }
  }

  private stopStalledMonitor() {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = undefined;
    }
  }

  private async tick() {
    this.loopScheduled = false;
    if (this.stopped || this.paused) {
      return;
    }
    await this.ready;
    await this.drainDueTriggers();
    this.armTimer();
  }

  private async checkStalledRuns() {
    if (this.stopped || this.stalledCheckInFlight) {
      return;
    }
    this.stalledCheckInFlight = true;
    try {
      const now = this.clock.now();
      const stalled = await this.store.findStalledRuns(this.stalledAfterMs, now);
      for (const run of stalled) {
        await this.handleStalledRun(run);
      }
    } finally {
      this.stalledCheckInFlight = false;
    }
  }

  private async drainDueTriggers() {
    const now = this.clock.now();
    const due = await this.store.listDueTriggers(now, 100);
    for (const trigger of due) {
      if (this.stopped) {
        return;
      }
      await this.processTrigger(trigger, now);
    }
  }

  private async processTrigger(trigger: PersistedTrigger, now: Date) {
    if (!(await this.store.claimTrigger(trigger.id, this.ownerId, this.leaseMs))) {
      return;
    }
    const plan = this.ensurePlan(trigger);
    const job = this.jobs.get(trigger.job);
    if (!job) {
      await this.store.releaseTrigger(trigger.id, this.ownerId);
      this.logger.warn(`Trigger ${trigger.id} references missing job ${trigger.job}`);
      return;
    }
    const scheduledAt = trigger.nextRunAt ?? now;
    const misfireDecision = await this.handleMisfire(trigger, plan, scheduledAt, now);
    if (misfireDecision.skipped) {
      await this.store.releaseTrigger(trigger.id, this.ownerId);
      return;
    }
    const effectiveScheduledAt = misfireDecision.scheduledAt;
    const runId = (trigger.metadata?.nextRunId as string) ?? this.generateRunId(trigger.id);
    const runPromise = this.executeRun(trigger, job, plan, runId, effectiveScheduledAt);
    this.activeRuns.add(runPromise);
    runPromise.finally(() => this.activeRuns.delete(runPromise));
  }

  private async handleStalledRun(run: RunRecord) {
    if (this.handledRuns.has(run.runId)) {
      return;
    }
    const trigger = await this.store.getTrigger(run.triggerId);
    if (!trigger) {
      this.noteHandledRun(run.runId);
      this.releaseRunCapacity(run.runId);
      return;
    }
    const job = this.jobs.get(run.job);
    if (!job) {
      this.noteHandledRun(run.runId);
      this.releaseRunCapacity(run.runId);
      await this.store.releaseTrigger(trigger.id, this.ownerId);
      return;
    }
    const plan = this.ensurePlan(trigger);
    await this.store.recordRunEnd(run.runId, {
      status: "stalled",
      endedAt: this.clock.now(),
    });
    this.events.emit("stalled", {
      runId: run.runId,
      triggerId: run.triggerId,
      job: run.job,
      lastHeartbeatAt: run.heartbeatAt ?? run.startedAt ?? run.scheduledAt,
    });
    this.releaseRunCapacity(run.runId);
    this.noteHandledRun(run.runId);
    trigger.failureCount = (trigger.failureCount ?? 0) + 1;
    trigger.lastRunAt = run.scheduledAt;
    const retryDecision = this.evaluateRetry(job, run.attempt);
    if (retryDecision) {
      const delayMs = retryDecision.delayMs;
      const resumeAt = new Date(this.clock.now().getTime() + delayMs);
      trigger.nextRunAt = resumeAt;
      const nextRunId = this.generateRunId(trigger.id);
      trigger.metadata = {
        ...(trigger.metadata ?? {}),
        nextRunId,
      };
      this.events.emit("retry", {
        runId: nextRunId,
        triggerId: trigger.id,
        job: trigger.job,
        attempt: retryDecision.nextAttempt,
        delayMs,
      });
      this.events.emit("scheduled", {
        triggerId: trigger.id,
        job: trigger.job,
        runId: nextRunId,
        scheduledAt: resumeAt,
        queuedAt: this.clock.now(),
      });
      await this.store.upsertTrigger(trigger);
      await this.store.releaseTrigger(trigger.id, this.ownerId);
      return;
    }
    trigger.failureCount = 0;
    const nextRunAt = plan.next(run.scheduledAt);
    trigger.nextRunAt = nextRunAt ?? undefined;
    const nextRunId = nextRunAt ? this.generateRunId(trigger.id) : undefined;
    trigger.metadata = {
      ...(trigger.metadata ?? {}),
      nextRunId,
    };
    if (nextRunAt && nextRunId) {
      this.events.emit("scheduled", {
        triggerId: trigger.id,
        job: trigger.job,
        runId: nextRunId,
        scheduledAt: nextRunAt,
        queuedAt: this.clock.now(),
      });
      await this.store.upsertTrigger(trigger);
    } else {
      await this.store.deleteTrigger(trigger.id);
      this.plans.delete(trigger.id);
      this.events.emit("drain", { pendingRuns: 0, at: this.clock.now() });
    }
    await this.store.releaseTrigger(trigger.id, this.ownerId);
  }

  private async executeRun(
    trigger: PersistedTrigger,
    job: JobDefinition,
    plan: ReturnType<typeof createPlan>,
    runId: string,
    scheduledAt: Date
  ) {
    const attempt = (trigger.failureCount ?? 0) + 1;
    const releaseCapacity = await this.acquireCapacity(job);
    this.runCapacity.set(runId, releaseCapacity);
    this.runProgress.set(runId, -1);
    await this.store.recordRunStart({
      runId,
      triggerId: trigger.id,
      job: trigger.job,
      scheduledAt,
      attempt,
      status: "running",
    });
    this.events.emit("run", {
      triggerId: trigger.id,
      job: trigger.job,
      runId,
      attempt,
      scheduledAt,
      startedAt: this.clock.now(),
    });

    const touch = async (progress?: number) => {
      if (typeof progress === "number") {
        validateProgressValue(progress);
      }
      await this.store.touchRun(runId, progress);
      if (typeof progress === "number") {
        const lastProgress = this.runProgress.get(runId);
        if (lastProgress !== undefined && progress < lastProgress) {
          throw createCronError("E_STATE", `Progress for run ${runId} cannot decrease (last ${lastProgress}, received ${progress})`);
        }
        this.runProgress.set(runId, progress);
        this.events.emit("progress", {
          runId,
          triggerId: trigger.id,
          job: trigger.job,
          progress,
          at: this.clock.now(),
        });
      }
    };

    const logger = this.logger.child({ runId, triggerId: trigger.id, job: trigger.job });

    let retryDecision: { delayMs: number; nextAttempt: number } | undefined;

    try {
      const timeoutMs = job.worker?.timeoutMs ?? job.timeoutMs;
      const result = await this.runner.run({
        job,
        runId,
        triggerId: trigger.id,
        scheduledAt,
        attempt,
        clock: this.clock,
        logger,
        touch,
        timeoutMs,
      });
      await this.store.recordRunEnd(runId, {
        status: "completed",
        endedAt: this.clock.now(),
        result,
      });
      this.events.emit("completed", {
        triggerId: trigger.id,
        job: trigger.job,
        runId,
        attempt,
        scheduledAt,
        completedAt: this.clock.now(),
        result,
      });
      trigger.failureCount = 0;
    } catch (error) {
      await this.store.recordRunEnd(runId, {
        status: "failed",
        endedAt: this.clock.now(),
        error,
      });
      this.events.emit("error", {
        triggerId: trigger.id,
        job: trigger.job,
        runId,
        attempt,
        error,
      });
      trigger.failureCount = (trigger.failureCount ?? 0) + 1;
      retryDecision = this.evaluateRetry(job, attempt);
      if (!retryDecision) {
        trigger.failureCount = 0;
      }
    } finally {
      this.releaseRunCapacity(runId);
    }

    trigger.lastRunAt = scheduledAt;

    if (this.handledRuns.has(runId)) {
      this.handledRuns.delete(runId);
      await this.store.releaseTrigger(trigger.id, this.ownerId);
      return;
    }

    if (retryDecision) {
      const delayMs = retryDecision.delayMs;
      const resumeAt = new Date(this.clock.now().getTime() + delayMs);
      trigger.nextRunAt = resumeAt;
      const nextRunId = this.generateRunId(trigger.id);
      trigger.metadata = {
        ...(trigger.metadata ?? {}),
        nextRunId,
      };
      const retryEvent = {
        runId: nextRunId,
        triggerId: trigger.id,
        job: trigger.job,
        attempt: retryDecision.nextAttempt,
        delayMs,
      } as const;
      this.events.emit("retry", retryEvent);
      this.events.emit("scheduled", {
        triggerId: trigger.id,
        job: trigger.job,
        runId: nextRunId,
        scheduledAt: resumeAt,
        queuedAt: this.clock.now(),
      });
      await this.store.upsertTrigger(trigger);
      await this.store.releaseTrigger(trigger.id, this.ownerId);
      return;
    }

    const nextRunAt = plan.next(scheduledAt);
    trigger.nextRunAt = nextRunAt ?? undefined;
    trigger.metadata = {
      ...(trigger.metadata ?? {}),
      nextRunId: nextRunAt ? this.generateRunId(trigger.id) : undefined,
    };
    if (nextRunAt) {
      this.events.emit("scheduled", {
        triggerId: trigger.id,
        job: trigger.job,
        runId: trigger.metadata?.nextRunId as string,
        scheduledAt: nextRunAt,
        queuedAt: this.clock.now(),
      });
      await this.store.upsertTrigger(trigger);
    } else {
      await this.store.deleteTrigger(trigger.id);
      this.plans.delete(trigger.id);
      this.events.emit("drain", { pendingRuns: 0, at: this.clock.now() });
    }
    await this.store.releaseTrigger(trigger.id, this.ownerId);
  }

  private evaluateRetry(job: JobDefinition, attempt: number): { delayMs: number; nextAttempt: number } | undefined {
    const policy = job.retries;
    if (!policy) {
      return undefined;
    }
    const maxAttempts = Math.max(1, policy.maxAttempts);
    if (attempt >= maxAttempts) {
      return undefined;
    }
    const nextAttempt = attempt + 1;
    const strategy = policy.strategy;
    let delayMs = 0;
    if (strategy) {
      delayMs =
        typeof strategy === "function"
          ? strategy(nextAttempt)
          : strategy.nextDelay(nextAttempt);
    }
    return {
      delayMs: Math.max(0, delayMs),
      nextAttempt,
    };
  }

  private generateTriggerId(jobName: string) {
    return `${jobName}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  }

  private generateRunId(triggerId: string) {
    return `${triggerId}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 6)}`;
  }

  private configureJobControls(job: JobDefinition) {
    if (job.concurrency && job.concurrency > 0) {
      this.jobSemaphores.set(job.name, new Semaphore(job.concurrency));
    } else {
      this.jobSemaphores.delete(job.name);
    }
    if (job.rateLimit) {
      this.jobRateLimiters.set(job.name, new TokenBucket(job.rateLimit));
    } else {
      this.jobRateLimiters.delete(job.name);
    }
  }

  private async acquireCapacity(job: JobDefinition): Promise<() => void> {
    const releases: Array<() => void> = [];
    if (this.globalSemaphore) {
      await this.globalSemaphore.acquire();
      releases.push(() => this.globalSemaphore?.release());
    }
    const jobSemaphore = this.jobSemaphores.get(job.name);
    if (jobSemaphore) {
      await jobSemaphore.acquire();
      releases.push(() => jobSemaphore.release());
    }
    if (this.globalRateLimiter) {
      await this.globalRateLimiter.take();
    }
    const jobLimiter = this.jobRateLimiters.get(job.name);
    if (jobLimiter) {
      await jobLimiter.take();
    }
    return () => {
      for (const release of releases) {
        release();
      }
    };
  }

  private releaseRunCapacity(runId: RunId) {
    const release = this.runCapacity.get(runId);
    if (release) {
      this.runCapacity.delete(runId);
      release();
    }
    this.runProgress.delete(runId);
  }

  private noteHandledRun(runId: RunId) {
    this.handledRuns.add(runId);
  }

  private async handleMisfire(
    trigger: PersistedTrigger,
    plan: ReturnType<typeof createPlan>,
    scheduledAt: Date,
    now: Date
  ): Promise<MisfireResult> {
    if (!trigger.nextRunAt) {
      return { scheduledAt: now, skipped: false };
    }
    const lateness = now.getTime() - scheduledAt.getTime();
    if (lateness <= this.misfireToleranceMs) {
      return { scheduledAt, skipped: false };
    }
    const policy = trigger.misfirePolicy ?? "skip";
    switch (policy) {
      case "skip":
        await this.skipOverdueRuns(trigger, plan, scheduledAt, now, lateness);
        return { scheduledAt, skipped: true };
      case "fire-now":
        this.logger.warn(
          `Trigger ${trigger.id} misfired by ${lateness}ms (policy=fire-now); executing immediately`
        );
        return { scheduledAt, skipped: false };
      case "catch-up":
        this.logger.warn(
          `Trigger ${trigger.id} misfired by ${lateness}ms (policy=catch-up); executing and catching up`
        );
        return { scheduledAt, skipped: false };
      default:
        return { scheduledAt, skipped: false };
    }
  }

  private async skipOverdueRuns(
    trigger: PersistedTrigger,
    plan: ReturnType<typeof createPlan>,
    scheduledAt: Date,
    now: Date,
    lateness: number
  ) {
    let reference = scheduledAt;
    let nextRunAt: Date | undefined;
    let iterations = 0;
    const nowMs = now.getTime();
    do {
      nextRunAt = plan.next(reference);
      iterations += 1;
      if (!nextRunAt) {
        break;
      }
      reference = nextRunAt;
    } while (
      nowMs - nextRunAt.getTime() > this.misfireToleranceMs &&
      iterations < MAX_MISFIRE_SKIP &&
      nextRunAt !== undefined
    );

    trigger.failureCount = 0;
    trigger.lastRunAt = scheduledAt;

    if (!nextRunAt) {
      await this.store.deleteTrigger(trigger.id);
      this.plans.delete(trigger.id);
      this.events.emit("drain", { pendingRuns: 0, at: now });
      this.logger.warn(
        `Trigger ${trigger.id} misfired by ${lateness}ms (policy=skip) and no further runs remain`
      );
      return;
    }

    const nextRunId = this.generateRunId(trigger.id);
    trigger.nextRunAt = nextRunAt;
    trigger.metadata = {
      ...(trigger.metadata ?? {}),
      nextRunId,
    };
    await this.store.upsertTrigger(trigger);
    this.events.emit("scheduled", {
      triggerId: trigger.id,
      job: trigger.job,
      runId: nextRunId,
      scheduledAt: nextRunAt,
      queuedAt: now,
    });

    this.logger.warn(
      `Trigger ${trigger.id} misfired by ${lateness}ms (policy=skip); skipped ${iterations} occurrences, next ${nextRunAt.toISOString()}`
    );
  }
}

const validateProgressValue = (value: number) => {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw createCronError("E_STATE", `Progress value must be between 0 and 100. Received ${value}`);
  }
};

interface MisfireResult {
  scheduledAt: Date;
  skipped: boolean;
}


export const createScheduler = (options: CreateSchedulerOptions = {}): Scheduler => {
  return new SchedulerEngine(options);
};
