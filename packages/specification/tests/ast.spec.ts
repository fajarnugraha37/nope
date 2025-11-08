import { describe, expect, it } from "bun:test";
import { spec } from "../src/dsl/spec-builder";
import { toAst, fromAst } from "../src/ast/serializer";
import { createRegistry } from "../src/core/registry";
import { builtInOperators } from "../src/ops";

interface User {
  age: number;
  role: string;
}

describe("AST serialization", () => {
  it("round trips specification", async () => {
    const registry = createRegistry({ operators: builtInOperators });
    const original = spec.field<User>("age").gte(18).and(spec.field<User>("role").eq("admin"));
    const ast = toAst(original);
    const restored = fromAst<User, {}>(ast, registry);
    expect(await restored.isSatisfiedByAsync!({ age: 20, role: "admin" })).toBe(true);
    expect(await restored.isSatisfiedByAsync!({ age: 16, role: "admin" })).toBe(false);
  });
});
