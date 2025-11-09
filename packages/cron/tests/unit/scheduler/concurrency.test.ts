import { describe, expect, it } from "bun:test";
import { createScheduler } from "../../../src/scheduler.js";

const waitFor = async (predicate: () => boolean, timeoutMs = 2_000, intervalMs = 10) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("waitFor timeout");
};

describe("scheduler concurrency and rate limits", () => {
  it("respects per-job concurrency limits", async () => {
    const scheduler = createScheduler();
    let active = 0;
    let peak = 0;
    let completed = 0;

    await scheduler.registerJob({
      name: "limited",
      concurrency: 1,
      handler: async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 50));
        active -= 1;
        completed += 1;
      },
    });

    const runAt = Date.now() + 10;
    await scheduler.schedule("limited", { kind: "at", runAt });
    await scheduler.schedule("limited", { kind: "at", runAt });

    await waitFor(() => completed === 2);
    expect(peak).toBe(1);
    await scheduler.shutdown({ graceful: true, graceMs: 100 });
  });

  it("throttles executions via per-job rate limit", async () => {
    const scheduler = createScheduler();
    const startTimes: number[] = [];

    await scheduler.registerJob({
      name: "throttled",
      rateLimit: {
        capacity: 1,
        refillRate: 1,
        refillIntervalMs: 100,
      },
      handler: async () => {
        startTimes.push(Date.now());
      },
    });

    const runAt = Date.now() + 10;
    await scheduler.schedule("throttled", { kind: "at", runAt });
    await scheduler.schedule("throttled", { kind: "at", runAt });
    await scheduler.schedule("throttled", { kind: "at", runAt });

    await waitFor(() => startTimes.length === 3, 5_000);

    expect(startTimes[1] - startTimes[0]).toBeGreaterThanOrEqual(80);
    expect(startTimes[2] - startTimes[1]).toBeGreaterThanOrEqual(80);
    await scheduler.shutdown({ graceful: true, graceMs: 100 });
  });

  it("enforces global maxConcurrentRuns across all jobs", async () => {
    const scheduler = createScheduler({ maxConcurrentRuns: 2 });
    let active = 0;
    let peak = 0;
    let completed = 0;

    await scheduler.registerJob({
      name: "global-limited",
      concurrency: 10,
      handler: async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 50));
        active -= 1;
        completed += 1;
      },
    });

    const runAt = Date.now() + 10;
    for (let i = 0; i < 5; i++) {
      await scheduler.schedule("global-limited", { kind: "at", runAt });
    }

    await waitFor(() => completed === 5);
    expect(peak).toBeLessThanOrEqual(2);
    await scheduler.shutdown({ graceful: true, graceMs: 100 });
  });

  it("applies global rate limits across different jobs", async () => {
    const scheduler = createScheduler({
      globalRateLimit: {
        capacity: 1,
        refillRate: 1,
        refillIntervalMs: 100,
      },
    });
    const startTimes: number[] = [];

    const handler = async () => {
      startTimes.push(Date.now());
    };

    await scheduler.registerJob({ name: "burst-a", handler });
    await scheduler.registerJob({ name: "burst-b", handler });

    const runAt = Date.now() + 10;
    await scheduler.schedule("burst-a", { kind: "at", runAt });
    await scheduler.schedule("burst-b", { kind: "at", runAt });
    await scheduler.schedule("burst-a", { kind: "at", runAt });

    await waitFor(() => startTimes.length === 3, 5_000);
    expect(startTimes[1] - startTimes[0]).toBeGreaterThanOrEqual(80);
    expect(startTimes[2] - startTimes[1]).toBeGreaterThanOrEqual(80);

    await scheduler.shutdown({ graceful: true, graceMs: 100 });
  });
});
