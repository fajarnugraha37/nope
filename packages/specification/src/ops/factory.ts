import type { Operator, SpecContext } from "../core/types.js";
import type { FieldOperatorInput } from "./field-spec.js";
import { FieldSpec } from "./field-spec.js";
import type { MaybePromise } from "../utils/types.js";

interface CreateFieldOperatorOptions<T, Ctx extends SpecContext> {
  kind: string;
  reason: (input: FieldOperatorInput) => string;
  predicate: (params: {
    actual: unknown;
    root: T;
    ctx?: Ctx;
    input: FieldOperatorInput;
  }) => MaybePromise<boolean>;
}

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
