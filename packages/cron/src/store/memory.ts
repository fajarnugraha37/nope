import type { Clock } from "../util/clock.js";
import { createSystemClock } from "../util/clock.js";
import type { JobName, TriggerId, RunId } from "../api.js";
import type { PersistedJob, PersistedTrigger, RunRecord, RunResultRecord, Store } from "./interfaces.js";

export interface InMemoryStoreOptions {
  clock?: Clock;
}

export class InMemoryStore implements Store {
  private readonly clock: Clock;
  private readonly jobs: Map<JobName, PersistedJob> = new Map();
  private readonly triggers: Map<TriggerId, PersistedTrigger> = new Map();
  private readonly runs: Map<RunId, RunRecord> = new Map();

  constructor(options: InMemoryStoreOptions = {}) {
    this.clock = options.clock ?? createSystemClock();
  }

  async init(): Promise<void> {}

  async dispose(): Promise<void> {
    this.jobs.clear();
    this.triggers.clear();
    this.runs.clear();
  }

  async upsertJob(record: PersistedJob): Promise<void> {
    this.jobs.set(record.name, { ...record });
  }

  async getJob(name: JobName): Promise<PersistedJob | undefined> {
    const job = this.jobs.get(name);
    return job ? { ...job } : undefined;
  }

  async listJobs(): Promise<PersistedJob[]> {
    return Array.from(this.jobs.values()).map((job) => ({ ...job }));
  }

  async setJobPaused(name: JobName, paused: boolean): Promise<void> {
    const job = this.jobs.get(name);
    if (!job) {
      return;
    }
    job.paused = paused;
    job.updatedAt = this.now();
  }

  async removeJob(name: JobName): Promise<void> {
    this.jobs.delete(name);
  }

  async upsertTrigger(record: PersistedTrigger): Promise<void> {
    const normalized: PersistedTrigger = {
      ...record,
      failureCount: record.failureCount ?? 0,
      priority: record.priority ?? 0,
      revision: record.revision ?? 0,
    };
    this.triggers.set(normalized.id, normalized);
  }

  async getTrigger(id: TriggerId): Promise<PersistedTrigger | undefined> {
    const trigger = this.triggers.get(id);
    return trigger ? { ...trigger } : undefined;
  }

  async listTriggers(): Promise<PersistedTrigger[]> {
    return Array.from(this.triggers.values()).map((trigger) => ({ ...trigger }));
  }

  async deleteTrigger(id: TriggerId): Promise<void> {
    this.triggers.delete(id);
  }

  async listDueTriggers(until: Date, limit: number): Promise<PersistedTrigger[]> {
    const nowMs = until.getTime();
    const available = Array.from(this.triggers.values()).filter((trigger) => {
      if (trigger.paused) {
        return false;
      }
      if (!trigger.nextRunAt) {
        return false;
      }
      const leasedUntil = trigger.leasedUntil?.getTime() ?? 0;
      if (trigger.leaseOwner && leasedUntil > nowMs) {
        return false;
      }
      return trigger.nextRunAt.getTime() <= nowMs;
    });

    const sorted = available.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      const aNext = a.nextRunAt?.getTime() ?? 0;
      const bNext = b.nextRunAt?.getTime() ?? 0;
      if (aNext !== bNext) {
        return aNext - bNext;
      }
      return a.id.localeCompare(b.id);
    });

    return sorted.slice(0, limit).map((trigger) => ({ ...trigger }));
  }

  async claimTrigger(triggerId: TriggerId, ownerId: string, leaseMs: number): Promise<boolean> {
    const trigger = this.triggers.get(triggerId);
    if (!trigger || trigger.paused) {
      return false;
    }
    const now = this.now();
    const nowMs = now.getTime();
    const leasedUntil = trigger.leasedUntil?.getTime() ?? 0;
    if (trigger.leaseOwner && leasedUntil > nowMs && trigger.leaseOwner !== ownerId) {
      return false;
    }

    trigger.leaseOwner = ownerId;
    trigger.leasedUntil = new Date(nowMs + leaseMs);
    trigger.revision += 1;
    return true;
  }

  async releaseTrigger(triggerId: TriggerId, ownerId: string): Promise<void> {
    const trigger = this.triggers.get(triggerId);
    if (!trigger || trigger.leaseOwner !== ownerId) {
      return;
    }
    delete trigger.leaseOwner;
    delete trigger.leasedUntil;
  }

  async recordRunStart(record: RunRecord): Promise<void> {
    this.runs.set(record.runId, {
      ...record,
      status: "running",
      startedAt: record.startedAt ?? this.now(),
      heartbeatAt: this.now(),
    });
  }

  async recordRunEnd(runId: RunId, result: RunResultRecord): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) {
      return;
    }
    run.status = result.status;
    run.endedAt = result.endedAt;
    run.result = result.result;
    run.error = result.error;
  }

  async touchRun(runId: RunId, progress?: number): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) {
      return;
    }
    run.heartbeatAt = this.now();
    if (typeof progress === "number") {
      run.progress = progress;
    }
  }

  async findStalledRuns(heartbeatTimeoutMs: number, now: Date): Promise<RunRecord[]> {
    const deadline = now.getTime() - heartbeatTimeoutMs;
    return Array.from(this.runs.values())
      .filter((run) => run.status === "running" && (run.heartbeatAt?.getTime() ?? 0) < deadline)
      .map((run) => ({ ...run }));
  }

  async getRun(runId: RunId): Promise<RunRecord | undefined> {
    const run = this.runs.get(runId);
    return run ? { ...run } : undefined;
  }

  private now(): Date {
    return this.clock.now();
  }
}

export const createInMemoryStore = (options?: InMemoryStoreOptions) => new InMemoryStore(options);
