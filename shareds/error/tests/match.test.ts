import { describe, test, expect } from "bun:test";
import { match } from "../src/match";
import { error, fromUnknown } from "../src/app-error";

describe("match", () => {
  test("matches specific error code", () => {
    const err = error("db/timeout", "Database timeout");
    const result = match(err, {
      "db/timeout": (e) => `handled: ${e.message}`,
      _: () => "fallback",
    });
    expect(result).toBe("handled: Database timeout");
  });

  test("uses fallback handler for unknown code", () => {
    const err = error("unknown/error", "Unknown error");
    const result = match(err, {
      "db/timeout": () => "timeout",
      "api/error": () => "api error",
      _: (e) => `fallback: ${e.code}`,
    });
    expect(result).toBe("fallback: unknown/error");
  });

  test("throws error when no matching handler and no fallback", () => {
    const err = error("unknown/error", "Unknown");
    expect(() => {
      match(err, {
        "db/timeout": () => "timeout",
      });
    }).toThrow("No handler found for error code: unknown/error");
  });

  test("handles non-AppError with fallback handler", () => {
    const nativeError = new Error("Native error");
    const result = match(nativeError, {
      "test/error": () => "test",
      _: (e) => `fallback: ${e.code}`,
    });
    expect(result).toBe("fallback: error/from-unknown");
  });

  test("throws when matching non-AppError without fallback", () => {
    const nativeError = new Error("Native error");
    expect(() => {
      match(nativeError, {
        "test/error": () => "test",
      });
    }).toThrow("match() requires AppError or a fallback handler '_'");
  });

  test("handles multiple specific handlers", () => {
    const err1 = error("db/connection", "DB connection failed");
    const err2 = error("api/timeout", "API timeout");
    
    const handlers = {
      "db/connection": () => "db-handler",
      "api/timeout": () => "api-handler",
      _: () => "default",
    };

    expect(match(err1, handlers)).toBe("db-handler");
    expect(match(err2, handlers)).toBe("api-handler");
  });

  test("passes full error object to handler", () => {
    const err = error("test/error", "Test message", {
      status: 404,
      data: { key: "value" },
    });
    const result = match(err, {
      "test/error": (e) => ({
        code: e.code,
        message: e.message,
        status: e.status,
        data: e.data,
      }),
      _: () => ({}),
    });
    expect(result).toEqual({
      code: "test/error",
      message: "Test message",
      status: 404,
      data: { key: "value" },
    });
  });
});
