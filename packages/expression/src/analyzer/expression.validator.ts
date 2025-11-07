import type { ExpressionSchema, Operation } from "../expression.ts";
import { ExpressionAnalyzer } from "./expression.analyzer.js";

/**
 * Expression validation utilities
 */
export class ExpressionValidator {
  /**
   * Validate expression syntax and structure
   */
  static validate(schema: ExpressionSchema): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic structure validation
    if (!schema.id) {
      errors.push("Expression must have an ID");
    }

    if (!schema.name) {
      errors.push("Expression must have a name");
    }

    if (!schema.description) {
      warnings.push("Expression should have a description");
    }

    if (!schema.operations || schema.operations.length === 0) {
      errors.push("Expression must have at least one operation");
    }

    if (!["and", "or"].includes(schema.multipleOperations)) {
      errors.push("Invalid multiple operations type");
    }

    // Validate operations
    schema.operations.forEach((operation, index) => {
      const operationErrors = this.validateOperation(
        operation,
        `operations[${index}]`
      );
      errors.push(...operationErrors);
    });

    // Complexity warnings
    const complexity = ExpressionAnalyzer.calculateComplexity(schema);
    if (complexity > 100) {
      warnings.push(
        `High complexity (${complexity}). Consider breaking into smaller expressions.`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private static validateOperation(
    operation: Operation,
    path: string
  ): string[] {
    const errors: string[] = [];

    if (!operation || typeof operation !== "object") {
      errors.push(`${path}: Operation must be an object`);
      return errors;
    }

    const entries = Object.entries(operation);
    if (entries.length !== 1) {
      errors.push(`${path}: Operation must have exactly one operator`);
      return errors;
    }

    const [operator, args] = entries[0]!;

    // Validate operator
    if (typeof operator !== "string") {
      errors.push(`${path}: Operator must be a string`);
    }

    // Validate arguments based on operator type
    const validationErrors = this.validateOperatorArgs(
      operator,
      args,
      `${path}.${operator}`
    );
    errors.push(...validationErrors);

    return errors;
  }

  private static validateOperatorArgs(
    operator: string,
    args: any,
    path: string
  ): string[] {
    const errors: string[] = [];

    // Define expected argument counts for different operators
    const argRequirements: Record<
      string,
      { min?: number; max?: number; exact?: number }
    > = {
      // Unary operators
      not: { exact: 1 },
      abs: { exact: 1 },
      round: { exact: 1 },
      // Binary operators
      "+": { min: 1 },
      "-": { exact: 2 },
      "*": { min: 1 },
      "/": { exact: 2 },
      ">": { exact: 2 },
      ">=": { exact: 2 },
      "<": { exact: 2 },
      "<=": { exact: 2 },
      "==": { exact: 2 },
      "===": { exact: 2 },
      "!=": { exact: 2 },
      "!==": { exact: 2 },
      // Variable operators
      and: { min: 1 },
      or: { min: 1 },
      if: { min: 2, max: 3 },
    };

    const requirement = argRequirements[operator];
    if (requirement) {
      const argCount = Array.isArray(args) ? args.length : 1;

      if (requirement.exact && argCount !== requirement.exact) {
        errors.push(
          `${path}: Expected exactly ${requirement.exact} arguments, got ${argCount}`
        );
      } else if (requirement.min && argCount < requirement.min) {
        errors.push(
          `${path}: Expected at least ${requirement.min} arguments, got ${argCount}`
        );
      } else if (requirement.max && argCount > requirement.max) {
        errors.push(
          `${path}: Expected at most ${requirement.max} arguments, got ${argCount}`
        );
      }
    }

    // Recursively validate nested operations
    const argsArray = Array.isArray(args) ? args : [args];
    argsArray.forEach((arg, index) => {
      if (
        arg &&
        typeof arg === "object" &&
        !("var" in arg) &&
        !("val" in arg) &&
        !("ref" in arg) &&
        !("literal" in arg)
      ) {
        // It's a nested operation
        const nestedErrors = this.validateOperation(
          arg as Operation,
          `${path}[${index}]`
        );
        errors.push(...nestedErrors);
      }
    });

    return errors;
  }
}
