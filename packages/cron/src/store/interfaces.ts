import type {
  JobDefinition,
  JobName,
  RunId,
  TriggerId,
  TriggerOptions,
} from "../api.js";

export type RunStatus = "pending" | "running" | "completed" | "failed" | "canceled" | "stalled";

export interface PersistedJob<TPayload = unknown, TResult = unknown> {
  name: JobName;
  definition: JobDefinition<TPayload, TResult>;
  createdAt: Date;
  updatedAt: Date;
  paused: boolean;
}

export interface PersistedTrigger {
  id: TriggerId;
  job: JobName;
  options: TriggerOptions;
  nextRunAt?: Date;
  lastRunAt?: Date;
  failureCount: number;
  misfirePolicy?: string;
  priority: number;
  paused: boolean;
  revision: number;
  metadata?: Record<string, unknown>;
  leasedUntil?: Date;
  leaseOwner?: string;
}

export interface RunRecord {
  runId: RunId;
  triggerId: TriggerId;
  job: JobName;
  scheduledAt: Date;
  startedAt?: Date;
  endedAt?: Date;
  attempt: number;
  status: RunStatus;
  progress?: number;
  heartbeatAt?: Date;
  result?: unknown;
  error?: unknown;
}

export interface RunResultRecord {
  status: "completed" | "failed" | "canceled" | "stalled";
  endedAt: Date;
  result?: unknown;
  error?: unknown;
}

export interface Store {
  init(): Promise<void>;
  dispose(): Promise<void>;
  upsertJob(record: PersistedJob): Promise<void>;
  getJob(name: JobName): Promise<PersistedJob | undefined>;
  listJobs(): Promise<PersistedJob[]>;
  setJobPaused(name: JobName, paused: boolean): Promise<void>;
  removeJob(name: JobName): Promise<void>;
  upsertTrigger(record: PersistedTrigger): Promise<void>;
  getTrigger(id: TriggerId): Promise<PersistedTrigger | undefined>;
  listTriggers(): Promise<PersistedTrigger[]>;
  deleteTrigger(id: TriggerId): Promise<void>;
  listDueTriggers(until: Date, limit: number): Promise<PersistedTrigger[]>;
  claimTrigger(triggerId: TriggerId, ownerId: string, leaseMs: number): Promise<boolean>;
  releaseTrigger(triggerId: TriggerId, ownerId: string): Promise<void>;
  recordRunStart(record: RunRecord): Promise<void>;
  recordRunEnd(runId: RunId, result: RunResultRecord): Promise<void>;
  touchRun(runId: RunId, progress?: number): Promise<void>;
  findStalledRuns(heartbeatTimeoutMs: number, now: Date): Promise<RunRecord[]>;
  getRun(runId: RunId): Promise<RunRecord | undefined>;
}

export interface QueueItem<T = unknown> {
  id: string;
  payload: T;
  availableAt: Date;
  priority: number;
  attempts: number;
}

export interface QueueEnqueueOptions {
  priority?: number;
  delayMs?: number;
}

export interface QueueDequeueOptions {
  ownerId: string;
  leaseMs: number;
}

export interface Queue<T = unknown> {
  enqueue(item: Omit<QueueItem<T>, "id" | "availableAt" | "priority" | "attempts">, options?: QueueEnqueueOptions): Promise<QueueItem<T>>;
  dequeue(options: QueueDequeueOptions): Promise<QueueItem<T> | undefined>;
  ack(id: string): Promise<void>;
  requeue(id: string, options?: QueueEnqueueOptions): Promise<void>;
}
