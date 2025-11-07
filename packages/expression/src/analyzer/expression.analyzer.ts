/**
 * Expression utilities and helper functions
 */

import type {
  ExpressionSchema,
  Operation,
} from "../expression.ts";

/**
 * Expression analysis and optimization utilities
 */
export class ExpressionAnalyzer {
  /**
   * Extract all variable references from an expression
   */
  static extractVariables(schema: ExpressionSchema): string[] {
    const variables = new Set<string>();

    const extractFromOperand = (operand: any): void => {
      if (operand && typeof operand === "object") {
        if ("var" in operand && typeof operand.var === "string") {
          variables.add(operand.var);
        } else if (Array.isArray(operand)) {
          operand.forEach(extractFromOperand);
        } else {
          Object.values(operand).forEach(extractFromOperand);
        }
      }
    };

    const extractFromOperation = (operation: Operation): void => {
      Object.values(operation).forEach(extractFromOperand);
    };

    schema.operations.forEach(extractFromOperation);

    return Array.from(variables).sort();
  }

  /**
   * Extract all literal values from an expression
   */
  static extractLiterals(schema: ExpressionSchema): unknown[] {
    const literals = new Set<unknown>();

    const extractFromOperand = (operand: any): void => {
      if (operand && typeof operand === "object") {
        if ("literal" in operand) {
          literals.add(operand.literal);
        } else if ("val" in operand && Array.isArray(operand.val)) {
          operand.val.forEach((v: unknown) => literals.add(v));
        } else if (Array.isArray(operand)) {
          operand.forEach(extractFromOperand);
        } else {
          Object.values(operand).forEach(extractFromOperand);
        }
      } else if (
        typeof operand === "string" ||
        typeof operand === "number" ||
        typeof operand === "boolean"
      ) {
        literals.add(operand);
      }
    };

    const extractFromOperation = (operation: Operation): void => {
      Object.values(operation).forEach(extractFromOperand);
    };

    schema.operations.forEach(extractFromOperation);

    return Array.from(literals);
  }

  /**
   * Calculate expression complexity (rough estimate)
   */
  static calculateComplexity(schema: ExpressionSchema): number {
    let complexity = 0;

    const analyzeOperand = (operand: any): number => {
      if (operand && typeof operand === "object") {
        if (
          "var" in operand ||
          "val" in operand ||
          "ref" in operand ||
          "literal" in operand
        ) {
          return 1;
        } else if (Array.isArray(operand)) {
          return operand.reduce((sum, item) => sum + analyzeOperand(item), 0);
        } else {
          // It's an operation
          return Object.entries(operand).reduce((sum, [op, args]) => {
            const opComplexity = getOperatorComplexity(op);
            const argsComplexity = Array.isArray(args)
              ? args.reduce((argSum, arg) => argSum + analyzeOperand(arg), 0)
              : analyzeOperand(args);
            return sum + opComplexity + argsComplexity;
          }, 0);
        }
      }
      return 1; // primitive value
    };

    const getOperatorComplexity = (operator: string): number => {
      // Assign complexity scores to different operators
      const complexityMap: Record<string, number> = {
        // Basic math
        "+": 1,
        "-": 1,
        "*": 2,
        "/": 2,
        "%": 2,
        "**": 3,
        // Comparison
        ">": 1,
        ">=": 1,
        "<": 1,
        "<=": 1,
        "==": 1,
        "===": 1,
        "!=": 1,
        "!==": 1,
        // Logic
        and: 1,
        or: 1,
        not: 1,
        xor: 2,
        // Control flow
        if: 2,
        switch: 3,
        // Array operations (higher complexity)
        map: 4,
        filter: 4,
        reduce: 5,
        find: 3,
        every: 3,
        some: 3,
        // String operations
        concat: 1,
        substring: 2,
        replace: 3,
        split: 2,
        // Default
      };
      return complexityMap[operator] || 2;
    };

    schema.operations.forEach((operation) => {
      complexity += analyzeOperand(operation);
    });

    return complexity;
  }

  /**
   * Detect potential infinite loops or recursive references
   */
  static detectRecursion(schemas: ExpressionSchema[]): string[] {
    const schemaMap = new Map<string, ExpressionSchema>();
    const issues: string[] = [];

    // Build schema lookup
    schemas.forEach((schema) => {
      schemaMap.set(schema.id, schema);
    });

    // Check each schema for recursive references
    schemas.forEach((schema) => {
      const visited = new Set<string>();
      const stack = new Set<string>();

      const checkRecursion = (id: string, path: string[]): void => {
        if (stack.has(id)) {
          issues.push(
            `Circular reference detected: ${path.join(" -> ")} -> ${id}`
          );
          return;
        }

        if (visited.has(id)) {
          return;
        }

        visited.add(id);
        stack.add(id);

        const currentSchema = schemaMap.get(id);
        if (currentSchema) {
          const refs = this.extractReferences(currentSchema);
          refs.forEach((refId) => {
            checkRecursion(refId, [...path, id]);
          });
        }

        stack.delete(id);
      };

      checkRecursion(schema.id, []);
    });

    return issues;
  }

  /**
   * Extract expression references (ref operands)
   */
  static extractReferences(schema: ExpressionSchema): string[] {
    const references = new Set<string>();

    const extractFromOperand = (operand: any): void => {
      if (operand && typeof operand === "object") {
        if ("ref" in operand && typeof operand.ref === "string") {
          references.add(operand.ref);
        } else if (Array.isArray(operand)) {
          operand.forEach(extractFromOperand);
        } else {
          Object.values(operand).forEach(extractFromOperand);
        }
      }
    };

    const extractFromOperation = (operation: Operation): void => {
      Object.values(operation).forEach(extractFromOperand);
    };

    schema.operations.forEach(extractFromOperation);

    return Array.from(references);
  }

  /**
   * Generate a summary report of the expression
   */
  static generateSummary(schema: ExpressionSchema): {
    id: string;
    name: string;
    complexity: number;
    operationsCount: number;
    variablesCount: number;
    variables: string[];
    literalsCount: number;
    referencesCount: number;
    references: string[];
    estimatedPerformance: "fast" | "medium" | "slow";
  } {
    const variables = this.extractVariables(schema);
    const literals = this.extractLiterals(schema);
    const references = this.extractReferences(schema);
    const complexity = this.calculateComplexity(schema);

    const estimatedPerformance =
      complexity < 10 ? "fast" : complexity < 50 ? "medium" : "slow";

    return {
      id: schema.id,
      name: schema.name,
      complexity,
      operationsCount: schema.operations.length,
      variablesCount: variables.length,
      variables,
      literalsCount: literals.length,
      referencesCount: references.length,
      references,
      estimatedPerformance,
    };
  }
}