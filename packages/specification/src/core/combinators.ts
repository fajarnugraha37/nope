import { createAllSpec, createAnySpec, createNotSpec } from "./base-spec.js";
import type { Specification, SpecContext } from "./types.js";

export const all = <T, Ctx extends SpecContext>(
  ...specs: Specification<T, Ctx>[]
): Specification<T, Ctx> => createAllSpec(specs);

export const any = <T, Ctx extends SpecContext>(
  ...specs: Specification<T, Ctx>[]
): Specification<T, Ctx> => createAnySpec(specs);

export const none = <T, Ctx extends SpecContext>(
  ...specs: Specification<T, Ctx>[]
): Specification<T, Ctx> => createNotSpec(any(...specs));

export const xor = <T, Ctx extends SpecContext>(
  a: Specification<T, Ctx>,
  b: Specification<T, Ctx>,
): Specification<T, Ctx> => {
  return any(all(a, b.not()), all(a.not(), b));
};

export const implies = <T, Ctx extends SpecContext>(
  premise: Specification<T, Ctx>,
  conclusion: Specification<T, Ctx>,
): Specification<T, Ctx> => {
  return any(premise.not(), conclusion);
};

export const not = <T, Ctx extends SpecContext>(
  spec: Specification<T, Ctx>,
): Specification<T, Ctx> => createNotSpec(spec);
