import { describe, test, expect } from "bun:test";
import {
  AppError,
  error,
  wrap,
  fromUnknown,
  isAppError,
  isCode,
} from "../src/app-error";
import { match } from "../src/match";
import { assert } from "../src/assert";
import { format, formatOneLine } from "../src/format";
import { toProblem, fromProblem } from "../src/problem";
import { redact, safeStringify } from "../src/redact";

describe("AppError", () => {
  test("creates error with minimal options", () => {
    const err = error("test/error", "test message");
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe("test/error");
    expect(err.message).toBe("test message");
    expect(err.severity).toBe("error");
    expect(err.retryable).toBe(false);
    expect(err.id).toBeTruthy();
    expect(err.timestamp).toBeGreaterThan(0);
  });

  test("creates error with full options", () => {
    const err = error("test/error", "test message", {
      severity: "warn",
      status: 400,
      retryable: true,
      tags: ["tag1", "tag2"],
      data: { foo: "bar" },
    });
    expect(err.severity).toBe("warn");
    expect(err.status).toBe(400);
    expect(err.retryable).toBe(true);
    expect(err.tags).toEqual(["tag1", "tag2"]);
    expect(err.data).toEqual({ foo: "bar" });
  });

  test("error is frozen", () => {
    const err = error("test/error");
    expect(Object.isFrozen(err)).toBe(true);
  });

  test("generates unique IDs", () => {
    const err1 = error("test/error");
    const err2 = error("test/error");
    expect(err1.id).not.toBe(err2.id);
  });

  test("includes normalized stack", () => {
    const err = error("test/error", "test");
    expect(err.stack).toBeTruthy();
    expect(err.stack).toContain("AppError");
  });
});

describe("wrap", () => {
  test("wraps native error", () => {
    const native = new Error("native error");
    const wrapped = wrap(native, "wrapped/error");
    expect(wrapped.code).toBe("wrapped/error");
    expect(wrapped.message).toBe("native error");
    expect(wrapped.cause).toBe(native);
  });

  test("returns AppError unchanged", () => {
    const appErr = error("test/error");
    const wrapped = wrap(appErr);
    expect(wrapped).toBe(appErr);
  });

  test("wraps string", () => {
    const wrapped = wrap("string error", "wrapped/string");
    expect(wrapped.code).toBe("wrapped/string");
    expect(wrapped.message).toBe("string error");
  });
});

describe("fromUnknown", () => {
  test("returns AppError unchanged", () => {
    const appErr = error("test/error");
    const result = fromUnknown(appErr);
    expect(result).toBe(appErr);
  });

  test("converts native Error", () => {
    const native = new Error("native");
    const result = fromUnknown(native);
    expect(result.code).toBe("error/from-unknown");
    expect(result.message).toBe("native");
    expect(result.cause).toBe(native);
  });

  test("converts string", () => {
    const result = fromUnknown("error string");
    expect(result.code).toBe("error/from-unknown");
    expect(result.message).toBe("error string");
  });

  test("converts object", () => {
    const result = fromUnknown({ message: "obj error" });
    expect(result.code).toBe("error/from-unknown");
    expect(result.message).toBe("obj error");
  });

  test("converts primitive", () => {
    const result = fromUnknown(42);
    expect(result.code).toBe("error/from-unknown");
    expect(result.message).toBe("42");
  });
});

describe("isAppError", () => {
  test("identifies AppError", () => {
    const err = error("test/error");
    expect(isAppError(err)).toBe(true);
  });

  test("rejects non-AppError", () => {
    expect(isAppError(new Error())).toBe(false);
    expect(isAppError("string")).toBe(false);
    expect(isAppError(null)).toBe(false);
  });
});

describe("isCode", () => {
  test("matches code", () => {
    const err = error("test/error");
    expect(isCode(err, "test/error")).toBe(true);
  });

  test("rejects different code", () => {
    const err = error("test/error");
    expect(isCode(err, "other/error")).toBe(false);
  });

  test("rejects non-AppError", () => {
    expect(isCode(new Error(), "test")).toBe(false);
  });
});

describe("match", () => {
  test("matches specific code", () => {
    const err = error("db/timeout");
    const result = match(err, {
      "db/timeout": () => "timeout handled",
      _: () => "fallback",
    });
    expect(result).toBe("timeout handled");
  });

  test("uses fallback", () => {
    const err = error("unknown/error");
    const result = match(err, {
      "db/timeout": () => "timeout",
      _: () => "fallback",
    });
    expect(result).toBe("fallback");
  });

  test("throws without fallback and no match", () => {
    const err = error("unknown/error");
    expect(() => match(err, { "db/timeout": () => "timeout" })).toThrow();
  });
});

