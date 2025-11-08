import type { Operator, SpecContext } from "../core/types.js";
import type { FieldOperatorInput } from "./field-spec.js";
import { FieldSpec } from "./field-spec.js";
import type { MaybePromise } from "../utils/types.js";

/**
 * Configuration options for creating a field-based operator.
 * 
 * @typeParam T - The root object type
 * @typeParam Ctx - The context type
 */
interface CreateFieldOperatorOptions<T, Ctx extends SpecContext> {
  /** Unique operator identifier (e.g., "eq", "gte", "contains") */
  kind: string;
  /** Function that generates human-readable failure reason */
  reason: (input: FieldOperatorInput) => string;
  /** Predicate function that evaluates the field value */
  predicate: (params: {
    /** The extracted field value */
    actual: unknown;
    /** The entire root object */
    root: T;
    /** Optional evaluation context */
    ctx?: Ctx;
    /** The operator input (path, value, etc.) */
    input: FieldOperatorInput;
  }) => MaybePromise<boolean>;
}

/**
 * Factory function for creating field-based operators.
 * 
 * Simplifies operator creation by handling field extraction, error messages,
 * and spec instantiation. Supports both sync and async predicates.
 * 
 * @param options - Configuration for the operator
 * @param options.kind - Operator identifier
 * @param options.reason - Function to generate failure explanation
 * @param options.predicate - Evaluation logic
 * @returns A new operator instance
 * 
 * @example
 * ```typescript
 * const gteOperator = createFieldOperator({
 *   kind: "gte",
 *   reason: (input) => `${input.path} must be >= ${input.value}`,
 *   predicate: ({ actual, input }) => {
 *     return typeof actual === "number" && actual >= input.value;
 *   }
 * });
 * 
 * const spec = gteOperator.create({ path: "age", value: 18 });
 * ```
 */
export const createFieldOperator = <T, Ctx extends SpecContext = SpecContext>(
  options: CreateFieldOperatorOptions<T, Ctx>,
): Operator<FieldOperatorInput, T, Ctx> => {
  return {
    kind: options.kind,
    create: (input: FieldOperatorInput) => {
      return new FieldSpec<T, Ctx>({
        kind: options.kind,
        path: input.path,
        input,
        reason: options.reason(input),
        predicate: (actual, root, ctx) => options.predicate({ actual, root, ctx, input }),
      });
    },
  };
};
