import { describe, test, expect } from "bun:test";
import { validateExpression, validateExpressionStrict } from "@nope/validator";

describe("Comprehensive Expression Schema Validation", () => {
  test("should validate complex nested expressions", () => {
    const complexExpression = {
      id: "loan-eligibility",
      name: "Loan Eligibility Check",
      description: "Determines if applicant is eligible for a loan",
      multipleOperations: "and" as const,
      operations: [
        {
          // Age check
          ">": [{ var: "age" }, 18],
        },
        {
          // Income and employment check
          or: [
            {
              and: [
                { "==": [{ var: "employment" }, "employee"] },
                { ">": [{ var: "salary" }, 3000] },
              ],
            },
            {
              and: [
                { "==": [{ var: "employment" }, "self-employed"] },
                { ">": [{ var: "income" }, 5000] },
              ],
            },
          ],
        },
        {
          // Credit score check
          ">=": [{ var: "creditScore" }, 650],
        },
      ],
    };

    const result = validateExpression(complexExpression);
    expect(result.valid).toBe(true);
    expect(result.data).toEqual(complexExpression);
  });

  test("should validate expressions with mathematical operations", () => {
    const mathExpression = {
      id: "calculation",
      name: "Mathematical Calculation",
      description: "Complex mathematical expression",
      multipleOperations: "and" as const,
      operations: [
        {
          "+": [
            { "*": [{ var: "price" }, { var: "quantity" }] },
            { var: "tax" },
          ],
        },
        {
          ">": [{ "/": [{ var: "total" }, { var: "discount" }] }, 100],
        },
        {
          min: [{ var: "value1" }, { var: "value2" }, 1000],
        },
        {
          max: [{ "%": [{ var: "amount" }, 12] }, 50],
        },
      ],
    };

    const result = validateExpression(mathExpression);
    expect(result.valid).toBe(true);
  });

  test("should validate expressions with string operations", () => {
    const stringExpression = {
      id: "string-ops",
      name: "String Operations",
      description: "String manipulation and validation",
      multipleOperations: "or" as const,
      operations: [
        {
          "==": [
            { cat: [{ var: "firstName" }, " ", { var: "lastName" }] },
            "John Doe",
          ],
        },
        {
          ">": [{ length: [{ var: "description" }] }, 10],
        },
        {
          in: [
            { substr: [{ var: "email" }, 0, 5] },
            ["admin", "user@", "test@"],
          ],
        },
      ],
    };

    const result = validateExpression(stringExpression);
    expect(result.valid).toBe(true);
  });

  test("should validate expressions with array operations", () => {
    const arrayExpression = {
      id: "array-ops",
      name: "Array Operations",
      description: "Array manipulation and validation",
      multipleOperations: "and" as const,
      operations: [
        {
          all: [{ var: "scores" }, { ">": [{ var: "" }, 60] }],
        },
        {
          some: [{ var: "tags" }, { "==": [{ var: "" }, "premium"] }],
        },
        {
          map: [{ var: "items" }, { "+": [{ var: "price" }, { var: "tax" }] }],
        },
      ],
    };

    const result = validateExpression(arrayExpression);
    expect(result.valid).toBe(true);
  });

  test("should validate expressions with conditional operations", () => {
    const conditionalExpression = {
      id: "conditional",
      name: "Conditional Logic",
      description: "Complex conditional expressions",
      multipleOperations: "and" as const,
      operations: [
        {
          if: [
            { ">": [{ var: "age" }, 65] },
            "senior",
            {
              if: [{ ">": [{ var: "age" }, 18] }, "adult", "minor"],
            },
          ],
        },
        {
          "?:": [
            { "==": [{ var: "status" }, "active"] },
            { var: "activeRate" },
            { var: "inactiveRate" },
          ],
        },
        {
          "??": [{ var: "preferredName" }, { var: "firstName" }],
        },
      ],
    };

    const result = validateExpression(conditionalExpression);
    expect(result.valid).toBe(true);
  });

  test("should validate expressions with logical operations", () => {
    const logicalExpression = {
      id: "logical",
      name: "Logical Operations",
      description: "Boolean logic operations",
      multipleOperations: "or" as const,
      operations: [
        {
          and: [
            { "!!": [{ var: "isActive" }] },
            { not: [{ var: "isBlocked" }] },
            { "!": [{ var: "isExpired" }] },
          ],
        },
        {
          or: [
            { "===": [{ var: "role" }, "admin"] },
            { "!==": [{ var: "permissions" }, null] },
          ],
        },
      ],
    };

    const result = validateExpression(logicalExpression);
    expect(result.valid).toBe(true);
  });

  test("should validate expressions with object operations", () => {
    const objectExpression = {
      id: "object-ops",
      name: "Object Operations",
      description: "Object manipulation operations",
      multipleOperations: "and" as const,
      operations: [
        {
          exists: [{ var: "profile.avatar" }],
        },
        {
          get: [{ var: "settings" }, "theme", "light"],
        },
        {
          missing: [["email", "phone"]],
        },
        {
          missing_some: [2, ["name", "email", "phone"]],
        },
        {
          merge: [{ var: "defaultSettings" }, { var: "userSettings" }],
        },
      ],
    };

    const result = validateExpression(objectExpression);
    expect(result.valid).toBe(true);
  });

  test("should validate expressions with various operand types", () => {
    const mixedOperandsExpression = {
      id: "mixed-operands",
      name: "Mixed Operand Types",
      description: "Expression using different operand types",
      multipleOperations: "and" as const,
      operations: [
        {
          // Value operands: primitives
          ">": [42, 30],
        },
        {
          // Variable operand
          "==": [{ var: "status" }, "active"],
        },
        {
          // Value array operand
          in: [{ val: ["admin", "user", "guest"] }, { var: "role" }],
        },
        {
          // Boolean operands
          "==": [true, { var: "isEnabled" }],
        },
        {
          // Null operand
          "!=": [{ var: "deletedAt" }, null],
        },
        {
          // Date-time format (as string with format)
          ">": [{ var: "createdAt" }, "2024-01-01T00:00:00Z"],
        },
      ],
    };

    const result = validateExpression(mixedOperandsExpression);
    expect(result.valid).toBe(true);
  });

  test("should fail validation for invalid operation structure", () => {
    const invalidExpression = {
      id: "invalid",
      name: "Invalid Expression",
      description: "Expression with invalid operations",
      multipleOperations: "and" as const,
      operations: [
        {
          // Invalid: using unsupported operator
          invalidOperator: [{ var: "test" }],
        },
      ],
    };

    const result = validateExpression(invalidExpression);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  test("should fail validation for missing required properties", () => {
    const incompleteExpression = {
      id: "incomplete",
      // Missing: name, description, multipleOperations, operations
    };

    const result = validateExpression(incompleteExpression);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.some((e) => e.keyword === "required")).toBe(true);
  });

  test("should fail validation for invalid operand structure", () => {
    const invalidOperandExpression = {
      id: "invalid-operand",
      name: "Invalid Operand",
      description: "Expression with invalid operand structure",
      multipleOperations: "invalid" as any, // Invalid multipleOperations value
      operations: [
        {
          ">": [{ var: "test" }, 100],
        },
      ],
    };

    const result = validateExpression(invalidOperandExpression);
    expect(result.valid).toBe(false);
  });

  test("should validate deeply nested expressions", () => {
    const deeplyNestedExpression = {
      id: "deeply-nested",
      name: "Deeply Nested Expression",
      description: "Expression with multiple levels of nesting",
      multipleOperations: "and" as const,
      operations: [
        {
          or: [
            {
              and: [
                {
                  ">": [{ var: "level1.level2.value" }, 0],
                },
                {
                  if: [
                    { "==": [{ var: "type" }, "premium"] },
                    {
                      "*": [
                        { var: "baseAmount" },
                        {
                          "+": [1, { "/": [{ var: "bonus" }, 100] }],
                        },
                      ],
                    },
                    { var: "baseAmount" },
                  ],
                },
              ],
            },
            {
              all: [
                { var: "items" },
                {
                  and: [
                    { "!=": [{ var: "status" }, null] },
                    { in: [{ var: "category" }, ["A", "B", "C"]] },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const result = validateExpression(deeplyNestedExpression);
    expect(result.valid).toBe(true);
  });

  test("should validate expression with all supported operators", () => {
    const allOperatorsExpression = {
      id: "all-operators",
      name: "All Operators Test",
      description: "Expression testing all supported operators",
      multipleOperations: "or" as const,
      operations: [
        // Arithmetic
        { "+": [1, 2] },
        { "-": [5, 3] },
        { "*": [3, 4] },
        { "/": [10, 2] },
        { "%": [10, 3] },
        { min: [1, 2, 3] },
        { max: [1, 2, 3] },

        // Comparison
        { ">": [5, 3] },
        { ">=": [5, 3] },
        { "<": [3, 5] },
        { "<=": [3, 5] },

        // Logical
        { not: [false] },
        { "!": [false] },
        { "!!": ["truthy"] },
        { and: [true, true] },
        { or: [false, true] },
        { "??": [null, "default"] },

        // Equality
        { "==": ["a", "a"] },
        { "===": ["a", "a"] },
        { "!=": ["a", "b"] },
        { "!==": ["a", "b"] },

        // Conditional
        { if: [true, "yes", "no"] },
        { "?:": [true, "yes", "no"] },

        // String
        { cat: ["Hello", " ", "World"] },
        { substr: ["Hello", 0, 2] },
        { length: ["test"] },

        // Array/Object
        { in: ["a", ["a", "b"]] },
        { merge: [{ a: 1 }, { b: 2 }] },
        { get: [{ a: 1 }, "a"] },
        { preserve: [{ a: 1, b: 2 }, ["a"]] },
        { keys: [{ a: 1, b: 2 }] },
        { val: [{ a: 1, b: 2 }] },
        { exists: [{ var: "test" }] },
        { missing: [["field"]] },
        { missing_some: [1, ["field1", "field2"]] },

        // Higher-order
        { map: [[1, 2, 3], { "*": [{ var: "" }, 2] }] },
        {
          reduce: [
            [1, 2, 3],
            { "+": [{ var: "accumulator" }, { var: "current" }] },
            0,
          ],
        },
        { Filter: [[1, 2, 3], { ">": [{ var: "" }, 1] }] },
        { every: [[2, 4, 6], { "==": [{ "%": [{ var: "" }, 2] }, 0] }] },
        { all: [[2, 4, 6], { "==": [{ "%": [{ var: "" }, 2] }, 0] }] },
        { some: [[1, 3, 5], { "==": [{ "%": [{ var: "" }, 2] }, 1] }] },
        { none: [[1, 3, 5], { "==": [{ "%": [{ var: "" }, 2] }, 0] }] },
        { eachKey: [{ a: 1, b: 2 }, { ">": [{ var: "" }, 0] }] },
      ],
    };

    const result = validateExpression(allOperatorsExpression);
    expect(result.valid).toBe(true);
  });
});
