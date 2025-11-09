import type { BackoffStrategy } from "./util/backoff.js";
import type { Clock } from "./util/clock.js";
import type { Logger } from "./util/logger.js";
import type { RunRecord, Store } from "./store/interfaces.js";

export type TriggerId = string;
export type RunId = string;
export type JobName = string;

export type SchedulerEventName =
  | "scheduled"
  | "run"
  | "completed"
  | "canceled"
  | "error"
  | "stalled"
  | "retry"
  | "progress"
  | "paused"
  | "resumed"
  | "drain"
  | "shutdown";

export interface SchedulerEventMap {
  scheduled: ScheduledEvent;
  run: RunEvent;
  completed: CompletedEvent;
  canceled: CanceledEvent;
  error: ErrorEvent;
  stalled: StalledEvent;
  retry: RetryEvent;
  progress: ProgressEvent;
  paused: PausedEvent;
  resumed: ResumedEvent;
  drain: DrainEvent;
  shutdown: ShutdownEvent;
}

export interface ScheduledEvent {
  triggerId: TriggerId;
  job: JobName;
  runId: RunId;
  scheduledAt: Date;
  queuedAt: Date;
}

export interface RunEvent {
  triggerId: TriggerId;
  job: JobName;
  runId: RunId;
  attempt: number;
  scheduledAt: Date;
  startedAt: Date;
}

export interface CompletedEvent {
  triggerId: TriggerId;
  job: JobName;
  runId: RunId;
  attempt: number;
  scheduledAt: Date;
  completedAt: Date;
  result?: unknown;
}

export interface CanceledEvent {
  triggerId: TriggerId;
  job: JobName;
  runId: RunId;
  reason: string;
}

export interface ErrorEvent {
  triggerId: TriggerId;
  job: JobName;
  runId: RunId;
  attempt: number;
  error: unknown;
}

export interface StalledEvent {
  runId: RunId;
  triggerId: TriggerId;
  job: JobName;
  lastHeartbeatAt: Date;
}

export interface RetryEvent {
  runId: RunId;
  triggerId: TriggerId;
  job: JobName;
  attempt: number;
  delayMs: number;
}

export interface ProgressEvent {
  runId: RunId;
  triggerId: TriggerId;
  job: JobName;
  progress: number;
  at: Date;
}

export interface PausedEvent {
  scope: "scheduler" | "job" | "trigger";
  identifier?: string;
  at: Date;
}

export interface ResumedEvent {
  scope: "scheduler" | "job" | "trigger";
  identifier?: string;
  at: Date;
}

export interface DrainEvent {
  pendingRuns: number;
  at: Date;
}

export interface ShutdownEvent {
  at: Date;
  graceful: boolean;
}

export interface SchedulerListener<T extends SchedulerEventName> {
  (event: SchedulerEventMap[T]): void;
}

export type MisfirePolicy = "skip" | "fire-now" | "catch-up";

export interface CalendarRule {
  include?: string[];
  exclude?: string[];
}

export interface RateLimitOptions {
  capacity: number;
  refillRate: number;
  refillIntervalMs: number;
  burst?: number;
  windowMs?: number;
}

export interface RetryPolicy {
  maxAttempts: number;
  strategy: BackoffStrategy | ((attempt: number) => number);
}

export interface ShellWorkerDefinition {
  kind: "shell";
  command: string | string[];
  cwd?: string;
  env?: Record<string, string>;
  shell?: string;
  timeoutMs?: number;
}

export type WorkerDefinition = ShellWorkerDefinition;

export interface BaseTriggerOptions {
  idempotencyKey?: string;
  timezone?: string;
  calendars?: CalendarRule[];
  misfirePolicy?: MisfirePolicy;
  priority?: number;
  startAt?: Date;
  endAt?: Date;
  maxRuns?: number;
  metadata?: Record<string, unknown>;
}

export interface CronTriggerOptions extends BaseTriggerOptions {
  expression: string;
}

