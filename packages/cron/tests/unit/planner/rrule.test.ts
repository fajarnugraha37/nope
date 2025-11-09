import { describe, expect, it } from "bun:test";
import { createRRulePlan } from "../../../src/planner/rrule.js";

const iso = (date: Date | undefined) => date?.toISOString();

describe("planner/rrule", () => {
  it("generates daily occurrences with interval", () => {
    const plan = createRRulePlan({
      kind: "rrule",
      rrule: "FREQ=DAILY;INTERVAL=2",
      startAt: new Date("2024-01-01T00:00:00.000Z"),
    });

    const next = plan.next(new Date("2023-12-31T23:00:00.000Z"));
    expect(iso(next)).toBe("2024-01-01T00:00:00.000Z");
    const after = plan.next(new Date("2024-01-01T00:00:00.000Z"));
    expect(iso(after)).toBe("2024-01-03T00:00:00.000Z");
  });

  it("filters occurrences via BYDAY and timezone", () => {
    const plan = createRRulePlan({
      kind: "rrule",
      rrule: "FREQ=WEEKLY;BYDAY=MO,WE,FR",
      startAt: new Date("2024-04-01T05:00:00.000Z"),
      timezone: "Asia/Jakarta",
    });

    const next = plan.next(new Date("2024-04-02T00:00:00.000Z"));
    expect(iso(next)).toBe("2024-04-03T05:00:00.000Z"); // Wednesday
  });

  it("honors BYHOUR/BYMINUTE in the trigger timezone", () => {
    const plan = createRRulePlan({
      kind: "rrule",
      rrule: "FREQ=DAILY;BYHOUR=9;BYMINUTE=30",
      startAt: new Date("2024-04-01T00:00:00.000Z"),
      timezone: "Asia/Tokyo",
    });

    const next = plan.next(new Date("2024-04-01T00:00:00.000Z"));
    expect(iso(next)).toBe("2024-04-01T00:30:00.000Z"); // 09:30 local == 00:30 UTC
  });

  it("supports monthly BYSETPOS semantics", () => {
    const plan = createRRulePlan({
      kind: "rrule",
      rrule: "FREQ=MONTHLY;BYDAY=MO;BYSETPOS=1",
      startAt: new Date("2024-01-01T01:00:00.000Z"),
      timezone: "Pacific/Auckland",
    });

    const next = plan.next(new Date("2024-02-01T00:00:00.000Z"));
    expect(iso(next)).toBe("2024-02-05T01:00:00.000Z"); // first Monday Feb 2024
  });

  it("respects calendars include/exclude and exdates", () => {
    const plan = createRRulePlan({
      kind: "rrule",
      rrule: "FREQ=DAILY",
      startAt: new Date("2024-01-01T00:00:00.000Z"),
      calendars: [
        { include: ["2024-01-02", "2024-01-03"] },
        { exclude: ["2024-01-04"] },
      ],
      exdates: [new Date("2024-01-02T00:00:00.000Z")],
    });

    const next = plan.next(new Date("2023-12-31T00:00:00.000Z"));
    expect(iso(next)).toBe("2024-01-03T00:00:00.000Z");
  });

  it("supports wildcard calendar entries", () => {
    const plan = createRRulePlan({
      kind: "rrule",
      rrule: "FREQ=DAILY",
      startAt: new Date("2024-01-01T00:00:00.000Z"),
      calendars: [{ include: ["2024-*-01"] }],
    });

    const next = plan.next(new Date("2024-02-15T00:00:00.000Z"));
    expect(iso(next)).toBe("2024-03-01T00:00:00.000Z");
  });

  it("applies BYSECOND filters within each occurrence", () => {
    const plan = createRRulePlan({
      kind: "rrule",
      rrule: "FREQ=DAILY;BYSECOND=45",
      startAt: new Date("2024-05-01T00:00:05.000Z"),
    });

    const next = plan.next(new Date("2024-05-01T00:00:10.000Z"));
    expect(iso(next)).toBe("2024-05-01T00:00:45.000Z");
  });

  it("supports BYSETPOS selections for weekly rules", () => {
    const plan = createRRulePlan({
      kind: "rrule",
      rrule: "FREQ=WEEKLY;BYDAY=MO,WE,FR;BYSETPOS=2",
      startAt: new Date("2024-04-01T00:00:00.000Z"),
    });

    const first = plan.next(new Date("2024-03-31T23:00:00.000Z"));
    expect(iso(first)).toBe("2024-04-03T00:00:00.000Z");

    const second = plan.next(new Date("2024-04-07T23:00:00.000Z"));
    expect(iso(second)).toBe("2024-04-10T00:00:00.000Z");
  });

  it("handles negative BYSETPOS for weekly rules", () => {
    const plan = createRRulePlan({
      kind: "rrule",
      rrule: "FREQ=WEEKLY;BYDAY=MO,WE,FR;BYSETPOS=-1",
      startAt: new Date("2024-04-01T00:00:00.000Z"),
    });

    const next = plan.next(new Date("2024-03-31T23:00:00.000Z"));
    expect(iso(next)).toBe("2024-04-05T00:00:00.000Z");
  });
});
