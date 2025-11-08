import { describe, expect, it } from "bun:test";
import { spec } from "../src/dsl/spec-builder";
import { 
  HumanizerRegistry, 
  defaultHumanizer, 
  createHumanizer,
  builtInTemplates,
  type HumanizerContext 
} from "../src/dsl/humanizer";
import { all, any, none } from "../src/core/combinators";
import type { ExplainNode } from "../src/core/types";

interface User {
  age: number;
  name: string;
  email: string;
  role: string;
  tags: string[];
}

describe("Humanizer Registry", () => {
  describe("Basic Functionality", () => {
    it("creates a humanizer with default options", () => {
      const humanizer = new HumanizerRegistry();
      expect(humanizer).toBeInstanceOf(HumanizerRegistry);
    });

    it("registers a custom template", () => {
      const humanizer = new HumanizerRegistry();
      humanizer.register("custom", (ctx) => `Custom: ${ctx.path}`);
      expect(humanizer.hasTemplate("custom")).toBe(true);
    });

    it("registers multiple templates at once", () => {
      const humanizer = new HumanizerRegistry();
      humanizer.registerAll({
        op1: () => "Operation 1",
        op2: () => "Operation 2",
      });
      expect(humanizer.hasTemplate("op1")).toBe(true);
      expect(humanizer.hasTemplate("op2")).toBe(true);
    });

    it("sets and changes locale", () => {
      const humanizer = new HumanizerRegistry({ locale: "en" });
      humanizer.setLocale("fr");
      // Locale is changed internally
      expect(humanizer).toBeInstanceOf(HumanizerRegistry);
    });

    it("retrieves registered template", () => {
      const humanizer = new HumanizerRegistry();
      const template = (ctx: HumanizerContext) => `Test: ${ctx.kind}`;
      humanizer.register("test", template);
      const retrieved = humanizer.getTemplate("test");
      expect(retrieved).toBe(template);
    });
  });

  describe("Built-in Templates - Comparison Operators", () => {
    it("humanizes eq operator", () => {
      const s = spec.field<User>("age").eq(25);
      const user = { age: 30, name: "John", email: "john@example.com", role: "user", tags: [] };
      const node = s.explain(user);
      const message = defaultHumanizer.humanize(node);
      expect(message).toContain("age must equal 25");
      expect(message).toContain("got 30");
    });

    it("humanizes ne operator", () => {
      const s = spec.field<User>("role").ne("admin");
      const user = { age: 30, name: "John", email: "john@example.com", role: "admin", tags: [] };
      const node = s.explain(user);
      const message = defaultHumanizer.humanize(node);
      expect(message).toContain("role must not equal \"admin\"");
    });

    it("humanizes lt operator", () => {
      const s = spec.field<User>("age").lt(18);
      const user = { age: 25, name: "John", email: "john@example.com", role: "user", tags: [] };
      const node = s.explain(user);
      const message = defaultHumanizer.humanize(node);
      expect(message).toContain("age must be less than 18");
      expect(message).toContain("got 25");
    });

    it("humanizes lte operator", () => {
      const s = spec.field<User>("age").lte(21);
      const user = { age: 25, name: "John", email: "john@example.com", role: "user", tags: [] };
      const node = s.explain(user);
      const message = defaultHumanizer.humanize(node);
      expect(message).toContain("age must be at most 21");
      expect(message).toContain("got 25");
    });

    it("humanizes gt operator", () => {
      const s = spec.field<User>("age").gt(65);
      const user = { age: 30, name: "John", email: "john@example.com", role: "user", tags: [] };
      const node = s.explain(user);
      const message = defaultHumanizer.humanize(node);
      expect(message).toContain("age must be greater than 65");
      expect(message).toContain("got 30");
    });

    it("humanizes gte operator", () => {
      const s = spec.field<User>("age").gte(21);
      const user = { age: 18, name: "John", email: "john@example.com", role: "user", tags: [] };
      const node = s.explain(user);
      const message = defaultHumanizer.humanize(node);
      expect(message).toContain("age must be at least 21");
      expect(message).toContain("got 18");
    });
  });

  describe("Built-in Templates - Collection Operators", () => {
    it("humanizes in operator", () => {
      const s = spec.field<User>("role").in(["admin", "moderator"]);
      const user = { age: 30, name: "John", email: "john@example.com", role: "user", tags: [] };
      const node = s.explain(user);
      const message = defaultHumanizer.humanize(node);
      expect(message).toContain("role must be one of");
      expect(message).toContain("\"admin\"");
      expect(message).toContain("\"moderator\"");
      expect(message).toContain("got \"user\"");
    });

    it("humanizes notIn operator", () => {
      const s = spec.field<User>("role").notIn(["guest", "banned"]);
      const user = { age: 30, name: "John", email: "john@example.com", role: "admin", tags: [] };
      const node = s.explain(user);
      const message = defaultHumanizer.humanize(node);
      expect(message).toContain("role must not be one of");
      expect(message).toContain("\"guest\"");
      expect(message).toContain("\"banned\"");
    });
  });

  describe("Built-in Templates - String Operators", () => {
    it("humanizes regex operator", () => {
      const s = spec.field<User>("email").regex("^[a-z]+@", "i");
      const user = { age: 30, name: "John", email: "123@example.com", role: "user", tags: [] };
      const node = s.explain(user);
      const message = defaultHumanizer.humanize(node);
      expect(message).toContain("email must match pattern");
      expect(message).toContain("^[a-z]+@");
      expect(message).toContain('flags "i"');
    });

    it("humanizes startsWith operator", () => {
      const s = spec.field<User>("email").startsWith("admin");
      const user = { age: 30, name: "John", email: "user@example.com", role: "user", tags: [] };
      const node = s.explain(user);
      const message = defaultHumanizer.humanize(node);
      expect(message).toContain("email must start with \"admin\"");
    });

    it("humanizes endsWith operator", () => {
      const s = spec.field<User>("email").endsWith("@company.com");
      const user = { age: 30, name: "John", email: "john@example.com", role: "user", tags: [] };
      const node = s.explain(user);
      const message = defaultHumanizer.humanize(node);
      expect(message).toContain("email must end with \"@company.com\"");
    });

    it("humanizes contains operator", () => {
      const s = spec.field<User>("name").contains("Smith");
      const user = { age: 30, name: "John Doe", email: "john@example.com", role: "user", tags: [] };
      const node = s.explain(user);
      const message = defaultHumanizer.humanize(node);
      expect(message).toContain("name must contain \"Smith\"");
    });
  });

  describe("Built-in Templates - Existence Operators", () => {
    it("humanizes exists operator", () => {
      const s = spec.field<User>("email").exists();
      const user = { age: 30, name: "John", role: "user", tags: [] } as unknown as User;
      const node = s.explain(user);
      const message = defaultHumanizer.humanize(node);
      expect(message).toContain("email must exist and not be null");
    });

    it("humanizes missing operator", () => {
      const s = spec.field<User>("email").missing();
      const user = { age: 30, name: "John", email: "john@example.com", role: "user", tags: [] };
      const node = s.explain(user);
      const message = defaultHumanizer.humanize(node);
      expect(message).toContain("email must not exist or be null");
    });
  });

  describe("Composite Specifications", () => {
    it("humanizes AND combinator", () => {
      const s = all(
        spec.field<User>("age").gte(18),
        spec.field<User>("role").eq("admin")
      );
      const user = { age: 16, name: "John", email: "john@example.com", role: "user", tags: [] };
      const node = s.explain(user);
      const message = defaultHumanizer.humanize(node);
      expect(message).toContain("All conditions must be met");
    });

    it("humanizes OR combinator", () => {
      const s = any(
        spec.field<User>("role").eq("admin"),
        spec.field<User>("role").eq("moderator")
      );
      const user = { age: 30, name: "John", email: "john@example.com", role: "user", tags: [] };
      const node = s.explain(user);
      const message = defaultHumanizer.humanize(node);
      expect(message).toContain("At least one condition must be met");
    });

    it("humanizes NOT combinator", () => {
      const s = spec.field<User>("role").eq("guest").not();
      const user = { age: 30, name: "John", email: "john@example.com", role: "guest", tags: [] };
      const node = s.explain(user);
      const message = defaultHumanizer.humanize(node);
      expect(message).toContain("Condition must not be met");
    });
  });

  describe("Tree Humanization", () => {
    it("humanizes a simple tree with passing spec", () => {
      const s = spec.field<User>("age").gte(18);
      const user = { age: 25, name: "John", email: "john@example.com", role: "user", tags: [] };
      const node = s.explain(user);
      const tree = defaultHumanizer.humanizeTree(node);
      expect(tree).toContain("✓");
      expect(tree).toContain("age must be at least 18");
    });

    it("humanizes a simple tree with failing spec", () => {
      const s = spec.field<User>("age").gte(21);
      const user = { age: 18, name: "John", email: "john@example.com", role: "user", tags: [] };
      const node = s.explain(user);
      const tree = defaultHumanizer.humanizeTree(node);
      expect(tree).toContain("✗");
      expect(tree).toContain("age must be at least 21");
    });

    it("humanizes nested AND tree", () => {
      const s = all(
        spec.field<User>("age").gte(18),
        spec.field<User>("role").eq("admin")
      );
      const user = { age: 16, name: "John", email: "john@example.com", role: "user", tags: [] };
      const node = s.explain(user);
      const tree = defaultHumanizer.humanizeTree(node);
      
      expect(tree).toContain("All conditions must be met");
      expect(tree).toContain("age must be at least 18");
      expect(tree).toContain("role must equal \"admin\"");
      expect(tree.split("\n").length).toBeGreaterThan(1);
    });

    it("humanizes deeply nested tree with indentation", () => {
      const s = all(
        spec.field<User>("age").gte(18),
        any(
          spec.field<User>("role").eq("admin"),
          spec.field<User>("role").eq("moderator")
        )
      );
      const user = { age: 25, name: "John", email: "john@example.com", role: "user", tags: [] };
      const node = s.explain(user);
      const tree = defaultHumanizer.humanizeTree(node);
      
      const lines = tree.split("\n");
      expect(lines.length).toBeGreaterThan(3);
      // Check indentation
      expect(lines.some(line => line.startsWith("  "))).toBe(true);
      expect(lines.some(line => line.startsWith("    "))).toBe(true);
    });
  });

  describe("Custom Templates", () => {
    it("allows custom template for built-in operator", () => {
      const humanizer = createHumanizer();
      humanizer.register("gte", (ctx) => {
        const path = ctx.path ?? "value";
        const limit = ctx.expectedValue;
        return `🔒 ${path} requires minimum ${limit} (access denied)`;
      });

      const s = spec.field<User>("age").gte(21);
      const user = { age: 18, name: "John", email: "john@example.com", role: "user", tags: [] };
      const node = s.explain(user);
      const message = humanizer.humanize(node);
      
      expect(message).toContain("🔒 age requires minimum 21");
      expect(message).toContain("access denied");
    });

    it("uses fallback template when operator not registered", () => {
      // Create a humanizer without any templates
      const humanizer = new HumanizerRegistry({
        fallbackTemplate: (ctx) => `Unknown operator: ${ctx.kind ?? ctx.operator}`,
      });

      // Create a mock node without a reason field to test fallback
      const node: ExplainNode = {
        id: "test-1",
        name: "test",
        pass: false,
        operator: "custom-op",
        expectedValue: 100,
        actualValue: 50,
      };
      
      const message = humanizer.humanize(node);
      expect(message).toContain("Unknown operator: custom-op");
    });

    it("allows per-specification custom messages", () => {
      const humanizer = createHumanizer();
      humanizer.register("custom", () => "This is a custom validation rule");

      // Simulating a custom spec with custom kind
      const s = spec.field<User>("age").gte(21);
      const user = { age: 18, name: "John", email: "john@example.com", role: "user", tags: [] };
      const node = s.explain(user);
      
      // Override kind in node for testing
      const customNode = { ...node, meta: { ...node.meta, kind: "custom" } };
      const message = humanizer.humanize(customNode);
      
      expect(message).toBe("This is a custom validation rule");
    });
  });

  describe("Localization Support", () => {
    it("supports custom localization function", () => {
      const translations: Record<string, Record<string, string>> = {
        en: { "field.required": "{field} is required" },
        fr: { "field.required": "{field} est requis" },
        es: { "field.required": "{field} es requerido" },
      };

      const localize = (key: string, params?: Record<string, unknown>) => {
        const locale = (params?.locale as string) ?? "en";
        let template = translations[locale]?.[key] ?? key;
        
        if (params) {
          Object.entries(params).forEach(([k, v]) => {
            template = template.replace(`{${k}}`, String(v));
          });
        }
        
        return template;
      };

      const humanizer = createHumanizer({ localize });
      humanizer.register("required", (ctx) => {
        return humanizer["t"]("field.required", { field: ctx.path, locale: ctx.locale });
      });

      // English
      humanizer.setLocale("en");
      expect(humanizer["t"]("field.required", { field: "email", locale: "en" })).toBe("email is required");

      // French
      humanizer.setLocale("fr");
      expect(humanizer["t"]("field.required", { field: "email", locale: "fr" })).toBe("email est requis");

      // Spanish
      humanizer.setLocale("es");
      expect(humanizer["t"]("field.required", { field: "email", locale: "es" })).toBe("email es requerido");
    });

    it("uses locale in custom templates", () => {
      const humanizer = createHumanizer({ locale: "fr" });
      humanizer.register("gte", (ctx) => {
        if (ctx.locale === "fr") {
          return `${ctx.path} doit être au moins ${ctx.expectedValue}`;
        }
        return `${ctx.path} must be at least ${ctx.expectedValue}`;
      });

      const s = spec.field<User>("age").gte(21);
      const user = { age: 18, name: "John", email: "john@example.com", role: "user", tags: [] };
      const node = s.explain(user);
      const message = humanizer.humanize(node);
      
      expect(message).toContain("doit être au moins");
    });
  });

  describe("Snapshot Tests", () => {
    it("produces consistent humanized output for eq operator", () => {
      const s = spec.field<User>("age").eq(25);
      const user = { age: 30, name: "John", email: "john@example.com", role: "user", tags: [] };
      const node = s.explain(user);
      const message = defaultHumanizer.humanize(node);
      
      expect(message).toMatchSnapshot();
    });

    it("produces consistent humanized tree for complex spec", () => {
      const s = all(
        spec.field<User>("age").gte(18),
        any(
          spec.field<User>("role").eq("admin"),
          spec.field<User>("role").eq("moderator")
        ),
        spec.field<User>("email").exists()
      );
      const user = { age: 16, name: "John", email: "john@example.com", role: "user", tags: [] };
      const node = s.explain(user);
      const tree = defaultHumanizer.humanizeTree(node);
      
      expect(tree).toMatchSnapshot();
    });

    it("produces consistent output for all comparison operators", () => {
      const specs = {
        eq: spec.field<User>("age").eq(25),
        ne: spec.field<User>("age").ne(30),
        lt: spec.field<User>("age").lt(18),
        lte: spec.field<User>("age").lte(21),
        gt: spec.field<User>("age").gt(65),
        gte: spec.field<User>("age").gte(21),
      };

      const user = { age: 30, name: "John", email: "john@example.com", role: "user", tags: [] };
      
      const results: Record<string, string> = {};
      for (const [op, s] of Object.entries(specs)) {
        const node = s.explain(user);
        results[op] = defaultHumanizer.humanize(node);
      }
      
      expect(results).toMatchSnapshot();
    });
  });

  describe("Edge Cases", () => {
    it("handles missing path gracefully", () => {
      const node = {
        id: "test-1",
        name: "test",
        pass: false as const,
        operator: "eq",
        expectedValue: 25,
        actualValue: 30,
      };

      const message = defaultHumanizer.humanize(node);
      expect(message).toContain("value must equal 25");
    });

    it("handles undefined actualValue", () => {
      const s = spec.field<User>("age").eq(25);
      const user = { name: "John", email: "john@example.com", role: "user", tags: [] } as unknown as User;
      const node = s.explain(user);
      const message = defaultHumanizer.humanize(node);
      
      expect(message).toContain("got undefined");
    });

    it("handles array values in 'in' operator", () => {
      const s = spec.field<User>("role").in(["admin", "moderator", "editor"]);
      const user = { age: 30, name: "John", email: "john@example.com", role: "user", tags: [] };
      const node = s.explain(user);
      const message = defaultHumanizer.humanize(node);
      
      expect(message).toContain("\"admin\"");
      expect(message).toContain("\"moderator\"");
      expect(message).toContain("\"editor\"");
    });

    it("handles nodes without operator or kind", () => {
      const node = {
        id: "test-1",
        name: "test",
        pass: false as const,
      };

      const humanizer = new HumanizerRegistry({
        fallbackTemplate: () => "Validation failed",
      });

      const message = humanizer.humanize(node);
      expect(message).toBe("Validation failed");
    });
  });
});
