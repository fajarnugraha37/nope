import { describe, expect, it } from "bun:test";
import { createCronPlan } from "../../../src/planner/cron.js";

describe("planner/cron - timezone support", () => {
  it("honors positive timezone offsets for daily schedules", () => {
    const plan = createCronPlan({
      kind: "cron",
      expression: "0 0 9 * * ? *",
      timezone: "Asia/Jakarta",
    });

    const after = new Date("2024-03-01T00:00:00.000Z");
    const next = plan.next(after);
    expect(next?.toISOString()).toBe("2024-03-01T02:00:00.000Z");
  });

  it("evaluates weekdays relative to the provided timezone", () => {
    const plan = createCronPlan({
      kind: "cron",
      expression: "0 0 9 ? * 1 *",
      timezone: "Pacific/Auckland",
    });

    const after = new Date("2024-03-10T11:00:00.000Z"); // Monday 00:00 local
    const next = plan.next(after);
    expect(next?.toISOString()).toBe("2024-03-10T20:00:00.000Z");
  });

  it("skips nonexistent local times caused by DST gaps", () => {
    const plan = createCronPlan({
      kind: "cron",
      expression: "0 30 2 * * ? *",
      timezone: "America/New_York",
    });

    const after = new Date("2024-03-10T06:00:00.000Z"); // Just before the DST spring-forward gap
    const next = plan.next(after);
    expect(next?.toISOString()).toBe("2024-03-11T06:30:00.000Z");
  });
});

describe("planner/cron - Quartz modifiers", () => {
  it("shifts W expressions to the nearest weekday", () => {
    const plan = createCronPlan({
      kind: "cron",
      expression: "0 0 9 15W * ? *",
    });

    const next = plan.next(new Date("2024-06-13T12:00:00.000Z"));
    expect(next?.toISOString()).toBe("2024-06-14T09:00:00.000Z");
  });

  it("fires on the last calendar day via L", () => {
    const plan = createCronPlan({
      kind: "cron",
      expression: "0 0 2 L * ? *",
    });

    const next = plan.next(new Date("2024-02-28T00:00:00.000Z"));
    expect(next?.toISOString()).toBe("2024-02-29T02:00:00.000Z");
  });

  it("supports L-offset semantics", () => {
    const plan = createCronPlan({
      kind: "cron",
      expression: "0 30 5 L-3 * ? *",
    });

    const next = plan.next(new Date("2024-04-25T00:00:00.000Z"));
    expect(next?.toISOString()).toBe("2024-04-27T05:30:00.000Z");
  });

  it("handles last-weekday tokens in the day-of-week field", () => {
    const plan = createCronPlan({
      kind: "cron",
      expression: "0 0 12 ? * 5L *",
    });

    const next = plan.next(new Date("2024-01-24T00:00:00.000Z"));
    expect(next?.toISOString()).toBe("2024-01-26T12:00:00.000Z"); // last Friday of Jan 2024
  });

  it("resolves nth-in-month (#) semantics", () => {
    const plan = createCronPlan({
      kind: "cron",
      expression: "0 45 6 ? * 2#3 *",
    });

    const next = plan.next(new Date("2024-05-20T00:00:00.000Z"));
    expect(next?.toISOString()).toBe("2024-05-21T06:45:00.000Z"); // third Tuesday in May 2024
  });

  it("treats '?' as a true placeholder for the opposing field", () => {
    const plan = createCronPlan({
      kind: "cron",
      expression: "0 15 10 10 * ? *",
    });

    const next = plan.next(new Date("2024-08-09T00:00:00.000Z"));
    expect(next?.toISOString()).toBe("2024-08-10T10:15:00.000Z"); // Saturday is allowed
  });
});

describe("planner/cron - calendars", () => {
  it("restricts executions to explicitly included dates", () => {
    const plan = createCronPlan({
      kind: "cron",
      expression: "0 0 9 * * ? *",
      calendars: [{ include: ["2024-03-02"] }],
    });

    const next = plan.next(new Date("2024-03-02T00:00:00.000Z"));
    expect(next?.toISOString()).toBe("2024-03-02T09:00:00.000Z");
  });

  it("skips excluded dates before finding the next allowed occurrence", () => {
    const plan = createCronPlan({
      kind: "cron",
      expression: "0 0 9 * * ? *",
      calendars: [{ exclude: ["2024-03-02"] }],
    });

    const next = plan.next(new Date("2024-03-02T00:00:00.000Z"));
    expect(next?.toISOString()).toBe("2024-03-03T09:00:00.000Z");
  });

  it("evaluates include/exclude calendars using the trigger timezone", () => {
    const plan = createCronPlan({
      kind: "cron",
      expression: "0 0 9 * * ? *",
      timezone: "Pacific/Auckland",
      calendars: [{ include: ["2024-03-11"], exclude: ["2024-03-12"] }],
    });

    const next = plan.next(new Date("2024-03-10T00:00:00.000Z"));
    expect(next?.toISOString()).toBe("2024-03-10T20:00:00.000Z"); // 2024-03-11 09:00 local time
  });
});
