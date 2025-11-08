import { describe, expect, it } from "bun:test";
import { spec } from "../src/dsl/spec-builder";
import { toAst, fromAst } from "../src/ast/serializer";
import { createRegistry } from "../src/core/registry";
import { builtInOperators } from "../src/ops";
import { not } from "../src/core/combinators";

interface User {
  age: number;
  role: string;
  status?: string;
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

  it("serializes simple field spec to AST", () => {
    const original = spec.field<User>("age").gte(18);
    const ast = toAst(original);
    
    expect(ast.type).toBe("op");
    expect(ast).toHaveProperty("kind");
    expect(ast).toHaveProperty("input");
  });

  it("serializes NOT combinator to AST", () => {
    const original = not(spec.field<User>("age").lt(18));
    const ast = toAst(original);
    
    expect(ast.type).toBe("not");
    expect(ast).toHaveProperty("node");
  });

  it("serializes AND combinator to AST", () => {
    const original = spec.field<User>("age").gte(18).and(spec.field<User>("role").eq("admin"));
    const ast = toAst(original);
    
    expect(ast.type).toBe("and");
    expect(ast).toHaveProperty("nodes");
    expect(Array.isArray((ast as any).nodes)).toBe(true);
  });

  it("serializes OR combinator to AST", () => {
    const original = spec.field<User>("age").gte(18).or(spec.field<User>("role").eq("admin"));
    const ast = toAst(original);
    
    expect(ast.type).toBe("or");
    expect(ast).toHaveProperty("nodes");
  });

  it("throws error when converting unsupported spec to AST", () => {
    const unsupportedSpec = {
      isSatisfiedBy: () => true,
      isSatisfiedByAsync: async () => true,
      id: "test",
      name: "test",
    } as any;
    
    expect(() => toAst(unsupportedSpec)).toThrow("Cannot convert specification to AST");
  });

  it("throws error for invalid AST", () => {
    const registry = createRegistry({ operators: builtInOperators });
    const invalidAst = { type: "invalid" } as any;
    
    expect(() => fromAst<User, {}>(invalidAst, registry)).toThrow("Invalid AST");
  });

  it("throws error for unknown operator kind", () => {
    const registry = createRegistry({ operators: builtInOperators });
    const ast = {
      type: "op",
      kind: "non-existent-operator",
      input: { path: "age", value: 18 },
    } as any;
    
    expect(() => fromAst<User, {}>(ast, registry)).toThrow("is not registered");
  });

  it("throws error for unknown spec ref", () => {
    const registry = createRegistry({ operators: builtInOperators });
    const ast = {
      type: "ref",
      id: "non-existent-spec",
    } as any;
    
    expect(() => fromAst<User, {}>(ast, registry)).toThrow("is not registered");
  });

  it("deserializes ref node when spec is registered", () => {
    const registry = createRegistry({ operators: builtInOperators });
    const factory = () => spec.field<User>("age").gte(18);
    registry.addSpec(factory, { id: "adult-check" });
    
    const ast = { type: "ref", id: "adult-check" } as any;
    const restored = fromAst<User, {}>(ast, registry);
    
    expect(restored).toBeDefined();
  });

  it("handles nested AND/OR combinations", async () => {
    const registry = createRegistry({ operators: builtInOperators });
    const original = spec
      .field<User>("age").gte(18)
      .and(spec.field<User>("role").eq("admin"))
      .or(spec.field<User>("status").eq("vip"));
    
    const ast = toAst(original);
    const restored = fromAst<User, {}>(ast, registry);
    
    expect(await restored.isSatisfiedByAsync!({ age: 20, role: "admin" })).toBe(true);
    expect(await restored.isSatisfiedByAsync!({ age: 16, role: "user", status: "vip" })).toBe(true);
    expect(await restored.isSatisfiedByAsync!({ age: 16, role: "user" })).toBe(false);
  });

  it("preserves input properties in AST for in operator", () => {
    const original = spec.field<User>("role").in(["admin", "moderator"]);
    const ast = toAst(original);
    
    expect(ast.type).toBe("op");
    const input = (ast as any).input;
    expect(input.path).toBe("role");
    expect(input).toHaveProperty("values");
  });

  it("preserves regex pattern and flags in AST", () => {
    const original = spec.field<User>("role").regex("^admin", "i");
    const ast = toAst(original);
    
    expect(ast.type).toBe("op");
    const input = (ast as any).input;
    expect(input.path).toBe("role");
    expect(input).toHaveProperty("pattern");
    expect(input).toHaveProperty("flags");
  });

  it("round trips complex nested specifications", async () => {
    const registry = createRegistry({ operators: builtInOperators });
    const original = not(
      spec.field<User>("age").lt(18)
        .and(spec.field<User>("role").ne("admin"))
    );
    
    const ast = toAst(original);
    const restored = fromAst<User, {}>(ast, registry);
    
    expect(await restored.isSatisfiedByAsync!({ age: 20, role: "admin" })).toBe(true);
    expect(await restored.isSatisfiedByAsync!({ age: 16, role: "user" })).toBe(false);
  });
});
