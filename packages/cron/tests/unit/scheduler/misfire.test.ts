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

describe("scheduler misfire policies", () => {
  it("skips overdue runs when misfire policy is skip", async () => {
    const scheduler = createScheduler({ misfireToleranceMs: 10 });
    let runs = 0;

    await scheduler.registerJob({
      name: "skip-job",
      handler: async () => {
        runs += 1;
      },
    });

    const trigger = await scheduler.schedule("skip-job", {
      kind: "at",
      runAt: new Date(Date.now() + 1_000),
      misfirePolicy: "skip",
    });

    const record = await scheduler.store.getTrigger(trigger.id);
    if (!record) {
      throw new Error("missing trigger");
    }
    record.nextRunAt = new Date(Date.now() - 200);
    await scheduler.store.upsertTrigger(record);

    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(runs).toBe(0);
    await scheduler.shutdown({ graceful: true, graceMs: 100 });
  });

  it("fires immediately for overdue runs when policy is fire-now", async () => {
    const scheduler = createScheduler({ misfireToleranceMs: 10 });
    let runs = 0;

    await scheduler.registerJob({
      name: "fire-now-job",
      handler: async () => {
        runs += 1;
      },
    });

    const trigger = await scheduler.schedule("fire-now-job", {
      kind: "at",
      runAt: new Date(Date.now() + 1_000),
      misfirePolicy: "fire-now",
    });

    const record = await scheduler.store.getTrigger(trigger.id);
    if (!record) {
      throw new Error("missing trigger");
    }
    record.nextRunAt = new Date(Date.now() - 200);
    await scheduler.store.upsertTrigger(record);

    await waitFor(() => runs === 1);
    expect(runs).toBe(1);
    await scheduler.shutdown({ graceful: true, graceMs: 100 });
  });
});
