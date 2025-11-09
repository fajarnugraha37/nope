import { describe, test, expect, mock } from "bun:test";
import { recordException, toSpanAttributes } from "../src/observability/otel";
import { AppError } from "../src/app-error";

describe("recordException", () => {
  test("records exception on valid span", () => {
    const mockSpan = {
      recordException: mock(() => {}),
      setStatus: mock(() => {}),
      setAttributes: mock(() => {}),
      isRecording: () => true,
    };

    const error = new AppError("TEST_ERROR", "Test error");
    recordException(mockSpan as any, error);

    expect(mockSpan.recordException).toHaveBeenCalled();
    expect(mockSpan.setStatus).toHaveBeenCalled();
  });

  test("sets span attributes from error", () => {
    const mockSpan = {
      recordException: mock(() => {}),
      setStatus: mock(() => {}),
      setAttributes: mock(() => {}),
      isRecording: () => true,
    };

    const error = new AppError("TEST_ERROR", "Test error", {
      status: 400,
      severity: "warn",
    });

    recordException(mockSpan as any, error);

    expect(mockSpan.setAttributes).toHaveBeenCalled();
  });

  test("calls recordException even if span not recording", () => {
    const mockSpan = {
      recordException: mock(() => {}),
      setStatus: mock(() => {}),
      setAttributes: mock(() => {}),
      isRecording: () => false,
    };

    const error = new AppError("TEST_ERROR", "Test error");
    recordException(mockSpan as any, error);

    // Function still records, isRecording is not checked in implementation
    expect(mockSpan.recordException).toHaveBeenCalled();
  });

  test("throws error for non-AppError", () => {
    const mockSpan = {
      recordException: mock(() => {}),
      setStatus: mock(() => {}),
      setAttribute: mock(() => {}),
      isRecording: () => true,
    };

    const error = new Error("Standard error");
    expect(() => recordException(mockSpan as any, error as any)).toThrow("recordException requires an AppError instance");
  });

  test("throws error for null span", () => {
    const error = new AppError("TEST_ERROR", "Test error");
    expect(() => recordException(null as any, error)).toThrow("Invalid OpenTelemetry Span");
  });

  test("throws error for undefined span", () => {
    const error = new AppError("TEST_ERROR", "Test error");
    expect(() => recordException(undefined as any, error)).toThrow("Invalid OpenTelemetry Span");
  });
});

describe("toSpanAttributes", () => {
  test("converts AppError to span attributes", () => {
    const error = new AppError("TEST_ERROR", "Test error", {
      status: 400,
      severity: "warn",
    });

    const attrs = toSpanAttributes(error);

    expect(attrs["error.code"]).toBe("TEST_ERROR");
    expect(attrs["error.message"]).toBe("Test error");
    expect(attrs["error.status"]).toBe(400);
    expect(attrs["error.severity"]).toBe("warn");
  });

  test("includes error ID", () => {
    const error = new AppError("TEST_ERROR", "Test error");
    const attrs = toSpanAttributes(error);

    expect(attrs["error.id"]).toBeDefined();
    expect(typeof attrs["error.id"]).toBe("string");
  });

  test("includes timestamp", () => {
    const error = new AppError("TEST_ERROR", "Test error");
    const attrs = toSpanAttributes(error);

    expect(attrs["error.timestamp"]).toBeDefined();
    expect(typeof attrs["error.timestamp"]).toBe("number");
  });

  test("includes retryable flag", () => {
    const error = new AppError("TEST_ERROR", "Test error", {
      retryable: true,
    });

    const attrs = toSpanAttributes(error);
    expect(attrs["error.retryable"]).toBe(true);
  });

  test("includes tags as comma-separated string", () => {
    const error = new AppError("TEST_ERROR", "Test error", {
      tags: ["validation", "user-input"],
    });

    const attrs = toSpanAttributes(error);
    expect(attrs["error.tags"]).toBe("validation,user-input");
  });

  test("omits empty tags array", () => {
    const error = new AppError("TEST_ERROR", "Test error", {
      tags: [],
    });

    const attrs = toSpanAttributes(error);
    expect(attrs["error.tags"]).toBeUndefined();
  });

  test("handles error without optional fields", () => {
    const error = new AppError("TEST_ERROR", "Test error");
    const attrs = toSpanAttributes(error);

    expect(attrs["error.code"]).toBe("TEST_ERROR");
    expect(attrs["error.message"]).toBe("Test error");
    expect(attrs["error.status"]).toBeUndefined();
  });

  test("includes all required attributes", () => {
    const error = new AppError("TEST_ERROR", "Test error");
    const attrs = toSpanAttributes(error);

    expect(attrs["error.type"]).toBe("AppError");
    expect(attrs["error.code"]).toBe("TEST_ERROR");
    expect(attrs["error.message"]).toBe("Test error");
    expect(attrs["error.id"]).toBeDefined();
    expect(attrs["error.severity"]).toBeDefined();
    expect(attrs["error.timestamp"]).toBeDefined();
  });
});
