import { describe, expect, it } from "bun:test";
import { createScheduler } from "../../../src/scheduler.js";
import type { RunRecord } from "../../../src/store/interfaces.js";

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

describe("scheduler progress + results", () => {
  it("persists progress updates and run results", async () => {
    const scheduler = createScheduler();
    let completedRun: RunRecord | undefined;

    scheduler.on("completed", async (event) => {
      completedRun = await scheduler.getRun(event.runId);
    });

    await scheduler.registerJob({
      name: "progress-job",
      handler: async ({ touch }) => {
        await touch(10);
        await touch(100);
        return { status: "ok" };
      },
    });

    await scheduler.schedule("progress-job", {
      kind: "at",
      runAt: new Date(Date.now() + 10),
    });

    await waitFor(() => Boolean(completedRun), 5_000);
    expect(completedRun?.progress).toBe(100);
    expect(completedRun?.result).toEqual({ status: "ok" });

    await scheduler.shutdown({ graceful: true, graceMs: 100 });
  });

  it("rejects progress values outside 0-100", async () => {
    const scheduler = createScheduler();
    let errorCode: string | undefined;

    scheduler.on("error", (event) => {
      errorCode = (event.error as { code?: string })?.code;
    });

    await scheduler.registerJob({
      name: "invalid-progress",
      handler: async ({ touch }) => {
        await touch(200);
      },
    });

    await scheduler.schedule("invalid-progress", {
      kind: "at",
      runAt: new Date(Date.now() + 10),
    });

    await waitFor(() => errorCode === "E_STATE", 5_000);
    expect(errorCode).toBe("E_STATE");

    await scheduler.shutdown({ graceful: true, graceMs: 100 });
  });

  it("rejects decreasing progress updates", async () => {
    const scheduler = createScheduler();
    let errorCode: string | undefined;

    scheduler.on("error", (event) => {
      errorCode = (event.error as { code?: string })?.code;
    });

    await scheduler.registerJob({
      name: "regressive-progress",
      handler: async ({ touch }) => {
        await touch(50);
        await touch(25);
      },
    });

    await scheduler.schedule("regressive-progress", {
      kind: "at",
      runAt: new Date(Date.now() + 10),
    });

    await waitFor(() => errorCode === "E_STATE", 5_000);
    expect(errorCode).toBe("E_STATE");
    await scheduler.shutdown({ graceful: true, graceMs: 100 });
  });
});
