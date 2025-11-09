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

describe("scheduler.executeNow", () => {
  it("runs a job immediately and returns run metadata", async () => {
    const scheduler = createScheduler();
    let runs = 0;

    await scheduler.registerJob({
      name: "immediate-job",
      handler: async () => {
        runs += 1;
      },
    });

    const completed = new Promise<string>((resolve) => {
      scheduler.on("completed", (event) => {
        if (event.job === "immediate-job") {
          resolve(event.runId);
        }
      });
    });

    const { runId, triggerId } = await scheduler.executeNow("immediate-job");
    expect(triggerId).toBeTruthy();

    const finishedRunId = await completed;
    expect(finishedRunId).toBe(runId);
    expect(runs).toBe(1);
    await scheduler.shutdown({ graceful: true, graceMs: 100 });
  });

  it("normalizes past runAt values to now so the job still fires", async () => {
    const scheduler = createScheduler();
    let runs = 0;

    await scheduler.registerJob({
      name: "backdated-job",
      handler: async () => {
        runs += 1;
      },
    });

    await scheduler.executeNow("backdated-job", {
      runAt: new Date(Date.now() - 60_000),
      metadata: { source: "test" },
    });

    await waitFor(() => runs === 1);
    expect(runs).toBe(1);
    await scheduler.shutdown({ graceful: true, graceMs: 100 });
  });
});
