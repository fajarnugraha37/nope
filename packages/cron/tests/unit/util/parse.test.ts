import { describe, expect, it } from "bun:test";
import { coerceDate, parseHumanDuration } from "../../../src/util/parse.js";

describe("util/parse", () => {
  it("parses numeric durations and unit suffixes", () => {
    expect(parseHumanDuration(500)).toBe(500);
    expect(parseHumanDuration("1500")).toBe(1500);
    expect(parseHumanDuration("5m")).toBe(5 * 60_000);
  });

  it("rejects invalid duration strings", () => {
    expect(() => parseHumanDuration("")).toThrow("Duration cannot be empty");
    expect(() => parseHumanDuration("ten minutes")).toThrow("Unsupported duration");
  });

  it("coerces various date representations", () => {
    const now = new Date("2024-05-01T00:00:00.000Z");
    expect(coerceDate(now)).toBe(now);
    expect(coerceDate(now.getTime()).toISOString()).toBe(now.toISOString());
    expect(coerceDate("2024-05-01T00:00:00.000Z").toISOString()).toBe(now.toISOString());
  });

  it("throws for invalid date strings", () => {
    expect(() => coerceDate("not-a-date")).toThrow("Invalid date value");
  });
});
