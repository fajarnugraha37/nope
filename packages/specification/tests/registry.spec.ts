import { describe, expect, it } from "bun:test";
import { createRegistry } from "../src/core/registry";
import { builtInOperators } from "../src/ops";
import { spec } from "../src/dsl/spec-builder";
import type { Operator } from "../src/core/types";

describe("Registry", () => {
  it("creates empty registry", () => {
    const registry = createRegistry();
    expect(registry.getOperator("eq")).toBeUndefined();
  });

  it("creates registry with built-in operators", () => {
    const registry = createRegistry({ operators: builtInOperators });
    expect(registry.getOperator("eq")).toBeDefined();
    expect(registry.getOperator("gte")).toBeDefined();
    expect(registry.getOperator("lte")).toBeDefined();
  });

  it("adds custom operator", () => {
    const registry = createRegistry();
    const customOp: Operator = {
      kind: "custom-test",
      create: (input: any) => spec.field<any>(input.path).eq(input.value),
    };
    
    registry.addOperator(customOp);
    expect(registry.getOperator("custom-test")).toBe(customOp);
  });

  it("throws error when adding duplicate operator", () => {
    const registry = createRegistry();
    const operator: Operator = {
      kind: "duplicate",
      create: (input: any) => spec.field<any>(input.path).eq(input.value),
    };
    
    registry.addOperator(operator);
    expect(() => registry.addOperator(operator)).toThrow("already registered");
  });

  it("returns undefined for non-existent operator", () => {
    const registry = createRegistry();
    expect(registry.getOperator("non-existent")).toBeUndefined();
  });

  it("registers spec with id", () => {
    const registry = createRegistry({ operators: builtInOperators });
    const factory = () => spec.field<any>("age").gte(18);
    
    registry.addSpec(factory, { id: "adult-check" });
    const retrieved = registry.getSpec("adult-check");
    expect(retrieved).toBeDefined();
  });

  it("throws error when registering spec without id", () => {
    const registry = createRegistry();
    const factory = () => spec.field<any>("age").gte(18);
    
    expect(() => registry.addSpec(factory)).toThrow("id is required");
  });

  it("throws error when registering duplicate spec id", () => {
    const registry = createRegistry({ operators: builtInOperators });
    const factory1 = () => spec.field<any>("age").gte(18);
    const factory2 = () => spec.field<any>("age").gte(21);
    
    registry.addSpec(factory1, { id: "age-check" });
    expect(() => registry.addSpec(factory2, { id: "age-check" })).toThrow("already registered");
  });

  it("returns undefined for non-existent spec", () => {
    const registry = createRegistry();
    expect(registry.getSpec("non-existent")).toBeUndefined();
  });

  it("retrieves registered spec and executes factory", () => {
    const registry = createRegistry({ operators: builtInOperators });
    let factoryCalled = false;
    const factory = () => {
      factoryCalled = true;
      return spec.field<any>("status").eq("active");
    };
    
    registry.addSpec(factory, { id: "status-check" });
    const retrieved = registry.getSpec("status-check");
    
    expect(factoryCalled).toBe(true);
    expect(retrieved).toBeDefined();
  });

  it("passes meta to spec factory", () => {
    const registry = createRegistry({ operators: builtInOperators });
    let receivedMeta: any;
    const factory = (args: unknown) => {
      receivedMeta = args;
      return spec.field<any>("value").eq(42);
    };
    
    const meta = { id: "test-spec", description: "Test spec" };
    registry.addSpec(factory, meta);
    registry.getSpec("test-spec");
    
    expect(receivedMeta).toEqual(meta);
  });

  it("manages multiple operators", () => {
    const registry = createRegistry();
    const op1: Operator = { kind: "op1", create: (input: any) => spec.field<any>(input.path).eq(1) };
    const op2: Operator = { kind: "op2", create: (input: any) => spec.field<any>(input.path).eq(2) };
    const op3: Operator = { kind: "op3", create: (input: any) => spec.field<any>(input.path).eq(3) };
    
    registry.addOperator(op1);
    registry.addOperator(op2);
    registry.addOperator(op3);
    
    expect(registry.getOperator("op1")).toBe(op1);
    expect(registry.getOperator("op2")).toBe(op2);
    expect(registry.getOperator("op3")).toBe(op3);
  });

  it("manages multiple specs", () => {
    const registry = createRegistry({ operators: builtInOperators });
    const factory1 = () => spec.field<any>("age").gte(18);
    const factory2 = () => spec.field<any>("status").eq("active");
    const factory3 = () => spec.field<any>("role").eq("admin");
    
    registry.addSpec(factory1, { id: "adult" });
    registry.addSpec(factory2, { id: "active" });
    registry.addSpec(factory3, { id: "admin" });
    
    expect(registry.getSpec("adult")).toBeDefined();
    expect(registry.getSpec("active")).toBeDefined();
    expect(registry.getSpec("admin")).toBeDefined();
  });
});
