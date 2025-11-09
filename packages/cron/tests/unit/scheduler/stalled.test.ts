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

describe("scheduler stalled detection", () => {
  it("emits stalled events and retries when heartbeats stop", async () => {
    const scheduler = createScheduler({
      heartbeatIntervalMs: 10,
      stalledAfterMs: 30,
    });
    const attempts: number[] = [];
    const stalled: string[] = [];
    const retries: number[] = [];
    let unblock: (() => void) | undefined;

    scheduler.on("stalled", (event) => stalled.push(event.runId));
    scheduler.on("retry", (event) => retries.push(event.attempt));

    await scheduler.registerJob({
      name: "slowpoke",
      retries: {
        maxAttempts: 2,
        strategy: fixedBackoff({ delayMs: 10 }),
      },
      handler: async ({ attempt }) => {
        attempts.push(attempt);
        if (attempt === 1) {
          await new Promise<void>((resolve) => {
            unblock = resolve;
          });
          return "late";
        }
        return "ok";
      },
    });

    await scheduler.schedule("slowpoke", { kind: "every", every: 5, maxRuns: 1 });

    await waitFor(() => attempts.includes(2), 5_000);

    expect(stalled).toHaveLength(1);
    expect(retries).toEqual([2]);
    expect(attempts).toEqual([1, 2]);

    unblock?.();
    await scheduler.shutdown({ graceful: true, graceMs: 100 });
  });
});
