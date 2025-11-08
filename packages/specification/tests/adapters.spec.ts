import { describe, expect, it } from "bun:test";
import { spec } from "../src/dsl/spec-builder";
import { prismaAdapter } from "../src/adapters/prisma";
import { mongoAdapter } from "../src/adapters/mongo";

interface User {
  age: number;
  role: string;
}

const rule = spec.field<User>("age").gte(21).and(spec.field<User>("role").eq("admin"));

describe("adapters", () => {
  it("compiles prisma query", () => {
    const query = prismaAdapter.compile(rule);
    expect(query.AND).toHaveLength(2);
  });

  it("compiles mongo query", () => {
    const query = mongoAdapter.compile(rule);
    expect("$and" in query).toBe(true);
  });
});