export interface EveryTriggerOptions extends BaseTriggerOptions {
  every: string | number;
  offset?: number;
}

export interface AtTriggerOptions extends BaseTriggerOptions {
  runAt: Date | string | number;
}

export interface RRuleTriggerOptions extends BaseTriggerOptions {
  rrule: string;
  exdates?: Array<Date | string>;
}

export type TriggerOptions =
  | ({ kind: "cron" } & CronTriggerOptions)
  | ({ kind: "every" } & EveryTriggerOptions)
  | ({ kind: "at" } & AtTriggerOptions)
  | ({ kind: "rrule" } & RRuleTriggerOptions);

export type ExecuteNowOptions = Omit<AtTriggerOptions, "kind" | "runAt"> & {
  runAt?: AtTriggerOptions["runAt"];
};

export interface ExecuteNowResult {
  triggerId: TriggerId;
  runId: RunId;
}

export interface JobHandlerContext<TPayload = unknown> {
  runId: RunId;
  triggerId: TriggerId;
  job: JobName;
  payload: TPayload;
  scheduledAt: Date;
  attempt: number;
  signal: AbortSignal;
  touch: (progress?: number) => Promise<void>;
  logger: Logger;
  clock: Clock;
}

export type JobHandler<TPayload = unknown, TResult = unknown> = (
  context: JobHandlerContext<TPayload>
) => TResult | Promise<TResult>;

export interface JobDefinition<TPayload = unknown, TResult = unknown> {
  name: JobName;
  concurrency?: number;
  timeoutMs?: number;
  retries?: RetryPolicy;
  rateLimit?: RateLimitOptions;
  metadata?: Record<string, unknown>;
  worker?: WorkerDefinition;
  handler?: JobHandler<TPayload, TResult>;
}

export interface JobHandle {
  name: JobName;
  pause(): Promise<void>;
  resume(): Promise<void>;
  unregister(): Promise<void>;
}

export interface TriggerHandle {
  id: TriggerId;
  pause(): Promise<void>;
  resume(): Promise<void>;
  cancel(): Promise<void>;
}

export interface Scheduler {
  readonly id: string;
  readonly clock: Clock;
  readonly store: Store;
  readonly logger: Logger;
  on<T extends SchedulerEventName>(event: T, listener: SchedulerListener<T>): () => void;
  registerJob<TPayload, TResult>(definition: JobDefinition<TPayload, TResult>): Promise<JobHandle>;
  schedule(jobName: JobName, options: TriggerOptions): Promise<TriggerHandle>;
  executeNow(jobName: JobName, options?: ExecuteNowOptions): Promise<ExecuteNowResult>;
  pauseAll(): Promise<void>;
  resumeAll(): Promise<void>;
  getRun(runId: RunId): Promise<RunRecord | undefined>;
  shutdown(options?: ShutdownOptions): Promise<void>;
}

export interface ShutdownOptions {
  graceful?: boolean;
  graceMs?: number;
  reason?: string;
}

export interface CreateSchedulerOptions {
  id?: string;
  logger?: Logger;
  store?: Store;
  clock?: Clock;
  heartbeatIntervalMs?: number;
  stalledAfterMs?: number;
  defaultTimezone?: string;
  maxConcurrentRuns?: number;
  globalRateLimit?: RateLimitOptions;
  misfireToleranceMs?: number;
}

type EveryHelperOverrides = Omit<EveryTriggerOptions, "kind" | "every">;
type AtHelperOverrides = Omit<AtTriggerOptions, "kind" | "runAt">;

export const every = (
  interval: EveryTriggerOptions["every"],
  overrides: EveryHelperOverrides = {}
): TriggerOptions => ({
  kind: "every",
  every: interval,
  ...overrides,
});

export const at = (
  runAt: AtTriggerOptions["runAt"],
  overrides: AtHelperOverrides = {}
): TriggerOptions => ({
  kind: "at",
  runAt,
  ...overrides,
});
