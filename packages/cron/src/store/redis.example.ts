/**
 * Example Redis store adapter. This file is intentionally not imported anywhere else in the
 * package so consumers can opt-in without pulling Redis into their bundle. The adapter sketches
 * how to map the {@link Store} contract to Redis primitives:
 *
 * - Triggers live in a ZSET keyed by next run time (`cron:triggers`) with scores as epoch ms.
 * - Pending runs use a priority ZSET (`cron:runs`) + HASH metadata for attempts and payloads.
 * - Heartbeats can be tracked via HASH fields (`cron:run:<id>`).
 * - Pub/Sub channels propagate global events for multi-node deployments.
 *
 * The implementation below is intentionally incomplete but provides the structure necessary to
 * wire your own Redis client.
 */

import type { JobName, RunId } from "../api.ts";
import type {
  RunResultRecord,
  RunRecord,
  Store,
  PersistedJob,
} from "./interfaces.js";

export interface RedisLike {
  zadd(key: string, ...args: Array<number | string>): Promise<number>;
  zrangebyscore(
    key: string,
    min: number | string,
    max: number | string,
    options?: Record<string, unknown>
  ): Promise<string[]>;
  hset(key: string, values: Record<string, string | number>): Promise<number>;
  hgetall(key: string): Promise<Record<string, string>>;
  hdel(key: string, ...fields: string[]): Promise<number>;
  del(key: string): Promise<number>;
  set(
    key: string,
    value: string,
    options?: Record<string, unknown>
  ): Promise<void>;
  get(key: string): Promise<string | null>;
  publish?(channel: string, message: string): Promise<number>;
}

export class RedisStore implements Store {
  constructor(
    private readonly redis: RedisLike,
    private readonly namespace = "cron"
  ) {}
  getJob(name: JobName): Promise<PersistedJob | undefined> {
    throw new Error("RedisStore.getJob example not implemented");
  }

  getRun(runId: RunId): Promise<RunRecord | undefined> {
    throw new Error("RedisStore.getRun example not implemented");
  }

  async init(): Promise<void> {}

  async dispose(): Promise<void> {}

  async upsertJob(): Promise<void> {
    throw new Error("RedisStore.upsertJob example not implemented");
  }

  async listJobs(): Promise<PersistedJob[]> {
    throw new Error("RedisStore.listJobs example not implemented");
  }

  async setJobPaused(): Promise<void> {}

  async removeJob(): Promise<void> {}

  async upsertTrigger(): Promise<void> {
    throw new Error("RedisStore.upsertTrigger example not implemented");
  }

  async getTrigger() {
    return undefined;
  }

  async listTriggers() {
    return [];
  }

  async deleteTrigger(): Promise<void> {}

  async listDueTriggers(): Promise<any[]> {
    return [];
  }

  async claimTrigger(): Promise<boolean> {
    return false;
  }

  async releaseTrigger(): Promise<void> {}

  async recordRunStart(_record: RunRecord): Promise<void> {
    throw new Error("RedisStore.recordRunStart example not implemented");
  }

  async recordRunEnd(_runId: string, _result: RunResultRecord): Promise<void> {}

  async touchRun(): Promise<void> {}

  async findStalledRuns(): Promise<RunRecord[]> {
    return [];
  }
}
