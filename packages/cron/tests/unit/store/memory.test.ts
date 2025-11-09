import { describe, expect, it } from "bun:test";
import { createVirtualClock } from "../../../src/util/clock.js";
import { InMemoryStore } from "../../../src/store/memory.js";
import type { RunRecord } from "../../../src/store/interfaces.js";

describe("store/memory with virtual clock", () => {
  it("records run start/end deterministically", async () => {
    const clock = createVirtualClock({ startAt: new Date("2024-01-01T00:00:00.000Z") });
    const store = new InMemoryStore({ clock });
    await store.init();

    const run: RunRecord = {
      runId: "run-1",
      triggerId: "trig-1",
      job: "job",
      scheduledAt: clock.now(),
      attempt: 1,
      status: "pending",
    };

    await store.recordRunStart(run);
    const started = await store.getRun("run-1");
    expect(started?.startedAt?.toISOString()).toBe("2024-01-01T00:00:00.000Z");

    clock.advance(5_000);
    await store.recordRunEnd("run-1", { status: "completed", endedAt: clock.now() });
    const ended = await store.getRun("run-1");
    expect(ended?.endedAt?.toISOString()).toBe("2024-01-01T00:00:05.000Z");
  });

  it("detects stalled runs using the provided clock", async () => {
    const clock = createVirtualClock({ startAt: new Date("2024-01-01T00:00:00.000Z") });
    const store = new InMemoryStore({ clock });
    await store.init();

    await store.recordRunStart({
      runId: "stall-run",
      triggerId: "t",
      job: "job",
      scheduledAt: clock.now(),
      attempt: 1,
      status: "pending",
    });

    clock.advance(60_000);
    const stalled = await store.findStalledRuns(30_000, clock.now());
    expect(stalled.map((run) => run.runId)).toContain("stall-run");
  });
});
