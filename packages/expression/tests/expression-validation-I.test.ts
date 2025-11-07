import { describe, it, expect } from "bun:test";
import { ExpressionBuilder } from "../src/builder/expression-builder.js";
import { ExpressionValidationError } from "../src/error/index.js";

describe("Expression Builder Validation", () => {
  it("should validate expression structure when strict validation is enabled", () => {
    const builder = ExpressionBuilder.create("test-strict-validation")
      .name("Test Expression")
      .description("A test expression with strict validation")
      .strictValidation(true)
      .op(">", { var: "age" }, 18);

    // Should not throw for valid expression
    expect(() => builder.build()).not.toThrow();
  });

  it("should throw validation error for invalid expression structure in strict mode", () => {
    const builder = ExpressionBuilder.create("test-invalid-strict")
      .name("Invalid Expression")
      .description("An invalid expression to test validation")
      .strictValidation(true);

    // Add an invalid operation manually to trigger validation error
    const invalidOperation = { invalidOperator: "not-supported" } as any;
    builder.add(invalidOperation);

    expect(() => builder.build()).toThrow(ExpressionValidationError);
  });

  it("should skip validation when strict validation is disabled", () => {
    const builder = ExpressionBuilder.create("test-no-strict")
      .name("No Strict Validation")
      .description("Expression without strict validation")
      .strictValidation(false);

    // Add an invalid operation - should not throw since validation is disabled
    const invalidOperation = { invalidOperator: "not-supported" } as any;
    builder.add(invalidOperation);

    expect(() => builder.build()).not.toThrow();
  });

  it("should use default validator when none provided", () => {
    // Create builder without providing custom validator (uses default)
    const builder = ExpressionBuilder.create("test-default-validator")
      .name("Default Validator Test")
      .description("Test using default validator")
      .strictValidation(true)
      .op("==", { var: "status" }, "active");

    // Should work fine with default validator
    expect(() => builder.build()).not.toThrow();

    const result = builder.build();
    expect(result).toBeDefined();
    expect(result.id).toBe("test-default-validator");
  });

  it("should validate complex nested expressions in strict mode", () => {
    const builder = ExpressionBuilder.create("test-complex-validation")
      .name("Complex Expression")
      .description("A complex nested expression")
      .strictValidation(true)
      .add({ ">": [{ var: "age" }, 18] })
      .add({
        and: [
          { "==": [{ var: "status" }, "active"] },
          { in: [{ var: "role" }, { val: ["admin", "user"] }] },
        ],
      });

    expect(() => builder.build()).not.toThrow();

    const result = builder.build();
    expect(result.operations).toHaveLength(2);
    expect(result.operations[0]).toHaveProperty(">");
    expect(result.operations[1]).toHaveProperty("and");
  });

  it("should validate expressions with metadata in strict mode", () => {
    const builder = ExpressionBuilder.create("test-metadata-validation")
      .name("Metadata Expression")
      .description("Expression with metadata")
      .strictValidation(true)
      .author("Test Author")
      .category("validation")
      .tags("test", "metadata")
      .priority(1)
      .op(">", { var: "score" }, 85);

    const result = builder.build();

    expect(result.metadata?.author).toBe("Test Author");
    expect(result.metadata?.category).toBe("validation");
    expect(result.metadata?.tags).toContain("test");
    expect(result.metadata?.tags).toContain("metadata");
    expect(result.metadata?.priority).toBe(1);
    expect(result.metadata?.createdAt).toBeDefined();
    expect(result.metadata?.updatedAt).toBeDefined();
  });

  it("should validate expressions with all operand types", () => {
    const builder = ExpressionBuilder.create("test-operand-types")
      .name("Operand Types Test")
      .description("Test all operand types")
      .strictValidation(true)
      .op(
        "if",
        { var: "condition" },
        { val: ["option1", "option2"] },
        { ref: "other-expression" }
      )
      .op("==", { literal: "test-value" }, "test-value");

    expect(() => builder.build()).not.toThrow();

    const result = builder.build();
    expect(result.operations).toHaveLength(2);
  });

  it("should test invalid operations with default validator", () => {
    const builder = ExpressionBuilder.create("test-invalid-operation")
      .name("Invalid Operation Test")
      .description("Test invalid operation with default validator")
      .strictValidation(true);

    // Add an operation with invalid operator using default validator
    const invalidOperation = { invalidOperator: "not-supported" } as any;
    builder.add(invalidOperation);

    expect(() => builder.build()).toThrow(ExpressionValidationError);
  });
});
