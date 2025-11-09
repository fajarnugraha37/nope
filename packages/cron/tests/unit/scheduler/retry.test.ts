import { describe, expect, it } from "bun:test";
import { createScheduler } from "../../../src/scheduler.js";
import { fixedBackoff } from "../../../src/util/backoff.js";

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

describe("scheduler retries", () => {
  it("retries failed jobs with backoff and emits retry events", async () => {
    const scheduler = createScheduler();
    const attempts: number[] = [];
    const retryEvents: number[] = [];

    scheduler.on("retry", (event) => retryEvents.push(event.attempt));

    await scheduler.registerJob({
      name: "flaky",
      retries: {
        maxAttempts: 3,
        strategy: fixedBackoff({ delayMs: 25 }),
      },
      handler: async ({ attempt }) => {
        attempts.push(attempt);
        if (attempt < 2) {
          throw new Error("boom");
        }
        return "ok";
      },
    });

    await scheduler.schedule("flaky", {
      kind: "every",
      every: 10,
      maxRuns: 1,
    });

    await waitFor(() => attempts.length === 2);

    expect(attempts).toEqual([1, 2]);
    expect(retryEvents).toEqual([2]);
    await scheduler.shutdown({ graceful: true, graceMs: 100 });
  });

  it("stops retrying after reaching maxAttempts", async () => {
    const scheduler = createScheduler();
    const attempts: number[] = [];
    const retryEvents: number[] = [];

    scheduler.on("retry", (event) => retryEvents.push(event.attempt));

    await scheduler.registerJob({
      name: "exhausted",
      retries: {
        maxAttempts: 2,
        strategy: fixedBackoff({ delayMs: 10 }),
      },
      handler: async ({ attempt }) => {
        attempts.push(attempt);
        throw new Error(`attempt ${attempt}`);
      },
    });

    await scheduler.schedule("exhausted", {
      kind: "every",
      every: 10,
      maxRuns: 1,
    });

    await waitFor(() => attempts.length === 2);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(attempts).toEqual([1, 2]);
    expect(retryEvents).toEqual([2]);
    await scheduler.shutdown({ graceful: true, graceMs: 100 });
  });
});
