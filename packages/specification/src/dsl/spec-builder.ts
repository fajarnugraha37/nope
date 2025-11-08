import type { Registry, Specification, SpecContext } from "../core/types.js";
import { builtInOperators } from "../ops/index.js";
import { createRegistry } from "../core/registry.js";
import type { FieldOperatorInput } from "../ops/field-spec.js";

type SegmentValue<T, Segment extends string> = Segment extends `${infer Prop}[${string}]`
  ? Prop extends keyof T
    ? T[Prop] extends Array<infer U>
      ? U
      : T[Prop]
    : never
  : Segment extends keyof T
    ? T[Segment]
    : never;

type PathValue<T, P extends string> = P extends `${infer Head}.${infer Rest}`
  ? PathValue<SegmentValue<T, Head>, Rest>
  : SegmentValue<T, P>;

type ContainsArg<T, P extends string> = PathValue<T, P> extends Array<infer U>
  ? U
  : PathValue<T, P>;

export type FieldPath<T> = Extract<keyof T, string> extends never
  ? string
  : {
      [K in keyof T & string]: T[K] extends Array<infer V>
        ?
            | `${K}`
            | `${K}[${number}]`
            | (FieldPath<V> extends infer P extends string ? `${K}[${number}].${P}` : never)
        : T[K] extends object
          ? `${K}` | (FieldPath<T[K]> extends infer P extends string ? `${K}.${P}` : never)
          : `${K}`;
    }[keyof T & string];

export interface FieldBuilder<T, P extends string, Ctx extends SpecContext> {
  eq(value: PathValue<T, P>): Specification<T, Ctx>;
  ne(value: PathValue<T, P>): Specification<T, Ctx>;
  lt(value: number): Specification<T, Ctx>;
  lte(value: number): Specification<T, Ctx>;
  gt(value: number): Specification<T, Ctx>;
  gte(value: number): Specification<T, Ctx>;
  in(values: PathValue<T, P>[]): Specification<T, Ctx>;
  notIn(values: PathValue<T, P>[]): Specification<T, Ctx>;
  exists(): Specification<T, Ctx>;
  missing(): Specification<T, Ctx>;
  regex(pattern: string, flags?: string): Specification<T, Ctx>;
  startsWith(value: string): Specification<T, Ctx>;
  endsWith(value: string): Specification<T, Ctx>;
  contains(value: ContainsArg<T, P>): Specification<T, Ctx>;
  lengthEq(value: number): Specification<T, Ctx>;
  lengthLt(value: number): Specification<T, Ctx>;
  lengthLte(value: number): Specification<T, Ctx>;
  lengthGt(value: number): Specification<T, Ctx>;
  lengthGte(value: number): Specification<T, Ctx>;
}

type OperatorFactory<T, Ctx extends SpecContext> = (
  kind: string,
  input: FieldOperatorInput,
) => Specification<T, Ctx>;

class FieldBuilderImpl<T, P extends string, Ctx extends SpecContext>
  implements FieldBuilder<T, P, Ctx>
{
  constructor(
    private readonly path: string,
    private readonly factory: OperatorFactory<T, Ctx>,
  ) {}

  eq(value: PathValue<T, P>) {
    return this.factory("eq", { path: this.path, value });
  }
  ne(value: PathValue<T, P>) {
    return this.factory("ne", { path: this.path, value });
  }
  lt(value: number) {
    return this.factory("lt", { path: this.path, value });
  }
  lte(value: number) {
    return this.factory("lte", { path: this.path, value });
  }
  gt(value: number) {
    return this.factory("gt", { path: this.path, value });
  }
  gte(value: number) {
    return this.factory("gte", { path: this.path, value });
  }
  in(values: PathValue<T, P>[]) {
    return this.factory("in", { path: this.path, values });
  }
  notIn(values: PathValue<T, P>[]) {
    return this.factory("notIn", { path: this.path, values });
  }
  exists() {
    return this.factory("exists", { path: this.path });
  }
  missing() {
    return this.factory("missing", { path: this.path });
  }
  regex(pattern: string, flags?: string) {
    return this.factory("regex", { path: this.path, pattern, flags });
  }
  startsWith(value: string) {
    return this.factory("startsWith", { path: this.path, value });
  }
  endsWith(value: string) {
    return this.factory("endsWith", { path: this.path, value });
  }
  contains(value: ContainsArg<T, P>) {
    return this.factory("contains", { path: this.path, value });
  }
  lengthEq(value: number) {
    return this.factory("lengthEq", { path: this.path, value });
  }
  lengthLt(value: number) {
    return this.factory("lengthLt", { path: this.path, value });
  }
  lengthLte(value: number) {
    return this.factory("lengthLte", { path: this.path, value });
  }
  lengthGt(value: number) {
    return this.factory("lengthGt", { path: this.path, value });
  }
  lengthGte(value: number) {
    return this.factory("lengthGte", { path: this.path, value });
  }
}

type OpFactory<TContext extends SpecContext> = Record<
  string,
  (path: string, value?: unknown) => Specification<unknown, TContext>
>;

export interface SpecDSL<TContext extends SpecContext = SpecContext> {
  readonly registry: Registry;
  field<TModel>(path: FieldPath<TModel>): FieldBuilder<TModel, Extract<FieldPath<TModel>, string>, TContext>;
  op: OpFactory<TContext>;
}

export const createSpecDSL = <TContext extends SpecContext = SpecContext>(
  registry: Registry = createRegistry({ operators: builtInOperators }),
) => {
  const ensure = <T, Ctx extends SpecContext>(
    kind: string,
    input: FieldOperatorInput,
  ): Specification<T, Ctx> => {
    const operator = registry.getOperator(kind);
    if (!operator) {
      throw new Error(`Operator "${kind}" is not registered`);
    }
    return operator.create(input);
  };

  const op: OpFactory<TContext> = {
    eq: (path, value) => ensure("eq", { path, value }),
    ne: (path, value) => ensure("ne", { path, value }),
    lt: (path, value) => ensure("lt", { path, value }),
    lte: (path, value) => ensure("lte", { path, value }),
    gt: (path, value) => ensure("gt", { path, value }),
    gte: (path, value) => ensure("gte", { path, value }),
    in: (path, value) => ensure("in", { path, values: Array.isArray(value) ? value : [value] }),
    notIn: (path, value) => ensure("notIn", { path, values: Array.isArray(value) ? value : [value] }),
    exists: (path) => ensure("exists", { path }),
    missing: (path) => ensure("missing", { path }),
    regex: (path, value) => ensure("regex", { path, pattern: String(value) }),
    startsWith: (path, value) => ensure("startsWith", { path, value }),
    endsWith: (path, value) => ensure("endsWith", { path, value }),
    contains: (path, value) => ensure("contains", { path, value }),
    lengthEq: (path, value) => ensure("lengthEq", { path, value }),
    lengthLt: (path, value) => ensure("lengthLt", { path, value }),
    lengthLte: (path, value) => ensure("lengthLte", { path, value }),
    lengthGt: (path, value) => ensure("lengthGt", { path, value }),
    lengthGte: (path, value) => ensure("lengthGte", { path, value }),
  };

  return {
    registry,
    field<TModel>(path: FieldPath<TModel>): FieldBuilder<TModel, Extract<FieldPath<TModel>, string>, TContext> {
      return new FieldBuilderImpl<TModel, Extract<FieldPath<TModel>, string>, TContext>(path as string, ensure);
    },
    op,
  } satisfies SpecDSL<TContext>;
};

export const spec = createSpecDSL();
