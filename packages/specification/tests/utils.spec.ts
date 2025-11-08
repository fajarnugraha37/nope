import { describe, expect, it } from "bun:test";
import { SpecificationError, asyncRequiredError } from "../src/utils/errors";
import { stableStringify, defaultHasher } from "../src/utils/hash";
import { timeIt, timeItAsync } from "../src/utils/timing";

describe("Utils - Errors", () => {
  it("creates SpecificationError with code and message", () => {
    const error = new SpecificationError("SPEC_INVALID_OPERATOR", "Invalid operator");
    expect(error.code).toBe("SPEC_INVALID_OPERATOR");
    expect(error.message).toBe("Invalid operator");
    expect(error.name).toBe("SpecificationError");
    expect(error.path).toBeUndefined();
    expect(error.meta).toBeUndefined();
  });

  it("creates SpecificationError with path and meta", () => {
    const error = new SpecificationError(
      "SPEC_VALIDATION",
      "Validation failed",
      "user.age",
      { min: 18, max: 65 }
    );
    expect(error.code).toBe("SPEC_VALIDATION");
    expect(error.message).toBe("Validation failed");
    expect(error.path).toBe("user.age");
    expect(error.meta).toEqual({ min: 18, max: 65 });
  });

  it("creates async required error", () => {
    const error = asyncRequiredError("spec_123");
    expect(error.code).toBe("SPEC_ASYNC_REQUIRED");
    expect(error.message).toBe('Specification "spec_123" must be evaluated asynchronously.');
    expect(error.name).toBe("SpecificationError");
  });

  it("supports all error codes", () => {
    const codes = [
      "SPEC_INVALID_OPERATOR",
      "SPEC_ASYNC_REQUIRED",
      "SPEC_REGISTRY_DUPLICATE",
      "SPEC_REGISTRY_UNKNOWN",
      "SPEC_AST_INVALID",
      "SPEC_ADAPTER_UNSUPPORTED",
      "SPEC_VALIDATION",
    ] as const;

    codes.forEach((code) => {
      const error = new SpecificationError(code, "Test error");
      expect(error.code).toBe(code);
    });
  });
});

describe("Utils - Hash", () => {
  it("stringifies primitives", () => {
    expect(stableStringify(null)).toBe("null");
    expect(stableStringify(42)).toBe("42");
    expect(stableStringify("hello")).toBe('"hello"');
    expect(stableStringify(true)).toBe("true");
    expect(stableStringify(false)).toBe("false");
  });

  it("stringifies arrays", () => {
    expect(stableStringify([1, 2, 3])).toBe("[1,2,3]");
    expect(stableStringify(["a", "b", "c"])).toBe('["a","b","c"]');
    expect(stableStringify([1, "two", true, null])).toBe('[1,"two",true,null]');
  });

  it("stringifies objects with sorted keys", () => {
    const obj = { c: 3, a: 1, b: 2 };
    expect(stableStringify(obj)).toBe('{"a":1,"b":2,"c":3}');
  });

  it("stringifies nested objects and arrays", () => {
    const nested = {
      users: [{ name: "Alice", age: 30 }, { name: "Bob", age: 25 }],
      count: 2,
    };
    const result = stableStringify(nested);
    expect(result).toContain('"count":2');
    expect(result).toContain('"users":[');
    expect(result).toContain('"age":30');
    expect(result).toContain('"name":"Alice"');
  });

  it("produces stable output regardless of key order", () => {
    const obj1 = { a: 1, b: 2, c: 3 };
    const obj2 = { c: 3, b: 2, a: 1 };
    expect(stableStringify(obj1)).toBe(stableStringify(obj2));
  });

  it("defaultHasher wraps value with root key", () => {
    const hash1 = defaultHasher({ name: "Alice", age: 30 });
    const hash2 = defaultHasher({ age: 30, name: "Alice" });
    expect(hash1).toBe(hash2);
    expect(hash1).toContain("__root__");
  });

  it("defaultHasher produces consistent hashes", () => {
    const value = { items: [1, 2, 3], active: true };
    const hash1 = defaultHasher(value);
    const hash2 = defaultHasher(value);
    expect(hash1).toBe(hash2);
  });

  it("defaultHasher produces different hashes for different values", () => {
    const hash1 = defaultHasher({ name: "Alice" });
    const hash2 = defaultHasher({ name: "Bob" });
    expect(hash1).not.toBe(hash2);
  });
});

describe("Utils - Timing", () => {
  it("measures synchronous function execution time", () => {
    const result = timeIt(() => {
      let sum = 0;
      for (let i = 0; i < 1000; i++) {
        sum += i;
      }
      return sum;
    });

    expect(result.result).toBe(499500);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.durationMs).toBe("number");
  });

  it("measures function that returns immediately", () => {
    const result = timeIt(() => 42);
    expect(result.result).toBe(42);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("measures async function execution time", async () => {
    const result = await timeItAsync(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return "done";
    });

    expect(result.result).toBe("done");
    expect(result.durationMs).toBeGreaterThanOrEqual(10);
    expect(typeof result.durationMs).toBe("number");
  });

  it("measures async function that resolves immediately", async () => {
    const result = await timeItAsync(async () => Promise.resolve(123));
    expect(result.result).toBe(123);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("preserves thrown errors in sync timeIt", () => {
    expect(() => {
      timeIt(() => {
        throw new Error("Test error");
      });
    }).toThrow("Test error");
  });

  it("preserves rejected promises in async timeItAsync", async () => {
    await expect(
      timeItAsync(async () => {
        throw new Error("Async error");
      })
    ).rejects.toThrow("Async error");
  });
});
