import { describe, expect, it } from "bun:test";
import { createSystemClock, createVirtualClock } from "../../../src/util/clock.js";

describe("util/clock - virtual clock harness", () => {
  it("advances deterministically", () => {
    const start = new Date("2024-01-01T00:00:00.000Z");
    const clock = createVirtualClock({ startAt: start });
    expect(clock.now().toISOString()).toBe(start.toISOString());
    clock.advance(1_000);
    expect(clock.now().toISOString()).toBe("2024-01-01T00:00:01.000Z");
  });

  it("resolves sleepers when time advances", async () => {
    const clock = createVirtualClock({ startAt: new Date("2024-01-01T00:00:00.000Z") });
    let woke = false;
    const sleeper = clock.sleep(5_000).then(() => {
      woke = true;
    });
    expect(clock.pendingTimers).toBe(1);
    clock.advance(4_000);
    expect(woke).toBe(false);
    clock.advance(1_000);
    await sleeper;
    expect(woke).toBe(true);
    expect(clock.pendingTimers).toBe(0);
  });

  it("falls back to system clock when requested", async () => {
    const clock = createSystemClock();
    const before = clock.nowMs();
    await clock.sleep(5);
    expect(clock.nowMs()).toBeGreaterThanOrEqual(before);
  });
});
