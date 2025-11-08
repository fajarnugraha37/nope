import { describe, expect, it } from "bun:test";
import { spec } from "../src/dsl/spec-builder";
import { prismaAdapter } from "../src/adapters/prisma";
import { mongoAdapter } from "../src/adapters/mongo";
import { all, any, none } from "../src/core/combinators";

interface User {
  age: number;
  name: string;
  role: string;
  email: string;
  profile: {
    bio: string;
    preferences: {
      theme: string;
      notifications: boolean;
    };
  };
  tags: string[];
}

describe("Prisma Adapter", () => {
  describe("Comparison Operators", () => {
    it("compiles eq operator", () => {
      const s = spec.field<User>("age").eq(25);
      const query = prismaAdapter.compile(s);
      expect(query).toEqual({ age: 25 });
    });

    it("compiles ne operator", () => {
      const s = spec.field<User>("age").ne(25);
      const query = prismaAdapter.compile(s);
      expect(query).toEqual({ age: { not: 25 } });
    });

    it("compiles lt operator", () => {
      const s = spec.field<User>("age").lt(30);
      const query = prismaAdapter.compile(s);
      expect(query).toEqual({ age: { lt: 30 } });
    });

    it("compiles lte operator", () => {
      const s = spec.field<User>("age").lte(30);
      const query = prismaAdapter.compile(s);
      expect(query).toEqual({ age: { lte: 30 } });
    });

    it("compiles gt operator", () => {
      const s = spec.field<User>("age").gt(18);
      const query = prismaAdapter.compile(s);
      expect(query).toEqual({ age: { gt: 18 } });
    });

    it("compiles gte operator", () => {
      const s = spec.field<User>("age").gte(21);
      const query = prismaAdapter.compile(s);
      expect(query).toEqual({ age: { gte: 21 } });
    });
  });

  describe("Collection Operators", () => {
    it("compiles in operator", () => {
      const s = spec.field<User>("role").in(["admin", "moderator"]);
      const query = prismaAdapter.compile(s);
      expect(query).toEqual({ role: { in: ["admin", "moderator"] } });
    });

    it("compiles notIn operator", () => {
      const s = spec.field<User>("role").notIn(["guest", "banned"]);
      const query = prismaAdapter.compile(s);
      expect(query).toEqual({ role: { notIn: ["guest", "banned"] } });
    });
  });

  describe("String Operators", () => {
    it("compiles regex operator", () => {
      const s = spec.field<User>("email").regex("^[a-z]+@", "i");
      const query = prismaAdapter.compile(s);
      expect(query).toEqual({
        email: { search: { mode: "regex", pattern: "^[a-z]+@", options: "i" } },
      });
    });

    it("compiles startsWith operator", () => {
      const s = spec.field<User>("name").startsWith("John");
      const query = prismaAdapter.compile(s);
      expect(query).toEqual({ name: { startsWith: "John" } });
    });

    it("compiles endsWith operator", () => {
      const s = spec.field<User>("email").endsWith("@example.com");
      const query = prismaAdapter.compile(s);
      expect(query).toEqual({ email: { endsWith: "@example.com" } });
    });

    it("compiles contains operator", () => {
      const s = spec.field<User>("name").contains("Doe");
      const query = prismaAdapter.compile(s);
      expect(query).toEqual({ name: { contains: "Doe" } });
    });
  });

  describe("Existence Operators", () => {
    it("compiles exists operator", () => {
      const s = spec.field<User>("email").exists();
      const query = prismaAdapter.compile(s);
      expect(query).toEqual({ email: { not: null } });
    });

    it("compiles missing operator", () => {
      const s = spec.field<User>("email").missing();
      const query = prismaAdapter.compile(s);
      expect(query).toEqual({ email: null });
    });
  });

  describe("Nested Combinators", () => {
    it("compiles AND combinator", () => {
      const s = spec.field<User>("age").gte(21).and(spec.field<User>("role").eq("admin"));
      const query = prismaAdapter.compile(s);
      expect(query).toEqual({
        AND: [{ age: { gte: 21 } }, { role: "admin" }],
      });
    });

    it("compiles OR combinator", () => {
      const s = spec.field<User>("role").eq("admin").or(spec.field<User>("role").eq("moderator"));
      const query = prismaAdapter.compile(s);
      expect(query).toEqual({
        OR: [{ role: "admin" }, { role: "moderator" }],
      });
    });

    it("compiles NOT combinator", () => {
      const s = spec.field<User>("role").eq("guest").not();
      const query = prismaAdapter.compile(s);
      expect(query).toEqual({
        NOT: [{ role: "guest" }],
      });
    });

    it("compiles nested AND/OR combinations", () => {
      const s = all(
        spec.field<User>("age").gte(18),
        any(spec.field<User>("role").eq("admin"), spec.field<User>("role").eq("moderator"))
      );
      const query = prismaAdapter.compile(s);
      expect(query).toEqual({
        AND: [{ age: { gte: 18 } }, { OR: [{ role: "admin" }, { role: "moderator" }] }],
      });
    });

    it("compiles complex nested structure", () => {
      const s = all(
        spec.field<User>("age").gte(21),
        any(spec.field<User>("role").eq("admin"), spec.field<User>("email").exists()),
        spec.field<User>("name").startsWith("John").not()
      );
      const query = prismaAdapter.compile(s);
      expect(query).toEqual({
        AND: [
          { age: { gte: 21 } },
          { OR: [{ role: "admin" }, { email: { not: null } }] },
          { NOT: [{ name: { startsWith: "John" } }] },
        ],
      });
    });

    it("compiles deeply nested combinators (3 levels)", () => {
      const s = all(
        spec.field<User>("age").gte(18),
        any(
          all(spec.field<User>("role").eq("admin"), spec.field<User>("email").exists()),
          spec.field<User>("role").eq("moderator")
        )
      );
      const query = prismaAdapter.compile(s);
      expect(query).toEqual({
        AND: [
          { age: { gte: 18 } },
          {
            OR: [
              { AND: [{ role: "admin" }, { email: { not: null } }] },
              { role: "moderator" },
            ],
          },
        ],
      });
    });
  });

  describe("Deep Path Nesting", () => {
    it("handles single-level nested path", () => {
      const s = spec.field<User>("profile.bio").contains("developer");
      const query = prismaAdapter.compile(s);
      expect(query).toEqual({
        profile: { bio: { contains: "developer" } },
      });
    });

    it("handles two-level nested path", () => {
      const s = spec.field<User>("profile.preferences.theme").eq("dark");
      const query = prismaAdapter.compile(s);
      expect(query).toEqual({
        profile: { preferences: { theme: "dark" } },
      });
    });

    it("handles nested path with array index", () => {
      const s = spec.field<User>("tags[0]").eq("javascript");
      const query = prismaAdapter.compile(s);
      expect(query).toEqual({
        tags: { "0": "javascript" },
      });
    });

    it("handles multiple nested paths in AND", () => {
      const s = all(
        spec.field<User>("profile.bio").exists(),
        spec.field<User>("profile.preferences.theme").eq("dark"),
        spec.field<User>("profile.preferences.notifications").eq(true)
      );
      const query = prismaAdapter.compile(s);
      expect(query).toEqual({
        AND: [
          { profile: { bio: { not: null } } },
          { profile: { preferences: { theme: "dark" } } },
          { profile: { preferences: { notifications: true } } },
        ],
      });
    });
  });

  describe("Combinator Helpers", () => {
    it("compiles all() helper", () => {
      const s = all(
        spec.field<User>("age").gte(18),
        spec.field<User>("role").eq("admin"),
        spec.field<User>("email").exists()
      );
      const query = prismaAdapter.compile(s);
      expect(query).toEqual({
        AND: [{ age: { gte: 18 } }, { role: "admin" }, { email: { not: null } }],
      });
    });

    it("compiles any() helper", () => {
      const s = any(
        spec.field<User>("role").eq("admin"),
        spec.field<User>("role").eq("moderator"),
        spec.field<User>("role").eq("editor")
      );
      const query = prismaAdapter.compile(s);
      expect(query).toEqual({
        OR: [{ role: "admin" }, { role: "moderator" }, { role: "editor" }],
      });
    });

    it("compiles none() helper", () => {
      const s = none(spec.field<User>("role").eq("guest"), spec.field<User>("role").eq("banned"));
      const query = prismaAdapter.compile(s);
      // none() is implemented as NOT(OR(...)) which is equivalent by De Morgan's law
      expect(query).toEqual({
        NOT: [{ OR: [{ role: "guest" }, { role: "banned" }] }],
      });
    });
  });
});

