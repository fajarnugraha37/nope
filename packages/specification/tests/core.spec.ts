import { describe, expect, it } from "bun:test";
import { spec } from "../src/dsl/spec-builder";
import { all, any, none, xor } from "../src/core/combinators";

interface Sample {
  age: number;
  role: string;
}

const ageSpec = spec.field<Sample>("age").gte(18);
const roleSpec = spec.field<Sample>("role").eq("admin");

describe("combinators", () => {
  it("all", async () => {
    const combined = all(ageSpec, roleSpec);
    expect(await combined.isSatisfiedByAsync!({ age: 20, role: "admin" })).toBe(true);
    expect(await combined.isSatisfiedByAsync!({ age: 17, role: "admin" })).toBe(false);
  });

  it("any", async () => {
    const combined = any(ageSpec, roleSpec);
    expect(await combined.isSatisfiedByAsync!({ age: 20, role: "user" })).toBe(true);
    expect(await combined.isSatisfiedByAsync!({ age: 17, role: "user" })).toBe(false);
  });

  it("none", async () => {
    const combined = none(ageSpec, roleSpec);
    expect(await combined.isSatisfiedByAsync!({ age: 20, role: "user" })).toBe(false);
    expect(await combined.isSatisfiedByAsync!({ age: 16, role: "user" })).toBe(true);
  });

  it("xor", async () => {
    const combined = xor(ageSpec, roleSpec);
    expect(await combined.isSatisfiedByAsync!({ age: 20, role: "admin" })).toBe(false);
    expect(await combined.isSatisfiedByAsync!({ age: 20, role: "user" })).toBe(true);
  });
});