describe("assert", () => {
  test("assert.ok passes when true", () => {
    expect(() => assert.ok(true, "test/error")).not.toThrow();
  });

  test("assert.ok throws when false", () => {
    expect(() => assert.ok(false, "test/error", "failed")).toThrow(AppError);
  });

  test("assert.defined passes for non-null", () => {
    expect(() => assert.defined("value", "test/error")).not.toThrow();
  });

  test("assert.defined throws for null", () => {
    expect(() => assert.defined(null, "test/error")).toThrow(AppError);
  });

  test("assert.type checks type", () => {
    expect(() => assert.type("str", "string", "test/error")).not.toThrow();
    expect(() => assert.type(42, "string", "test/error")).toThrow(AppError);
  });

  test("assert.fail always throws", () => {
    expect(() => assert.fail("test/error", "failure")).toThrow(AppError);
  });
});

describe("format", () => {
  test("formats short", () => {
    const err = error("test/error", "test message");
    const formatted = formatOneLine(err);
    expect(formatted).toBe("[test/error] test message");
  });

  test("formats verbose", () => {
    const err = error("test/error", "test message", {
      status: 500,
      tags: ["tag1"],
    });
    const formatted = format(err);
    expect(formatted).toContain("test/error");
    expect(formatted).toContain("test message");
    expect(formatted).toContain("Status: 500");
    expect(formatted).toContain("Tags: tag1");
  });

  test("formats with stack", () => {
    const err = error("test/error", "test");
    const formatted = format(err, { stack: true });
    expect(formatted).toContain("Stack:");
  });
});

describe("Problem Details (RFC 9457)", () => {
  test("converts to problem", () => {
    const err = error("test/error", "test message", {
      status: 404,
      severity: "warn",
    });
    const problem = toProblem(err);
    expect(problem.type).toBe("urn:error:test/error");
    expect(problem.title).toBe("test/error");
    expect(problem.status).toBe(404);
    expect(problem.detail).toBe("test message");
    expect(problem.severity).toBe("warn");
  });

  test("converts from problem", () => {
    const problem = {
      type: "urn:error:test/error",
      title: "test/error",
      status: 404,
      detail: "test message",
    };
    const err = fromProblem(problem);
    expect(err.code).toBe("test/error");
    expect(err.message).toBe("test message");
    expect(err.status).toBe(404);
  });

  test("round-trips problem details", () => {
    const original = error("test/error", "test message", {
      status: 500,
      severity: "error",
      retryable: true,
    });
    const problem = toProblem(original);
    const restored = fromProblem(problem);
    expect(restored.code).toBe(original.code);
    expect(restored.message).toBe(original.message);
    expect(restored.status).toBe(original.status);
    expect(restored.severity).toBe(original.severity);
    expect(restored.retryable).toBe(original.retryable);
  });
});

describe("Redaction", () => {
  test("redacts sensitive keys", () => {
    const data = {
      username: "john",
      password: "secret123",
      token: "abc123",
    };
    const redacted = redact(data);
    expect(redacted).toEqual({
      username: "john",
      password: "[REDACTED]",
      token: "[REDACTED]",
    });
  });

  test("handles nested objects", () => {
    const data = {
      user: {
        name: "john",
        password: "secret",
      },
    };
    const redacted = redact(data);
    expect((redacted as any).user.password).toBe("[REDACTED]");
  });

  test("handles circular references", () => {
    const obj: any = { name: "test" };
    obj.self = obj;
    const redacted = redact(obj);
    expect((redacted as any).self).toBe("[CIRCULAR]");
  });

  test("safeStringify works", () => {
    const data = { password: "secret", name: "john" };
    const json = safeStringify(data);
    expect(json).toContain('"password":"[REDACTED]"');
    expect(json).toContain('"name":"john"');
  });
});

describe("toJSON", () => {
  test("serializes to JSON", () => {
    const err = error("test/error", "test message", {
      data: { foo: "bar" },
      tags: ["tag1"],
    });
    const json = err.toJSON();
    expect(json.code).toBe("test/error");
    expect(json.message).toBe("test message");
    expect(json.data).toEqual({ foo: "bar" });
    expect(json.tags).toEqual(["tag1"]);
  });
});