describe("MongoDB Adapter", () => {
  describe("Comparison Operators", () => {
    it("compiles eq operator", () => {
      const s = spec.field<User>("age").eq(25);
      const query = mongoAdapter.compile(s);
      expect(query).toEqual({ age: 25 });
    });

    it("compiles ne operator", () => {
      const s = spec.field<User>("age").ne(25);
      const query = mongoAdapter.compile(s);
      expect(query).toEqual({ age: { $ne: 25 } });
    });

    it("compiles lt operator", () => {
      const s = spec.field<User>("age").lt(30);
      const query = mongoAdapter.compile(s);
      expect(query).toEqual({ age: { $lt: 30 } });
    });

    it("compiles lte operator", () => {
      const s = spec.field<User>("age").lte(30);
      const query = mongoAdapter.compile(s);
      expect(query).toEqual({ age: { $lte: 30 } });
    });

    it("compiles gt operator", () => {
      const s = spec.field<User>("age").gt(18);
      const query = mongoAdapter.compile(s);
      expect(query).toEqual({ age: { $gt: 18 } });
    });

    it("compiles gte operator", () => {
      const s = spec.field<User>("age").gte(21);
      const query = mongoAdapter.compile(s);
      expect(query).toEqual({ age: { $gte: 21 } });
    });
  });

  describe("Collection Operators", () => {
    it("compiles in operator", () => {
      const s = spec.field<User>("role").in(["admin", "moderator"]);
      const query = mongoAdapter.compile(s);
      expect(query).toEqual({ role: { $in: ["admin", "moderator"] } });
    });

    it("compiles notIn operator", () => {
      const s = spec.field<User>("role").notIn(["guest", "banned"]);
      const query = mongoAdapter.compile(s);
      expect(query).toEqual({ role: { $nin: ["guest", "banned"] } });
    });
  });

  describe("String Operators", () => {
    it("compiles regex operator", () => {
      const s = spec.field<User>("email").regex("^[a-z]+@", "i");
      const query = mongoAdapter.compile(s);
      expect(query).toEqual({
        email: { $regex: "^[a-z]+@", $options: "i" },
      });
    });

    it("compiles startsWith operator", () => {
      const s = spec.field<User>("name").startsWith("John");
      const query = mongoAdapter.compile(s);
      expect(query).toEqual({ name: { $regex: "^John" } });
    });

    it("compiles endsWith operator", () => {
      const s = spec.field<User>("email").endsWith("@example.com");
      const query = mongoAdapter.compile(s);
      expect(query).toEqual({ email: { $regex: "@example.com$" } });
    });

    it("compiles contains operator", () => {
      const s = spec.field<User>("name").contains("Doe");
      const query = mongoAdapter.compile(s);
      expect(query).toEqual({ name: { $regex: "Doe" } });
    });
  });

  describe("Existence Operators", () => {
    it("compiles exists operator", () => {
      const s = spec.field<User>("email").exists();
      const query = mongoAdapter.compile(s);
      expect(query).toEqual({ email: { $exists: true, $ne: null } });
    });

    it("compiles missing operator", () => {
      const s = spec.field<User>("email").missing();
      const query = mongoAdapter.compile(s);
      expect(query).toEqual({ email: { $exists: false } });
    });
  });

  describe("Nested Combinators", () => {
    it("compiles AND combinator", () => {
      const s = spec.field<User>("age").gte(21).and(spec.field<User>("role").eq("admin"));
      const query = mongoAdapter.compile(s);
      expect(query).toEqual({
        $and: [{ age: { $gte: 21 } }, { role: "admin" }],
      });
    });

    it("compiles OR combinator", () => {
      const s = spec.field<User>("role").eq("admin").or(spec.field<User>("role").eq("moderator"));
      const query = mongoAdapter.compile(s);
      expect(query).toEqual({
        $or: [{ role: "admin" }, { role: "moderator" }],
      });
    });

    it("compiles NOT combinator", () => {
      const s = spec.field<User>("role").eq("guest").not();
      const query = mongoAdapter.compile(s);
      expect(query).toEqual({
        $not: { role: "guest" },
      });
    });

    it("compiles nested AND/OR combinations", () => {
      const s = all(
        spec.field<User>("age").gte(18),
        any(spec.field<User>("role").eq("admin"), spec.field<User>("role").eq("moderator"))
      );
      const query = mongoAdapter.compile(s);
      expect(query).toEqual({
        $and: [{ age: { $gte: 18 } }, { $or: [{ role: "admin" }, { role: "moderator" }] }],
      });
    });

    it("compiles complex nested structure", () => {
      const s = all(
        spec.field<User>("age").gte(21),
        any(spec.field<User>("role").eq("admin"), spec.field<User>("email").exists()),
        spec.field<User>("name").startsWith("John").not()
      );
      const query = mongoAdapter.compile(s);
      expect(query).toEqual({
        $and: [
          { age: { $gte: 21 } },
          { $or: [{ role: "admin" }, { email: { $exists: true, $ne: null } }] },
          { $not: { name: { $regex: "^John" } } },
        ],
      });
    });

    it("compiles deeply nested combinators (3 levels)", () => {
      const s = all(
        spec.field<User>("age").gte(18),
        any(
          all(spec.field<User>("role").eq("admin"), spec.field<User>("email").exists()),
          spec.field<User>("role").eq("moderator")
        )
      );
      const query = mongoAdapter.compile(s);
      expect(query).toEqual({
        $and: [
          { age: { $gte: 18 } },
          {
            $or: [
              { $and: [{ role: "admin" }, { email: { $exists: true, $ne: null } }] },
              { role: "moderator" },
            ],
          },
        ],
      });
    });
  });

  describe("Deep Path Nesting", () => {
    it("handles single-level nested path", () => {
      const s = spec.field<User>("profile.bio").contains("developer");
      const query = mongoAdapter.compile(s);
      expect(query).toEqual({
        "profile.bio": { $regex: "developer" },
      });
    });

    it("handles two-level nested path", () => {
      const s = spec.field<User>("profile.preferences.theme").eq("dark");
      const query = mongoAdapter.compile(s);
      expect(query).toEqual({
        "profile.preferences.theme": "dark",
      });
    });

    it("handles nested path with array index", () => {
      const s = spec.field<User>("tags[0]").eq("javascript");
      const query = mongoAdapter.compile(s);
      expect(query).toEqual({
        "tags[0]": "javascript",
      });
    });

    it("handles multiple nested paths in AND", () => {
      const s = all(
        spec.field<User>("profile.bio").exists(),
        spec.field<User>("profile.preferences.theme").eq("dark"),
        spec.field<User>("profile.preferences.notifications").eq(true)
      );
      const query = mongoAdapter.compile(s);
      expect(query).toEqual({
        $and: [
          { "profile.bio": { $exists: true, $ne: null } },
          { "profile.preferences.theme": "dark" },
          { "profile.preferences.notifications": true },
        ],
      });
    });
  });

  describe("Combinator Helpers", () => {
    it("compiles all() helper", () => {
      const s = all(
        spec.field<User>("age").gte(18),
        spec.field<User>("role").eq("admin"),
        spec.field<User>("email").exists()
      );
      const query = mongoAdapter.compile(s);
      expect(query).toEqual({
        $and: [
          { age: { $gte: 18 } },
          { role: "admin" },
          { email: { $exists: true, $ne: null } },
        ],
      });
    });

    it("compiles any() helper", () => {
      const s = any(
        spec.field<User>("role").eq("admin"),
        spec.field<User>("role").eq("moderator"),
        spec.field<User>("role").eq("editor")
      );
      const query = mongoAdapter.compile(s);
      expect(query).toEqual({
        $or: [{ role: "admin" }, { role: "moderator" }, { role: "editor" }],
      });
    });

    it("compiles none() helper", () => {
      const s = none(spec.field<User>("role").eq("guest"), spec.field<User>("role").eq("banned"));
      const query = mongoAdapter.compile(s);
      // none() is implemented as NOT(OR(...)) which is equivalent by De Morgan's law
      expect(query).toEqual({
        $not: { $or: [{ role: "guest" }, { role: "banned" }] },
      });
    });
  });
});
