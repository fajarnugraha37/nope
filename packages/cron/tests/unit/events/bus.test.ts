import { describe, expect, it } from "bun:test";
import { EventBus } from "../../../src/events/bus.js";

describe("events/bus", () => {
  it("registers and emits listeners", () => {
    const bus = new EventBus();
    const payloads: unknown[] = [];
    bus.on("scheduled", (event) => payloads.push(event.triggerId));
    bus.emit("scheduled", {
      triggerId: "t-1",
      job: "job",
      runId: "run-1",
      scheduledAt: new Date(),
      queuedAt: new Date(),
    });
    expect(payloads).toEqual(["t-1"]);
  });

  it("supports once listeners", () => {
    const bus = new EventBus();
    let count = 0;
    bus.once("drain", () => count++);
    bus.emit("drain", { pendingRuns: 0, at: new Date() });
    bus.emit("drain", { pendingRuns: 0, at: new Date() });
    expect(count).toBe(1);
  });

  it("removes listeners and can clear all", () => {
    const bus = new EventBus();
    const handled: number[] = [];
    const unsub = bus.on("run", () => handled.push(1));
    unsub();
    bus.emit("run", {
      triggerId: "t",
      job: "job",
      runId: "run",
      attempt: 1,
      scheduledAt: new Date(),
      startedAt: new Date(),
    });
    expect(handled).toEqual([]);
    bus.on("run", () => handled.push(2));
    bus.removeAllListeners("run");
    bus.emit("run", {
      triggerId: "t",
      job: "job",
      runId: "run",
      attempt: 1,
      scheduledAt: new Date(),
      startedAt: new Date(),
    });
    expect(handled).toEqual([]);
  });

  it("removeAllListeners clears everything when no event specified", () => {
    const bus = new EventBus();
    let fired = 0;
    bus.on("error", () => fired++);
    bus.removeAllListeners();
    bus.emit("error", {
      triggerId: "t",
      job: "job",
      runId: "run",
      attempt: 1,
      error: new Error("boom"),
    });
    expect(fired).toBe(0);
  });
});
