import { describe, expect, it } from "bun:test";
import { JobRunner } from "../../../src/queue/runner.js";
import { createSystemClock } from "../../../src/util/clock.js";
import { createLogger } from "../../../src/util/logger.js";

const noopLogger = createLogger({ writer: () => {} });
const clock = createSystemClock();

describe("queue/runner", () => {
  it("invokes job handler and returns its result", async () => {
    const runner = new JobRunner();
    const touches: Array<number | undefined> = [];

    const result = await runner.run({
      job: {
        name: "echo",
        handler: async ({ touch, payload }) => {
          await touch(42);
          return `hello-${payload}`;
        },
      },
      runId: "run-1",
      triggerId: "trig-1",
      scheduledAt: new Date(),
      attempt: 1,
      payload: "world",
      clock,
      logger: noopLogger,
      touch: async (progress) => touches.push(progress),
    });

    expect(result).toBe("hello-world");
    expect(touches).toEqual([42]);
  });

  it("rejects when no handler or worker is defined", async () => {
    const runner = new JobRunner();

    await expect(
      runner.run({
        job: { name: "broken" },
        runId: "run-2",
        triggerId: "trig-2",
        scheduledAt: new Date(),
        attempt: 1,
        clock,
        logger: noopLogger,
        touch: async () => {},
      })
    ).rejects.toMatchObject({ code: "E_CONFIGURATION" });
  });

  it("aborts long-running jobs when timeout elapses", async () => {
    const runner = new JobRunner();

    await expect(
      runner.run({
        job: {
          name: "slow",
          handler: async () => {
            await new Promise((resolve) => setTimeout(resolve, 50));
          },
          timeoutMs: 10,
        },
        runId: "run-3",
        triggerId: "trig-3",
        scheduledAt: new Date(),
        attempt: 1,
        clock,
        logger: noopLogger,
        touch: async () => {},
      })
    ).rejects.toMatchObject({ code: "E_TIMEOUT" });
  });
});
