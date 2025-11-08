import type { Specification, SpecContext } from "../core/types.js";

export interface Adapter<TQuery> {
  compile<T, Ctx extends SpecContext>(spec: Specification<T, Ctx>): TQuery;
}
