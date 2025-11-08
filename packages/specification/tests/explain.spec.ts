import { describe, test, expect } from "bun:test";
import { spec, enhanceExplainTree, formatExplainTree } from "../src/index.js";

describe("Enhanced Explain Functionality", () => {
  describe("Sync explain with failure reasons", () => {
    test("eq operator shows expected vs actual", () => {
      const ageSpec = spec.field<{ age: number }>("age").eq(18);
      const node = ageSpec.explain({ age: 16 });

      expect(node.pass).toBe(false);
      expect(node.operator).toBe("eq");
      expect(node.actualValue).toBe(16);
      expect(node.expectedValue).toBe(18);
      expect(node.path).toBe("age");
    });

    test("gte operator shows expected vs actual", () => {
      const ageSpec = spec.field<{ age: number }>("age").gte(18);
      const node = ageSpec.explain({ age: 16 });

      expect(node.pass).toBe(false);
      expect(node.operator).toBe("gte");
      expect(node.actualValue).toBe(16);
      expect(node.expectedValue).toBe(18);
    });

    test("lt operator shows expected vs actual", () => {
      const ageSpec = spec.field<{ age: number }>("age").lt(18);
      const node = ageSpec.explain({ age: 25 });

      expect(node.pass).toBe(false);
      expect(node.operator).toBe("lt");
      expect(node.actualValue).toBe(25);
      expect(node.expectedValue).toBe(18);
    });

    test("in operator shows expected values", () => {
      const statusSpec = spec.field<{ status: string }>("status").in(["active", "pending"]);
      const node = statusSpec.explain({ status: "archived" });

      expect(node.pass).toBe(false);
      expect(node.operator).toBe("in");
      expect(node.actualValue).toBe("archived");
      expect(node.expectedValue).toEqual(["active", "pending"]);
    });

    test("contains operator for strings", () => {
      const emailSpec = spec.field<{ email: string }>("email").contains("@example.com");
      const node = emailSpec.explain({ email: "user@test.com" });

      expect(node.pass).toBe(false);
      expect(node.operator).toBe("contains");
      expect(node.actualValue).toBe("user@test.com");
      expect(node.expectedValue).toBe("@example.com");
    });

    test("exists operator shows undefined", () => {
      const nameSpec = spec.field<{ name?: string }>("name").exists();
      const node = nameSpec.explain({});

      expect(node.pass).toBe(false);
      expect(node.operator).toBe("exists");
      expect(node.actualValue).toBe(undefined);
    });
  });

  describe("Async explain functionality", () => {
    test("explainAsync evaluates specs with timing", async () => {
      const ageSpec = spec.field<{ value: number }>("value").gt(10);

      const node = await ageSpec.explainAsync!({ value: 5 });

      expect(node.pass).toBe(false);
      expect(node.durationMs).toBeGreaterThanOrEqual(0);
    });

    test("explainAsync works with passing specs", async () => {
      const ageSpec = spec.field<{ value: number }>("value").gt(10);

      const node = await ageSpec.explainAsync!({ value: 15 });

      expect(node.pass).toBe(true);
      expect(node.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Composite spec explain with nested context", () => {
    test("AND composite propagates children results", () => {
      const userSpec = spec
        .field<{ age: number; email: string }>("age")
        .gte(18)
        .and(spec.field("email").contains("@"));

      const node = userSpec.explain({ age: 16, email: "user@test.com" });

      expect(node.pass).toBe(false);
      expect(node.operator).toBe("and");
      expect(node.children).toHaveLength(2);
      expect(node.children![0]!.pass).toBe(false); // age failed
      expect(node.children![1]!.pass).toBe(true); // email passed
    });

    test("OR composite shows all failures when all fail", () => {
      const userSpec = spec
        .field<{ age: number; status: string }>("age")
        .lt(13)
        .or(spec.field("status").eq("child"));

      const node = userSpec.explain({ age: 25, status: "adult" });

      expect(node.pass).toBe(false);
      expect(node.operator).toBe("or");
      expect(node.children).toHaveLength(2);
      expect(node.children![0]!.pass).toBe(false);
      expect(node.children![1]!.pass).toBe(false);
    });

    test("NOT composite shows correct reason", () => {
      const notAdultSpec = spec.field<{ age: number }>("age").gte(18).not();

      const node = notAdultSpec.explain({ age: 25 });

      // NOT of sync specs returns "unknown" since it needs async eval
      expect(node.pass).toBe("unknown");
      expect(node.operator).toBe("not");
      expect(node.children).toHaveLength(1);
    });

    test("deeply nested composites maintain context", () => {
      type User = { age: number; email: string; active: boolean };
      const ageSpec = spec.field<User>("age").gte(18);
      const emailSpec = spec.field<User>("email").contains("@");
      const activeSpec = spec.field<User>("active").eq(true);
      
      const complexSpec = ageSpec.and(emailSpec.and(activeSpec));

      const node = complexSpec.explain({
        age: 25,
        email: "invalid-email",
        active: false,
      });

      expect(node.pass).toBe(false);
      expect(node.children).toHaveLength(2);
      expect(node.children![0]!.pass).toBe(true); // age passed
      expect(node.children![1]!.pass).toBe(false); // nested AND failed
      expect(node.children![1]!.children).toHaveLength(2);
    });
  });

  describe("Async composite explain", () => {
    test("explainAsync handles composite specs", async () => {
      type User = { age: number; email: string };
      const ageSpec = spec.field<User>("age").gte(18);
      const emailSpec = spec.field<User>("email").contains("@");

      const combined = ageSpec.and(emailSpec);
      const node = await combined.explainAsync!({ age: 25, email: "test@example.com" });

      expect(node.pass).toBe(true);
      expect(node.operator).toBe("and");
      expect(node.children).toHaveLength(2);
      expect(node.durationMs).toBeGreaterThanOrEqual(0);
    });

    test("explainAsync captures timing", async () => {
      type Data = { a: number; b: number };
      const spec1 = spec.field<Data>("a").gt(0);
      const spec2 = spec.field<Data>("b").gt(0);

      const combined = spec1.and(spec2);
      const node = await combined.explainAsync!({ a: 1, b: 1 });

      expect(node.pass).toBe(true);
      expect(node.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Enhanced explain tree utilities", () => {
    test("enhanceExplainTree generates failure reasons", () => {
      const ageSpec = spec.field<{ age: number }>("age").gte(18);
      const node = ageSpec.explain({ age: 16 });
      const enhanced = enhanceExplainTree(node);

      expect(enhanced.reason).toBeDefined();
      // The builtin operator already provides a reason
      expect(enhanced.reason).toContain("greater than or equal to");
      expect(enhanced.reason).toContain("18");
    });

    test("enhanceExplainTree handles nested composites", () => {
      const userSpec = spec
        .field<{ age: number; email: string }>("age")
        .gte(18)
        .and(spec.field("email").contains("@example.com"));

      const node = userSpec.explain({ age: 16, email: "user@test.com" });
      const enhanced = enhanceExplainTree(node);

      expect(enhanced.children).toHaveLength(2);
      expect(enhanced.children![0]!.reason).toContain("greater than or equal to");
      expect(enhanced.children![1]!.reason).toContain("contain");
    });

    test("formatExplainTree produces readable output", () => {
      const userSpec = spec
        .field<{ age: number; email: string }>("age")
        .gte(18)
        .and(spec.field("email").contains("@"));

      const node = userSpec.explain({ age: 16, email: "user@test.com" });
      const enhanced = enhanceExplainTree(node);
      const formatted = formatExplainTree(enhanced);

      expect(formatted).toContain("✗"); // Failed indicator
      expect(formatted).toContain("✓"); // Passed indicator for email
      expect(formatted).toContain("age"); // Field path in reason
    });

    test("formatExplainTree shows timing information", () => {
      const ageSpec = spec.field<{ age: number }>("age").gte(18);
      const node = ageSpec.explain({ age: 25 });
      const formatted = formatExplainTree(node);

      expect(formatted).toContain("ms"); // Duration
      expect(formatted).toContain("✓"); // Passed
    });
  });

  describe("Snapshot tests for deterministic output", () => {
    test("eq operator snapshot", () => {
      const node = spec.field<{ name: string }>("name").eq("John").explain({ name: "Jane" });
      
      // Exclude dynamic id for snapshot stability
      expect({
        pass: node.pass,
        operator: node.operator,
        path: node.path,
        actualValue: node.actualValue,
        expectedValue: node.expectedValue,
      }).toMatchSnapshot();
    });

    test("nested AND snapshot", () => {
      const complexSpec = spec
        .field<{ age: number; status: string; verified: boolean }>("age")
        .gte(18)
        .and(spec.field("status").eq("active"))
        .and(spec.field("verified").eq(true));

      const node = complexSpec.explain({ age: 16, status: "pending", verified: false });
      
      // Extract relevant fields for snapshot (excluding dynamic id and timing)
      const snapshot = {
        pass: node.pass,
        operator: node.operator,
        children: node.children?.map((c) => ({
          pass: c.pass,
          operator: c.operator,
          path: c.path,
          actualValue: c.actualValue,
          expectedValue: c.expectedValue,
        })),
      };

      expect(snapshot).toMatchSnapshot();
    });

    test("OR with all failures snapshot", () => {
      const spec1 = spec
        .field<{ role: string; permissions: string[] }>("role")
        .in(["admin", "moderator"])
        .or(spec.field("permissions").contains("manage_users"));

      const node = spec1.explain({ role: "user", permissions: ["read", "write"] });

      const snapshot = {
        pass: node.pass,
        operator: node.operator,
        children: node.children?.map((c) => ({
          pass: c.pass,
          operator: c.operator,
          path: c.path,
          actualValue: c.actualValue,
        })),
      };

      expect(snapshot).toMatchSnapshot();
    });
  });

  describe("Path context propagation", () => {
    test("simple field spec has path", () => {
      const node = spec.field<{ user: { age: number } }>("user.age").gte(18).explain({ user: { age: 16 } });

      expect(node.path).toBe("user.age");
    });

    test("nested composites propagate parent path", () => {
      const spec1 = spec
        .field<{ user: { age: number; name: string } }>("user.age")
        .gte(18)
        .and(spec.field("user.name").contains("John"));

      const node = spec1.explain({ user: { age: 16, name: "Jane" } });

      expect(node.children![0]!.path).toBe("user.age");
      expect(node.children![1]!.path).toBe("user.name");
    });
  });

  describe("Metadata propagation", () => {
    test("metadata is preserved in explain output", () => {
      const ageSpec = spec.field<{ age: number }>("age").gte(18);
      const node = ageSpec.explain({ age: 25 });

      expect(node.meta).toBeDefined();
      expect(node.meta!.kind).toBe("gte");
    });

    test("composite spec metadata includes operator", () => {
      const combined = spec
        .field<{ a: number; b: number }>("a")
        .gt(0)
        .and(spec.field("b").gt(0));

      const node = combined.explain({ a: 1, b: 1 });

      expect(node.operator).toBe("and");
    });
  });
});
