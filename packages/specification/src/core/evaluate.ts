import type { Specification, SpecContext } from "./types.js";
import type { MaybePromise } from "../utils/types.js";

export const evaluateSpec = <T, Ctx extends SpecContext>(
  spec: Specification<T, Ctx>,
  value: T,
  ctx?: Ctx,
): MaybePromise<boolean> => {
  if (spec.isSatisfiedByAsync) {
    return spec.isSatisfiedByAsync(value, ctx);
  }
  return spec.isSatisfiedBy(value, ctx);
};
