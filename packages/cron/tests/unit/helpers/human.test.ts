import { describe, expect, it } from "bun:test";
import { at, every } from "../../../src/api.js";
import { createPlan } from "../../../src/planner/plan.js";

describe("human helpers", () => {
  it("builds every triggers with overrides", () => {
    const start = new Date("2024-01-01T00:00:00.000Z");
    const trigger = every("5m", {
      startAt: start,
      maxRuns: 2,
    });

    const plan = createPlan(trigger);
    const first = plan.next(start);
    const afterFirst = new Date((first?.getTime() ?? start.getTime()) + 1);
    const second = plan.next(afterFirst);

    expect(first?.toISOString()).toBe("2024-01-01T00:00:00.000Z");
    expect(second?.toISOString()).toBe("2024-01-01T00:05:00.000Z");
  });

  it("builds at triggers with optional metadata", () => {
    const runAt = "2024-06-01T12:00:00.000Z";
    const trigger = at(runAt, { metadata: { source: "test" } });
    const plan = createPlan(trigger);
    const next = plan.next(new Date("2024-06-01T11:00:00.000Z"));
    expect(next?.toISOString()).toBe(runAt);
    expect(trigger.metadata?.source).toBe("test");
  });
});
