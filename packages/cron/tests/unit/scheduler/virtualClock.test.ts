import { describe, expect, it } from "bun:test";
import { createScheduler } from "../../../src/scheduler.js";
import { createVirtualClock } from "../../../src/util/clock.js";
import { InMemoryStore } from "../../../src/store/memory.js";
import { at } from "../../../src/api.js";

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

describe("scheduler with virtual clock", () => {
  it("emits deterministic timestamps for runs", async () => {
    const clock = createVirtualClock({ startAt: new Date("2024-01-01T00:00:00.000Z") });
    const store = new InMemoryStore({ clock });
    const scheduler = createScheduler({
      clock,
      store,
      heartbeatIntervalMs: 10_000,
      stalledAfterMs: 60_000,
    });

    const startedAt: string[] = [];
    scheduler.on("run", (event) => startedAt.push(event.startedAt.toISOString()));

    await scheduler.registerJob({
      name: "virtual",
      handler: async () => undefined,
    });

    const trigger = await scheduler.schedule(
      "virtual",
      at(new Date(clock.nowMs() + 5_000), { metadata: { test: true } })
    );

    const engine: any = scheduler;
    if (engine.timer) {
      clearTimeout(engine.timer);
      engine.timer = undefined;
      engine.loopScheduled = false;
    }

    const triggerRecord = await store.getTrigger(trigger.id);
    expect(triggerRecord?.metadata?.test).toBe(true);

    clock.advance(5_000);
    await engine.drainDueTriggers();
    await waitFor(() => startedAt.length === 1);
    expect(startedAt[0]).toBe("2024-01-01T00:00:05.000Z");

    await scheduler.shutdown({ graceful: true, graceMs: 50 });
  });
});
