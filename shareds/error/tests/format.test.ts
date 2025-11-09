import { describe, test, expect } from "bun:test";
import { format, formatOneLine, formatVerbose } from "../src/format";
import { error } from "../src/app-error";

describe("format", () => {
  test("formats non-AppError Error instances", () => {
    const err = new Error("native error");
    const formatted = format(err);
    expect(formatted).toBe("Error: native error");
  });

  test("formats non-AppError Error with short option", () => {
    const err = new Error("native error");
    const formatted = format(err, { short: true });
    expect(formatted).toBe("native error");
  });

  test("formats non-Error values", () => {
    expect(format("string error")).toBe("string error");
    expect(format(42)).toBe("42");
    expect(format(null)).toBe("null");
    expect(format(undefined)).toBe("undefined");
  });

  test("formats AppError with all fields", () => {
    const err = error("test/error", "test message", {
      status: 500,
      severity: "error",
      retryable: true,
      tags: ["tag1", "tag2"],
      data: { key: "value" },
    });
    const formatted = format(err);
    expect(formatted).toContain("AppError: test/error");
    expect(formatted).toContain("Message: test message");
    expect(formatted).toContain("ID:");
    expect(formatted).toContain("Severity: error");
    expect(formatted).toContain("Status: 500");
    expect(formatted).toContain("Retryable: true");
    expect(formatted).toContain("Tags: tag1, tag2");
    expect(formatted).toContain('Data: {"key":"value"}');
  });

  test("formats AppError with cause as Error", () => {
    const cause = new Error("cause error");
    const err = error("test/error", "test message", { cause });
    const formatted = format(err);
    expect(formatted).toContain("Cause: Error: cause error");
  });

  test("formats AppError with cause as non-Error", () => {
    const err = error("test/error", "test message", { cause: "string cause" });
    const formatted = format(err);
    expect(formatted).toContain("Cause: string cause");
  });

  test("formats AppError with stack", () => {
    const err = error("test/error", "test");
    const formatted = format(err, { stack: true });
    expect(formatted).toContain("\nStack:\n");
    expect(formatted).toContain("AppError");
  });

  test("formatOneLine returns short format", () => {
    const err = error("test/error", "test message");
    const formatted = formatOneLine(err);
    expect(formatted).toBe("[test/error] test message");
  });

  test("formatVerbose returns full format with stack", () => {
    const err = error("test/error", "test message");
    const formatted = formatVerbose(err);
    expect(formatted).toContain("AppError: test/error");
    expect(formatted).toContain("Stack:");
  });

  test("formats AppError without optional fields", () => {
    const err = error("test/error", "minimal");
    const formatted = format(err);
    expect(formatted).not.toContain("Status:");
    expect(formatted).not.toContain("Retryable:");
    expect(formatted).not.toContain("Tags:");
    expect(formatted).not.toContain("Data:");
    expect(formatted).not.toContain("Cause:");
  });
});
