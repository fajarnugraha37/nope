import { describe, test, expect } from "bun:test";
import { redact, safeStringify } from "../src/redact";

describe("redact", () => {
  test("redacts sensitive keys by default", () => {
    const obj = { 
      password: "secret123", 
      name: "John",
      apiKey: "abc123",
      token: "xyz789"
    };
    
    const redacted = redact(obj) as any;
    expect(redacted.password).toBe("[REDACTED]");
    expect(redacted.apiKey).toBe("[REDACTED]");
    expect(redacted.token).toBe("[REDACTED]");
    expect(redacted.name).toBe("John");
  });

  test("handles max depth protection (>10 levels)", () => {
    const deep: any = { level: 1 };
    let current = deep;
    for (let i = 2; i <= 15; i++) {
      current.nested = { level: i };
      current = current.nested;
    }
    
    const redacted = redact(deep) as any;
    expect(redacted).toBeDefined();
    // Should have stopped at depth 10
    let check: any = redacted;
    let depth = 0;
    while (check && typeof check === 'object' && check.nested) {
      depth++;
      check = check.nested;
      if (depth > 12) break;
    }
    expect(depth).toBeLessThanOrEqual(11);
  });

  test("handles array truncation for large arrays", () => {
    const largeArray = Array.from({ length: 1500 }, (_, i) => i);
    const obj = { items: largeArray };
    
    const redacted = redact(obj) as any;
    expect(Array.isArray(redacted.items)).toBe(true);
    // MAX_SIZE is 1000, so arrays over that get truncated
    expect(redacted.items.length).toBe(1001); // 1000 items + "[TRUNCATED]" marker
    expect(redacted.items[redacted.items.length - 1]).toBe("[TRUNCATED]");
  });

  test("serializes Date objects to ISO string", () => {
    const date = new Date("2024-01-15T10:30:00Z");
    const obj = { created: date };
    
    const redacted = redact(obj) as any;
    expect(redacted.created).toBe("2024-01-15T10:30:00.000Z");
  });

  test("handles Error objects", () => {
    const error = new Error("Test error");
    const obj = { error };
    
    const redacted = redact(obj) as any;
    expect(redacted.error).toHaveProperty("name");
    expect(redacted.error).toHaveProperty("message");
    expect(redacted.error.message).toBe("Test error");
  });

  test("truncates large objects (>1000 properties)", () => {
    const largeObj: Record<string, number> = {};
    for (let i = 0; i < 1500; i++) {
      largeObj[`key${i}`] = i;
    }
    
    const redacted = redact(largeObj) as any;
    const keys = Object.keys(redacted);
    expect(keys.length).toBeLessThanOrEqual(1005); // 1000 keys + truncation marker
  });

  test("uses custom predicate function", () => {
    const obj = { 
      email: "user@example.com",
      name: "John",
      ssn: "123-45-6789"
    };
    
    const predicate = (keyPath: string[]) => {
      const key = keyPath[keyPath.length - 1];
      return key === "email" || key === "ssn";
    };
    const redacted = redact(obj, predicate) as any;
    
    expect(redacted.email).toBe("[REDACTED]");
    expect(redacted.ssn).toBe("[REDACTED]");
    expect(redacted.name).toBe("John");
  });

  test("handles circular references", () => {
    const obj: any = { name: "John" };
    obj.self = obj;
    
    const redacted = redact(obj) as any;
    expect(redacted.name).toBe("John");
    expect(redacted.self).toBe("[CIRCULAR]");
  });

  test("preserves nested structure", () => {
    const obj = {
      user: {
        name: "John",
        credentials: {
          password: "secret",
          apiKey: "key123"
        }
      }
    };
    
    const redacted = redact(obj) as any;
    expect(redacted.user.name).toBe("John");
    expect(redacted.user.credentials.password).toBe("[REDACTED]");
    expect(redacted.user.credentials.apiKey).toBe("[REDACTED]");
  });

  test("handles null and undefined", () => {
    const obj = { a: null, b: undefined };
    const redacted = redact(obj) as any;
    expect(redacted.a).toBeNull();
    expect(redacted.b).toBeUndefined();
  });

  test("handles primitives", () => {
    expect(redact("string")).toBe("string");
    expect(redact(123)).toBe(123);
    expect(redact(true)).toBe(true);
    expect(redact(null)).toBeNull();
  });

  test("handles arrays with objects", () => {
    const obj = {
      users: [
        { name: "John", password: "secret1" },
        { name: "Jane", password: "secret2" }
      ]
    };
    
    const redacted = redact(obj) as any;
    expect(redacted.users[0].name).toBe("John");
    expect(redacted.users[0].password).toBe("[REDACTED]");
    expect(redacted.users[1].name).toBe("Jane");
    expect(redacted.users[1].password).toBe("[REDACTED]");
  });

  test("handles mixed nested structures", () => {
    const obj = {
      level1: {
        level2: [
          { password: "secret", data: { level3: { token: "abc" } } }
        ]
      }
    };
    
    const redacted = redact(obj) as any;
    expect(redacted.level1.level2[0].password).toBe("[REDACTED]");
    expect(redacted.level1.level2[0].data.level3.token).toBe("[REDACTED]");
  });
});

describe("safeStringify", () => {
  test("stringifies simple objects", () => {
    const obj = { name: "John", age: 30 };
    const str = safeStringify(obj);
    expect(str).toBe('{"name":"John","age":30}');
  });

  test("handles circular references", () => {
    const obj: any = { name: "John" };
    obj.self = obj;
    
    const str = safeStringify(obj);
    expect(str).toContain('"name":"John"');
    expect(str).toContain('[CIRCULAR]');
  });

  test("uses custom predicate", () => {
    const obj = { name: "John", password: "secret" };
    const predicate = (keyPath: string[]) => {
      const key = keyPath[keyPath.length - 1];
      return key === "password";
    };
    
    const str = safeStringify(obj, predicate);
    expect(str).toContain('"password":"[REDACTED]"');
  });

  test("uses custom space for formatting", () => {
    const obj = { name: "John" };
    const str = safeStringify(obj, undefined, 2);
    expect(str).toContain("\n");
    expect(str).toContain("  ");
  });

  test("handles stringify errors gracefully", () => {
    const obj = {
      get toJSON() {
        throw new Error("JSON error");
      }
    };
    
    const str = safeStringify(obj);
    expect(str).toContain("[STRINGIFY_ERROR");
  });

  test("handles BigInt stringify error", () => {
    const obj = { big: BigInt(123) };
    const str = safeStringify(obj);
    // BigInt causes JSON.stringify to fail, which is caught
    expect(str).toContain("STRINGIFY_ERROR");
  });

  test("handles undefined values", () => {
    const obj = { a: undefined, b: "test" };
    const str = safeStringify(obj);
    expect(str).toBe('{"b":"test"}'); // undefined is omitted
  });

  test("handles Date objects", () => {
    const date = new Date("2024-01-15T10:30:00Z");
    const obj = { date };
    const str = safeStringify(obj);
    expect(str).toContain("2024-01-15");
  });
});
