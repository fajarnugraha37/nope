import type { ExpressionSchema } from "../expression.js";
import { ExpressionAnalyzer } from "./expression.analyzer.js";

/**
 * Expression debugging utilities
 */
export class ExpressionDebugger {
  /**
   * Format expression for human-readable display
   */
  static format(
    schema: ExpressionSchema,
    options: { indent?: number } = {}
  ): string {
    const indent = options.indent || 2;

    const formatOperand = (operand: any, depth = 0): string => {
      const spaces = " ".repeat(depth * indent);

      if (operand && typeof operand === "object") {
        if ("var" in operand) {
          return `var("${operand.var}")`;
        } else if ("val" in operand) {
          return `val([${operand.val
            .map((v: any) => JSON.stringify(v))
            .join(", ")}])`;
        } else if ("ref" in operand) {
          return `ref("${operand.ref}")`;
        } else if ("literal" in operand) {
          return `literal(${JSON.stringify(operand.literal)})`;
        } else if (Array.isArray(operand)) {
          if (operand.length === 0) return "[]";
          return (
            "[\n" +
            operand
              .map((item) => spaces + "  " + formatOperand(item, depth + 1))
              .join(",\n") +
            "\n" +
            spaces +
            "]"
          );
        } else {
          // It's an operation
          const entries = Object.entries(operand);
          if (entries.length === 1) {
            const [op, args] = entries[0]!;
            if (Array.isArray(args)) {
              return `${op}(\n${args
                .map((arg) => spaces + "  " + formatOperand(arg, depth + 1))
                .join(",\n")}\n${spaces})`;
            } else {
              return `${op}(${formatOperand(args, depth)})`;
            }
          }
        }
      }

      return JSON.stringify(operand);
    };

    const formattedOps = schema.operations
      .map((op) => formatOperand(op))
      .join(",\n");

    return `Expression "${schema.name}" (${schema.id}):\n${schema.multipleOperations}(\n${formattedOps}\n)`;
  }

  /**
   * Generate execution trace information
   */
  static generateTrace(schema: ExpressionSchema): string {
    const variables = ExpressionAnalyzer.extractVariables(schema);
    const references = ExpressionAnalyzer.extractReferences(schema);
    const complexity = ExpressionAnalyzer.calculateComplexity(schema);

    return [
      `Expression: ${schema.name} (${schema.id})`,
      `Description: ${schema.description}`,
      `Operations: ${schema.operations.length}`,
      `Combination: ${schema.multipleOperations}`,
      `Variables: ${variables.length > 0 ? variables.join(", ") : "none"}`,
      `References: ${references.length > 0 ? references.join(", ") : "none"}`,
      `Complexity: ${complexity}`,
      `Version: ${schema.version || "unversioned"}`,
      schema.metadata?.tags ? `Tags: ${schema.metadata.tags.join(", ")}` : null,
      schema.metadata?.category
        ? `Category: ${schema.metadata.category}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");
  }
}
