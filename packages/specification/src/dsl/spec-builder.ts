import type { Registry, Specification, SpecContext } from "../core/types.js";
import { builtInOperators } from "../ops/index.js";
import { createRegistry } from "../core/registry.js";
import type { FieldOperatorInput } from "../ops/field-spec.js";

/**
 * @internal
 * Extracts the value type for a single path segment, handling array indexing.
 */
type SegmentValue<T, Segment extends string> = Segment extends `${infer Prop}[${string}]`
  ? Prop extends keyof T
    ? T[Prop] extends Array<infer U>
      ? U
      : T[Prop]
    : never
  : Segment extends keyof T
    ? T[Segment]
    : never;

/**
 * @internal
 * Recursively extracts the value type for a dotted field path.
 * Handles nested objects and arrays.
 */
type PathValue<T, P extends string> = P extends `${infer Head}.${infer Rest}`
  ? PathValue<SegmentValue<T, Head>, Rest>
  : SegmentValue<T, P>;

/**
 * @internal
 * Helper type for `contains` operator - extracts array element type if path points to array.
 */
type ContainsArg<T, P extends string> = PathValue<T, P> extends Array<infer U>
  ? U
  : PathValue<T, P>;

/**
 * Type-safe field paths for deeply nested object structures.
 * 
 * Generates all valid dotted paths including array indexing:
 * - Simple properties: `"name"`, `"age"`
 * - Nested objects: `"user.profile.email"`
 * - Arrays: `"tags[0]"`, `"users[0].name"`
 * 
 * Falls back to `string` if T has no string keys.
 * 
 * @typeParam T - The object type
 * 
 * @example
 * ```typescript
 * interface User {
 *   name: string;
 *   profile: { email: string; tags: string[] };
 * }
 * 
 * type Paths = FieldPath<User>;
 * // "name" | "profile" | "profile.email" | "profile.tags" | "profile.tags[0]"
 * ```
 */
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

/**
 * Fluent builder interface for constructing field-based specifications.
 * 
 * Provides type-safe methods for all built-in operators with proper
 * value types derived from the field path.
 * 
 * @typeParam T - The root object type
 * @typeParam P - The field path string literal type
 * @typeParam Ctx - The context type
 * 
 * @example
 * ```typescript
 * const builder: FieldBuilder<User, "age", MyContext> = 
 *   spec.field("age");
 * 
 * builder.gte(18);  // Type-safe: age must be number
 * builder.eq(25);   // ✓
 * builder.eq("25"); // ✗ Type error
 * ```
 */
export interface FieldBuilder<T, P extends string, Ctx extends SpecContext> {
  /** Field equals value */
  eq(value: PathValue<T, P>): Specification<T, Ctx>;
  /** Field not equals value */
  ne(value: PathValue<T, P>): Specification<T, Ctx>;
  /** Field less than value (numeric comparison) */
  lt(value: number): Specification<T, Ctx>;
  /** Field less than or equal to value (numeric comparison) */
  lte(value: number): Specification<T, Ctx>;
  /** Field greater than value (numeric comparison) */
  gt(value: number): Specification<T, Ctx>;
  /** Field greater than or equal to value (numeric comparison) */
  gte(value: number): Specification<T, Ctx>;
  /** Field value is in the provided array */
  in(values: PathValue<T, P>[]): Specification<T, Ctx>;
  /** Field value is not in the provided array */
  notIn(values: PathValue<T, P>[]): Specification<T, Ctx>;
  /** Field exists (not null/undefined) */
  exists(): Specification<T, Ctx>;
  /** Field is missing (null/undefined) */
  missing(): Specification<T, Ctx>;
  /** Field matches regex pattern */
  regex(pattern: string, flags?: string): Specification<T, Ctx>;
  /** String field starts with value */
  startsWith(value: string): Specification<T, Ctx>;
  /** String field ends with value */
  endsWith(value: string): Specification<T, Ctx>;
  /** Array contains value or string contains substring */
  contains(value: ContainsArg<T, P>): Specification<T, Ctx>;
  /** Array/string length equals value */
  lengthEq(value: number): Specification<T, Ctx>;
  /** Array/string length less than value */
  lengthLt(value: number): Specification<T, Ctx>;
  /** Array/string length less than or equal to value */
  lengthLte(value: number): Specification<T, Ctx>;
  /** Array/string length greater than value */
  lengthGt(value: number): Specification<T, Ctx>;
  /** Array/string length greater than or equal to value */
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

/**
 * @internal
 * Factory methods for creating specifications without type safety.
 * Used by `spec.op.*` for dynamic operator invocation.
 */
type OpFactory<TContext extends SpecContext> = Record<
  string,
  (path: string, value?: unknown) => Specification<unknown, TContext>
>;

/**
 * Main DSL interface for building specifications with a fluent API.
 * 
 * Provides two ways to build specifications:
 * 1. **Type-safe field builder**: `spec.field("age").gte(18)`
 * 2. **Dynamic operator invocation**: `spec.op.gte("age", 18)`
 * 
 * @typeParam TContext - The context type (defaults to SpecContext)
 * 
 * @example
 * ```typescript
 * // Type-safe builder (recommended)
 * const spec1 = spec.field<User>("age").gte(18);
 * 
 * // Dynamic operator (for runtime paths)
 * const fieldName = getUserInput();
 * const spec2 = spec.op.gte(fieldName, 18);
 * 
 * // Access registry for plugins
 * geoPlugin.register(spec.registry);
 * ```
 */
export interface SpecDSL<TContext extends SpecContext = SpecContext> {
  /** The underlying registry (for plugin registration) */
  readonly registry: Registry;
  /** Creates a type-safe field builder for the given path */
  field<TModel>(path: FieldPath<TModel>): FieldBuilder<TModel, Extract<FieldPath<TModel>, string>, TContext>;
  /** Dynamic operator invocation without type safety */
  op: OpFactory<TContext>;
}

/**
 * Creates a new DSL instance with an optional custom registry.
 * 
 * The DSL provides a fluent API for building specifications.
 * Uses built-in operators by default but can be customized via registry.
 * 
 * @param registry - Optional custom registry (defaults to built-in operators)
 * @returns A new DSL instance
 * 
 * @example
 * ```typescript
 * // Default DSL with built-in operators
 * const spec = createSpecDSL();
 * 
 * // Custom DSL with plugins
 * const customRegistry = createRegistry({
 *   operators: [...builtInOperators, ...customOperators]
 * });
 * const customSpec = createSpecDSL(customRegistry);
 * ```
 */
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

/**
 * Default DSL instance with built-in operators pre-registered.
 * 
 * Ready to use out-of-the-box for most use cases.
 * 
 * @example
 * ```typescript
 * import { spec } from "@fajarnugraha37/specification";
 * 
 * const ageCheck = spec.field<User>("age").gte(18);
 * const emailCheck = spec.field<User>("email").exists();
 * const combined = ageCheck.and(emailCheck);
 * 
 * combined.isSatisfiedBy({ age: 25, email: "user@example.com" }); // true
 * ```
 */
export const spec = createSpecDSL();
