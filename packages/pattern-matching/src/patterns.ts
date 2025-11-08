/**
 * The `P` module contains patterns for primitive types, wildcards and
 * other pattern-matching utilities.
 *
 * @module
 */

import {
  matchPattern,
  getSelectionKeys,
  flatMap,
} from "./internals/helpers.js";
import * as symbols from "./internals/symbols.js";
import { matcher } from "./internals/symbols.js";
import { isMatching } from "./is-matching.js";
import type { ExtractPreciseValue } from "./types/extract-precise-value.js";
import type { Fn, NoInfer } from "./types/helpers.js";
import type { InvertPattern } from "./types/invert-pattern.js";
import type {
  Pattern,
  UnknownValuePattern,
  OptionalP,
  ArrayP,
  MapP,
  SetP,
  AndP,
  OrP,
  NotP,
  GuardP,
  SelectP,
  AnonymousSelectP,
  GuardExcludeP,
  CustomP,
  Matcher,
  StringPattern,
  UnknownPattern,
  NumberPattern,
  BooleanPattern,
  BigIntPattern,
  NullishPattern,
  SymbolPattern,
  Chainable,
  BigIntChainable,
  NumberChainable,
  StringChainable,
  ArrayChainable,
  Variadic,
  NonNullablePattern,
  RecordP,
  SetChainable,
  MapChainable,
  LazyP,
} from "./types/pattern.js";

export type {
  /**
   * `Pattern<T>` is the type of all patterns
   * that can match a value of type `T`.
   */
  Pattern,

  /**
   * `unstable_Fn` can be used to created a
   * a Matchable instance – a custom type that
   * can be used as a pattern.
   *
   * @experimental This feature is unstable.
   */
  Fn as unstable_Fn,
};

export { matcher };

/**
 * A `Matchable` is an object implementing
 * the Matcher Protocol. It must have a `[P.matcher]: P.Matcher<NarrowFn>`
 * key, which defines how this object should be matched.
 *
 * @experimental This feature is unstable.
 *
 * @example
 * ```ts
 * class Some<T> implements P.unstable_Matchable {
 *  [P.matcher](): P.unstable_Matcher<Some<T>>
 * }
 * ```
 */
export type unstable_Matchable<
  narrowedOrFn,
  input = unknown,
  pattern = never
> = CustomP<input, pattern, narrowedOrFn>;

/**
 * A `Matcher` is an object with `match` function, which
 * defines how this object should be matched.
 *
 * @experimental This feature is unstable.
 *
 * @example
 * ```ts
 * class Some<T> implements P.unstable_Matchable {
 *  [P.matcher](): P.unstable_Matcher<Some<T>>
 * }
 * ```
 */
export type unstable_Matcher<
  narrowedOrFn,
  input = unknown,
  pattern = never
> = ReturnType<CustomP<input, pattern, narrowedOrFn>[matcher]>;

/**
 * `P.infer<typeof somePattern>` will return the type of the value
 * matched by this pattern.
 *
 * @example
 * const userPattern = { name: P.string }
 * type User = P.infer<typeof userPattern>
 */
export type infer<pattern> = InvertPattern<NoInfer<pattern>, unknown>;

/**
 * `P.narrow<Input, Pattern>` will narrow the input type to only keep
 * the set of values that are compatible with the provided pattern type.
 *
 * @example
 * type Input = ['a' | 'b' | 'c', 'a' | 'b' | 'c']
 * const Pattern = ['a', P.union('a', 'b')] as const
 *
 * type Narrowed = P.narrow<Input, typeof Pattern>
 * //     ^? ['a', 'a' | 'b']
 */
export type narrow<input, pattern> = ExtractPreciseValue<
  input,
  InvertPattern<pattern, input>
>;

function chainable<pattern extends Matcher<any, any, any, any, any>>(
  pattern: pattern
): Chainable<pattern> {
  return Object.assign(pattern, {
    optional: () => optional(pattern),
    and: (p2: any) => intersection(pattern, p2),
    or: (p2: any) => union(pattern, p2),
    select: (key: any) =>
      key === undefined ? select(pattern) : select(key, pattern),
  }) as Chainable<pattern>;
}

const variadic = <pattern extends {}>(pattern: pattern): Variadic<pattern> =>
  Object.assign(pattern, {
    [Symbol.iterator](): Iterator<pattern, void, undefined> {
      let i = 0;
      const variadicPattern = Object.assign(pattern, {
        [symbols.isVariadic]: true,
      });
      const values: IteratorResult<pattern, void>[] = [
        { value: variadicPattern, done: false },
        { done: true, value: undefined },
      ];
      return {
        next: () => values[i++] ?? values.at(-1)!,
      };
    },
  });

function arrayLengthGuard<input>(
  predicate: (value: readonly unknown[]) => boolean
): GuardExcludeP<input, readonly unknown[], never> {
  return when((value: input): value is Extract<input, readonly unknown[]> => {
    if (!Array.isArray(value)) return false;
    return predicate(value);
  });
}

const arrayExactLength = <input>(len: number) =>
  arrayLengthGuard<input>((value) => value.length === len);

const arrayMinLength = <input>(min: number) =>
  arrayLengthGuard<input>((value) => value.length >= min);

const arrayMaxLength = <input>(max: number) =>
  arrayLengthGuard<input>((value) => value.length <= max);

function arrayChainable<pattern extends Matcher<any, any, any, any, any>>(
  pattern: pattern
): ArrayChainable<pattern> {
  return Object.assign(variadic(pattern), {
    optional: () => arrayChainable(optional(pattern)),
    select: (key: any) =>
      arrayChainable(
        key === undefined ? select(pattern) : select(key, pattern)
      ),
    length: (len: number) =>
      arrayChainable(intersection(pattern, arrayExactLength(len))),
    minLength: (min: number) =>
      arrayChainable(intersection(pattern, arrayMinLength(min))),
    maxLength: (max: number) =>
      arrayChainable(intersection(pattern, arrayMaxLength(max))),
    nonEmpty: () =>
      arrayChainable(intersection(pattern, arrayMinLength(1))),
  }) as any;
}

/**
 * `P.optional(subpattern)` takes a sub pattern and returns a pattern which matches if the
 * key is undefined or if it is defined and the sub pattern matches its value.
 *
 * @example
 *  match(value)
 *   .with({ greeting: P.optional('Hello') }, () => 'will match { greeting?: "Hello" }')
 */
export function optional<
  input,
  const pattern extends unknown extends input
    ? UnknownValuePattern
    : Pattern<input>
>(pattern: pattern): Chainable<OptionalP<input, pattern>, "optional"> {
  return chainable({
    [matcher]() {
      return {
        match: <UnknownInput>(value: UnknownInput | input) => {
          let selections: Record<string, unknown[]> = {};
          const selector = (key: string, value: any) => {
            selections[key] = value;
          };
          if (value === undefined) {
            getSelectionKeys(pattern).forEach((key) =>
              selector(key, undefined)
            );
            return { matched: true, selections };
          }
          const matched = matchPattern(pattern, value, selector);
          return { matched, selections };
        },
        getSelectionKeys: () => getSelectionKeys(pattern),
        matcherType: "optional",
      };
    },
  });
}

type UnwrapArray<xs> = xs extends readonly (infer x)[] ? x : never;

type UnwrapSet<xs> = xs extends Set<infer x> ? x : never;

type UnwrapMapKey<xs> = xs extends Map<infer k, any> ? k : never;

type UnwrapMapValue<xs> = xs extends Map<any, infer v> ? v : never;

type UnwrapRecordKey<xs> = xs extends Record<infer k, any> ? k : never;

type UnwrapRecordValue<xs> = xs extends Record<any, infer v> ? v : never;

type WithDefault<a, b> = [a] extends [never] ? b : a;

/**
 * `P.array(subpattern)` takes a sub pattern and returns a pattern, which matches
 * arrays if all their elements match the sub pattern.
 *
 * @example
 *  match(value)
 *   .with({ users: P.array({ name: P.string }) }, () => 'will match { name: string }[]')
 */
export function array<input>(): ArrayChainable<ArrayP<input, unknown>>;
export function array<
  input,
  const pattern extends Pattern<WithDefault<UnwrapArray<input>, unknown>>
>(pattern: pattern): ArrayChainable<ArrayP<input, pattern>>;
export function array(
  ...args: [pattern?: any]
): ArrayChainable<ArrayP<any, any>> {
  return arrayChainable({
    [matcher]() {
      return {
        match: (value: any) => {
          if (!Array.isArray(value)) return { matched: false };

          if (args.length === 0) return { matched: true };

          const pattern = args[0];
          let selections: Record<string, unknown[]> = {};

          if (value.length === 0) {
            getSelectionKeys(pattern).forEach((key) => {
              selections[key] = [];
            });
            return { matched: true, selections };
          }

          const selector = (key: string, value: unknown) => {
            selections[key] = (selections[key] || []).concat([value]);
          };

          const matched = value.every((v) =>
            matchPattern(pattern, v, selector)
          );

          return { matched, selections };
        },
        getSelectionKeys: () =>
          args.length === 0 ? [] : getSelectionKeys(args[0]),
      };
    },
  });
}

function setChainable<pattern extends Matcher<any, any, any, any, any>>(
  pattern: pattern
): SetChainable<pattern> {
  const base = chainable(pattern) as any;
  base.optional = () => setChainable(optional(pattern));
  base.and = (p2: Pattern<any>) => setChainable(intersection(pattern, p2));
  base.or = (p2: Pattern<any>) => setChainable(union(pattern, p2));
  base.select = (key?: string) =>
    setChainable(
      key === undefined ? select(pattern) : select(key, pattern)
    );

  return Object.assign(base, {
    size: (size: number) =>
      setChainable(intersection(pattern, setExactSize(size))),
    minSize: (min: number) =>
      setChainable(intersection(pattern, setMinSize(min))),
    maxSize: (max: number) =>
      setChainable(intersection(pattern, setMaxSize(max))),
    nonEmpty: () => setChainable(intersection(pattern, setMinSize(1))),
  }) as SetChainable<pattern>;
}

function mapChainable<pattern extends Matcher<any, any, any, any, any>>(
  pattern: pattern
): MapChainable<pattern> {
  const base = chainable(pattern) as any;
  base.optional = () => mapChainable(optional(pattern));
  base.and = (p2: Pattern<any>) => mapChainable(intersection(pattern, p2));
  base.or = (p2: Pattern<any>) => mapChainable(union(pattern, p2));
  base.select = (key?: string) =>
    mapChainable(
      key === undefined ? select(pattern) : select(key, pattern)
    );

  return Object.assign(base, {
    size: (size: number) =>
      mapChainable(intersection(pattern, mapExactSize(size))),
    minSize: (min: number) =>
      mapChainable(intersection(pattern, mapMinSize(min))),
    maxSize: (max: number) =>
      mapChainable(intersection(pattern, mapMaxSize(max))),
    nonEmpty: () => mapChainable(intersection(pattern, mapMinSize(1))),
  }) as MapChainable<pattern>;
}

function setSizeGuard<input>(
  predicate: (value: Set<unknown>) => boolean
): GuardExcludeP<input, Set<unknown>, never> {
  return when((value: input): value is Extract<input, Set<unknown>> => {
    if (!(value instanceof Set)) return false;
    return predicate(value);
  });
}

const setExactSize = <input>(size: number) =>
  setSizeGuard<input>((value) => value.size === size);

const setMinSize = <input>(size: number) =>
  setSizeGuard<input>((value) => value.size >= size);

const setMaxSize = <input>(size: number) =>
  setSizeGuard<input>((value) => value.size <= size);

function mapSizeGuard<input>(
  predicate: (value: Map<unknown, unknown>) => boolean
): GuardExcludeP<input, Map<unknown, unknown>, never> {
  return when((value: input): value is Extract<input, Map<unknown, unknown>> => {
    if (!(value instanceof Map)) return false;
    return predicate(value);
  });
}

const mapExactSize = <input>(size: number) =>
  mapSizeGuard<input>((value) => value.size === size);

const mapMinSize = <input>(size: number) =>
  mapSizeGuard<input>((value) => value.size >= size);

const mapMaxSize = <input>(size: number) =>
  mapSizeGuard<input>((value) => value.size <= size);

/**
 * `P.set(subpattern)` takes a sub pattern and returns a pattern that matches
 * sets if all their elements match the sub pattern.
 *
 * @example
 *  match(value)
 *   .with({ users: P.set(P.string) }, () => 'will match Set<string>')
 */
export function set<input>(): SetChainable<SetP<input, unknown>>;
export function set<
  input,
  const pattern extends Pattern<WithDefault<UnwrapSet<input>, unknown>>
>(pattern: pattern): SetChainable<SetP<input, pattern>>;
export function set<
  input,
  const pattern extends Pattern<WithDefault<UnwrapSet<input>, unknown>>
>(...args: [pattern?: pattern]): SetChainable<SetP<input, pattern>> {
  return setChainable({
    [matcher]() {
      return {
        match: <UnknownInput>(value: UnknownInput | input) => {
          if (!(value instanceof Set)) return { matched: false };

          let selections: Record<string, unknown[]> = {};

          if (value.size === 0) {
            return { matched: true, selections };
          }

          if (args.length === 0) return { matched: true };

          const selector = (key: string, value: unknown) => {
            selections[key] = (selections[key] || []).concat([value]);
          };

          const pattern = args[0];

          const matched = setEvery(value, (v) =>
            matchPattern(pattern, v, selector)
          );

          return { matched, selections };
        },
        getSelectionKeys: () =>
          args.length === 0 ? [] : getSelectionKeys(args[0]),
      };
    },
  });
}

const setEvery = <T>(set: Set<T>, predicate: (value: T) => boolean) => {
  for (const value of set) {
    if (predicate(value)) continue;
    return false;
  }
  return true;
};

/**
 * `P.map(keyPattern, valuePattern)` takes a subpattern to match against the
 * key, a subpattern to match against the value and returns a pattern that
 * matches on maps where all elements inside the map match those two
 * subpatterns.
 *
 * @example
 *  match(value)
 *   .with({ users: P.map(P.map(P.string, P.number)) }, (map) => `map's type is Map<string, number>`)
 */
export function map<input>(): MapChainable<MapP<input, unknown, unknown>>;
export function map<
  input,
  const pkey extends Pattern<WithDefault<UnwrapMapKey<input>, unknown>>,
  const pvalue extends Pattern<WithDefault<UnwrapMapValue<input>, unknown>>
>(patternKey: pkey, patternValue: pvalue): MapChainable<MapP<input, pkey, pvalue>>;
export function map<
  input,
  const pkey extends Pattern<WithDefault<UnwrapMapKey<input>, unknown>>,
  const pvalue extends Pattern<WithDefault<UnwrapMapValue<input>, unknown>>
>(
  ...args: [patternKey?: pkey, patternValue?: pvalue]
): MapChainable<MapP<input, pkey, pvalue>> {
  return mapChainable({
    [matcher]() {
      return {
        match: <UnknownInput>(value: UnknownInput | input) => {
          if (!(value instanceof Map)) return { matched: false };

          let selections: Record<string, unknown[]> = {};

          if (value.size === 0) {
            return { matched: true, selections };
          }

          const selector = (key: string, value: unknown) => {
            selections[key] = (selections[key] || []).concat([value]);
          };

          if (args.length === 0) return { matched: true };
          if (args.length === 1) {
            throw new Error(
              `\`P.map\` wasn\'t given enough arguments. Expected (key, value), received ${args[0]?.toString()}`
            );
          }
          const [patternKey, patternValue] = args;

          const matched = mapEvery(value, (v, k) => {
            const keyMatch = matchPattern(patternKey, k, selector);
            const valueMatch = matchPattern(patternValue, v, selector);
            return keyMatch && valueMatch;
          });

          return { matched, selections };
        },
        getSelectionKeys: () =>
          args.length === 0
            ? []
            : [...getSelectionKeys(args[0]), ...getSelectionKeys(args[1])],
      };
    },
  });
}

const mapEvery = <K, T>(
  map: Map<K, T>,
  predicate: (value: T, key: K) => boolean
) => {
  for (const [key, value] of map.entries()) {
    if (predicate(value, key)) continue;
    return false;
  }
  return true;
};

/**
 * `P.record(keyPattern, valuePattern)` takes a subpattern to match against the
 * key, a subpattern to match against the value and returns a pattern that
 * matches on objects where all entries match those two
 * subpatterns.
 *
 * @example
 *  match(value)
 *   .with({ users: P.record(P.string, P.number) }, (obj) => `object's type is Record<string, number>`)
 */
export function record<
  input,
  const pvalue extends Pattern<UnwrapRecordValue<input>>
>(patternValue: pvalue): Chainable<RecordP<input, StringPattern, pvalue>>;
export function record<
  input,
  const pkey extends Pattern<WithDefault<UnwrapRecordKey<input>, PropertyKey>>,
  const pvalue extends Pattern<WithDefault<UnwrapRecordValue<input>, unknown>>
>(
  patternKey: pkey,
  patternValue?: pvalue
): Chainable<RecordP<input, pkey, pvalue>>;
export function record(
  ...args: [patternKey?: unknown, patternValue?: unknown]
): Chainable<RecordP<unknown, unknown, unknown>> {
  return chainable({
    [matcher]() {
      return {
        match: (value: unknown) => {
          if (
            value === null ||
            typeof value !== "object" ||
            Array.isArray(value)
          ) {
            return { matched: false };
          }

          if (args.length === 0) {
            throw new Error(
              `\`P.record\` wasn\'t given enough arguments. Expected (value) or (key, value), received ${args[0]?.toString()}`
            );
          }

          let selections: Record<string, unknown[]> = {};

          const selector = (key: string, value: unknown) => {
            selections[key] = (selections[key] || []).concat([value]);
          };

          const [patternKey, patternValue] =
            args.length === 1 ? [string, args[0]] : args;

          const matched = recordEvery(value, (k, v) => {
            // since number keys are coerced to strings, we need to coerce them back to numbers if the pattern is `number`
            const coercedKey =
              typeof k === "string" && !Number.isNaN(Number(k))
                ? Number(k)
                : null;

            const coercedKeyMatch =
              coercedKey !== null
                ? matchPattern(patternKey, coercedKey, selector)
                : false;

            const keyMatch = matchPattern(patternKey, k, selector);

            const valueMatch = matchPattern(patternValue, v, selector);

            return (keyMatch || coercedKeyMatch) && valueMatch;
          });

          return { matched, selections };
        },
        getSelectionKeys: () =>
          args.length === 0
            ? []
            : [...getSelectionKeys(args[0]), ...getSelectionKeys(args[1])],
      };
    },
  });
}

const recordEvery = <K extends PropertyKey, T>(
  record: Record<K, T>,
  predicate: (key: K, value: T) => boolean
) => {
  const keys = Reflect.ownKeys(record);
  for (const key of keys) {
    if (predicate(key as K, record[key as K] as T)) continue;
    return false;
  }
  return true;
};

/**
 * `P.intersection(...patterns)` returns a pattern which matches
 * only if **every** patterns provided in parameter match the input.
 *
 * @example
 *  match(value)
 *   .with(
 *     {
 *       user: P.intersection(
 *         { firstname: P.string },
 *         { lastname: P.string },
 *         { age: P.when(age => age > 21) }
 *       )
 *     },
 *     ({ user }) => 'will match { firstname: string, lastname: string, age: number } if age > 21'
 *   )
 */
export function intersection<
  input,
  const patterns extends readonly [Pattern<input>, ...Pattern<input>[]]
>(...patterns: patterns): Chainable<AndP<input, patterns>> {
  return chainable({
    [matcher]: () => ({
      match: (value) => {
        let selections: Record<string, unknown[]> = {};
        const selector = (key: string, value: any) => {
          selections[key] = value;
        };
        const matched = (patterns as readonly UnknownValuePattern[]).every(
          (p) => matchPattern(p, value, selector)
        );
        return { matched, selections };
      },
      getSelectionKeys: () =>
        flatMap(patterns as readonly UnknownValuePattern[], getSelectionKeys),
      matcherType: "and",
    }),
  });
}

/**
 * `P.union(...patterns)` returns a pattern which matches
 * if **at least one** of the patterns provided in parameter match the input.
 *
 * @example
 *  match(value)
 *   .with(
 *     { type: P.union('a', 'b', 'c') },
 *     ({ type }) => 'will match { type: "a" | "b" | "c" }'
 *   )
 */
export function union<
  input,
  const patterns extends readonly [Pattern<input>, ...Pattern<input>[]]
>(...patterns: patterns): Chainable<OrP<input, patterns>> {
  return chainable({
    [matcher]: () => ({
      match: <UnknownInput>(value: UnknownInput | input) => {
        let selections: Record<string, unknown[]> = {};
        const selector = (key: string, value: any) => {
          selections[key] = value;
        };
        flatMap(
          patterns as readonly UnknownValuePattern[],
          getSelectionKeys
        ).forEach((key) => selector(key, undefined));
        const matched = (patterns as readonly UnknownValuePattern[]).some((p) =>
          matchPattern(p, value, selector)
        );
        return { matched, selections };
      },
      getSelectionKeys: () =>
        flatMap(patterns as readonly UnknownValuePattern[], getSelectionKeys),
      matcherType: "or",
    }),
  });
}

/**
 * `P.not(pattern)` returns a pattern which matches if the sub pattern
 * doesn't match.
 *
 * @example
 *  match<{ a: string | number }>(value)
 *   .with({ a: P.not(P.string) }, (x) => 'will match { a: number }'
 *   )
 */

export function not<
  input,
  const pattern extends Pattern<input> | UnknownValuePattern
>(pattern: pattern): Chainable<NotP<input, pattern>> {
  return chainable({
    [matcher]: () => ({
      match: <UnknownInput>(value: UnknownInput | input) => ({
        matched: !matchPattern(pattern, value, () => {}),
      }),
      getSelectionKeys: () => [],
      matcherType: "not",
    }),
  });
}

/**
 * `P.when((value) => boolean)` returns a pattern which matches
 * if the predicate returns true for the current input.
 *
 * @example
 *  match<{ age: number }>(value)
 *   .with({ age: P.when(age => age > 21) }, (x) => 'will match if value.age > 21'
 *   )
 */
export function when<input, predicate extends (value: input) => unknown>(
  predicate: predicate
): GuardP<
  input,
  predicate extends (value: any) => value is infer narrowed ? narrowed : never
>;
export function when<input, narrowed extends input, excluded>(
  predicate: (input: input) => input is narrowed
): GuardExcludeP<input, narrowed, excluded>;
export function when<input, predicate extends (value: input) => unknown>(
  predicate: predicate
): GuardP<
  input,
  predicate extends (value: any) => value is infer narrowed ? narrowed : never
> {
  return {
    [matcher]: () => ({
      match: <UnknownInput>(value: UnknownInput | input) => ({
        matched: Boolean(predicate(value as input)),
      }),
    }),
  };
}

/**
 * `P.select()` is a pattern which will always match,
 * and will inject the selected piece of input in the handler function.
 *
 * @example
 *  match<{ age: number }>(value)
 *   .with({ age: P.select() }, (age) => 'age: number'
 *   )
 */
export function select(): Chainable<AnonymousSelectP, "select" | "or" | "and">;
export function select<
  input,
  const patternOrKey extends
    | string
    | (unknown extends input ? UnknownValuePattern : Pattern<input>)
>(
  patternOrKey: patternOrKey
): patternOrKey extends string
  ? Chainable<SelectP<patternOrKey, "select" | "or" | "and">>
  : Chainable<
      SelectP<symbols.anonymousSelectKey, input, patternOrKey>,
      "select" | "or" | "and"
    >;
export function select<
  input,
  const pattern extends unknown extends input
    ? UnknownValuePattern
    : Pattern<input>,
  const k extends string
>(
  key: k,
  pattern: pattern
): Chainable<SelectP<k, input, pattern>, "select" | "or" | "and">;
export function select(
  ...args: [keyOrPattern?: unknown | string, pattern?: unknown]
): Chainable<SelectP<string>, "select" | "or" | "and"> {
  const key: string | undefined =
    typeof args[0] === "string" ? args[0] : undefined;
  const pattern: unknown =
    args.length === 2
      ? args[1]
      : typeof args[0] === "string"
      ? undefined
      : args[0];
  return chainable({
    [matcher]() {
      return {
        match: (value) => {
          let selections: Record<string, unknown> = {
            [key ?? symbols.anonymousSelectKey]: value,
          };
          const selector = (key: string, value: any) => {
            selections[key] = value;
          };
          return {
            matched:
              pattern === undefined
                ? true
                : matchPattern(pattern, value, selector),
            selections: selections,
          };
        },
        getSelectionKeys: () =>
          [key ?? symbols.anonymousSelectKey].concat(
            pattern === undefined ? [] : getSelectionKeys(pattern)
          ),
      };
    },
  });
}

function isUnknown(x: unknown): x is unknown {
  return true;
}

function isNumber<T>(x: T | number): x is number {
  return typeof x === "number";
}

function isString<T>(x: T | string): x is string {
  return typeof x === "string";
}

function isBoolean<T>(x: T | boolean): x is boolean {
  return typeof x === "boolean";
}

function isBigInt<T>(x: T | bigint): x is bigint {
  return typeof x === "bigint";
}

function isSymbol<T>(x: T | symbol): x is symbol {
  return typeof x === "symbol";
}

function isNullish<T>(x: T | null | undefined): x is null | undefined {
  return x === null || x === undefined;
}

function isNonNullable(x: unknown): x is {} {
  return x !== null && x !== undefined;
}

type AnyConstructor = abstract new (...args: any[]) => any;

function isInstanceOf<T extends AnyConstructor>(classConstructor: T) {
  return (val: unknown): val is InstanceType<T> =>
    val instanceof classConstructor;
}

/**
 * `P.any` is a wildcard pattern, matching **any value**.
 *
 * @example
 *  match(value)
 *   .with(P.any, () => 'will always match')
 */
export const any: UnknownPattern = chainable(when(isUnknown));

/**
 * `P.unknown` is a wildcard pattern, matching **unknown value**.
 *
 * @example
 *  match(value)
 *   .with(P.unknown, () => 'will always match')
 */
export const unknown: UnknownPattern = chainable(when(isUnknown));

/**
 * `P._` is a wildcard pattern, matching **any value**.
 * It's an alias to `P.any`.
 *
 * @example
 *  match(value)
 *   .with(P._, () => 'will always match')
 */
export const _ = any;

/**
 * `P.string.startsWith(start)` is a pattern, matching **strings** starting with `start`.
 *
 * @example
 *  match(value)
 *   .with(P.string.startsWith('A'), () => 'value starts with an A')
 */

const startsWith = <input, const start extends string>(
  start: start
): GuardP<input, `${start}${string}`> =>
  when((value) => isString(value) && value.startsWith(start));

/**
 * `P.string.endsWith(end)` is a pattern, matching **strings** ending with `end`.
 *
 * @example
 *  match(value)
 *   .with(P.string.endsWith('!'), () => 'value ends with an !')
 */
const endsWith = <input, const end extends string>(
  end: end
): GuardP<input, `${string}${end}`> =>
  when((value) => isString(value) && value.endsWith(end));

/**
 * `P.string.minLength(min)` is a pattern, matching **strings** with at least `min` characters.
 *
 * @example
 *  match(value)
 *   .with(P.string.minLength(10), () => 'string with more length >= 10')
 */
const minLength = <const min extends number>(min: min) =>
  when((value) => isString(value) && value.length >= min);

/**
 * `P.string.length(len)` is a pattern, matching **strings** with exactly `len` characters.
 *
 * @example
 *  match(value)
 *   .with(P.string.length(10), () => 'strings with length === 10')
 */
const length = <const len extends number>(len: len) =>
  when((value) => isString(value) && value.length === len);

/**
 * `P.string.maxLength(max)` is a pattern, matching **strings** with at most `max` characters.
 *
 * @example
 *  match(value)
 *   .with(P.string.maxLength(10), () => 'string with more length <= 10')
 */
const maxLength = <const max extends number>(max: max) =>
  when((value) => isString(value) && value.length <= max);

/**
 * `P.string.includes(substr)` is a pattern, matching **strings** containing `substr`.
 *
 * @example
 *  match(value)
 *   .with(P.string.includes('http'), () => 'value contains http')
 */
const includes = <input, const substr extends string>(
  substr: substr
): GuardExcludeP<input, string, never> =>
  when((value) => isString(value) && value.includes(substr));

/**
 * `P.string.regex(expr)` is a pattern, matching **strings** that `expr` regular expression.
 *
 * @example
 *  match(value)
 *   .with(P.string.regex(/^https?:\/\//), () => 'url')
 */
const regex = <input, const expr extends string | RegExp>(
  expr: expr
): GuardExcludeP<input, string, never> =>
  when((value) => isString(value) && Boolean(value.match(expr)));

const stringChainable = <pattern extends Matcher<any, any, any, any, any>>(
  pattern: pattern
): StringChainable<pattern> =>
  Object.assign(chainable(pattern), {
    startsWith: (str: string) =>
      stringChainable(intersection(pattern, startsWith(str))),
    endsWith: (str: string) =>
      stringChainable(intersection(pattern, endsWith(str))),
    minLength: (min: number) =>
      stringChainable(intersection(pattern, minLength(min))),
    length: (len: number) =>
      stringChainable(intersection(pattern, length(len))),
    maxLength: (max: number) =>
      stringChainable(intersection(pattern, maxLength(max))),
    includes: (str: string) =>
      stringChainable(intersection(pattern, includes(str))),
    regex: (str: string) => stringChainable(intersection(pattern, regex(str))),
  }) as any;

/**
 * `P.string` is a wildcard pattern, matching any **string**.
 *
 * @example
 *  match(value)
 *   .with(P.string, () => 'will match on strings')
 */
export const string: StringPattern = stringChainable(when(isString));

/**
 * `P.number.between(min, max)` matches **numbers** between `min` and `max`,
 * equal to min or equal to max.
 *
 * @example
 *  match(value)
 *   .with(P.number.between(0, 10), () => '0 <= numbers <= 10')
 */
const between = <input, const min extends number, const max extends number>(
  min: min,
  max: max
): GuardExcludeP<input, number, never> =>
  when((value) => isNumber(value) && min <= value && max >= value);

/**
 * `P.number.lt(max)` matches **numbers** smaller than `max`.
 *
 * @example
 *  match(value)
 *   .with(P.number.lt(10), () => 'numbers < 10')
 */
const lt = <input, const max extends number>(
  max: max
): GuardExcludeP<input, number, never> =>
  when((value) => isNumber(value) && value < max);

/**
 * `P.number.gt(min)` matches **numbers** greater than `min`.
 *
 * @example
 *  match(value)
 *   .with(P.number.gt(10), () => 'numbers > 10')
 */
const gt = <input, const min extends number>(
  min: min
): GuardExcludeP<input, number, never> =>
  when((value) => isNumber(value) && value > min);

/**
 * `P.number.lte(max)` matches **numbers** smaller than or equal to `max`.
 *
 * @example
 *  match(value)
 *   .with(P.number.lte(10), () => 'numbers <= 10')
 */
const lte = <input, const max extends number>(
  max: max
): GuardExcludeP<input, number, never> =>
  when((value) => isNumber(value) && value <= max);

/**
 * `P.number.gte(min)` matches **numbers** greater than or equal to `min`.
 *
 * @example
 *  match(value)
 *   .with(P.number.gte(10), () => 'numbers >= 10')
 */
const gte = <input, const min extends number>(
  min: min
): GuardExcludeP<input, number, never> =>
  when((value) => isNumber(value) && value >= min);

/**
 * `P.number.int()` matches **integer** numbers.
 *
 * @example
 *  match(value)
 *   .with(P.number.int(), () => 'an integer')
 */
const int = <input>(): GuardExcludeP<input, number, never> =>
  when((value) => isNumber(value) && Number.isInteger(value));

/**
 * `P.number.finite` matches **finite numbers**.
 *
 * @example
 *  match(value)
 *   .with(P.number.finite, () => 'not Infinity')
 */
const finite = <input>(): GuardExcludeP<input, number, never> =>
  when((value) => isNumber(value) && Number.isFinite(value));

/**
 * `P.number.positive()` matches **positive** numbers.
 *
 * @example
 *  match(value)
 *   .with(P.number.positive(), () => 'number > 0')
 */
const positive = <input>(): GuardExcludeP<input, number, never> =>
  when((value) => isNumber(value) && value > 0);

/**
 * `P.number.negative()` matches **negative** numbers.
 *
 * @example
 *  match(value)
 *   .with(P.number.negative(), () => 'number < 0')
 */
const negative = <input>(): GuardExcludeP<input, number, never> =>
  when((value) => isNumber(value) && value < 0);

const numberChainable = <pattern extends Matcher<any, any, any, any, any>>(
  pattern: pattern
): NumberChainable<pattern> =>
  Object.assign(chainable(pattern), {
    between: (min: number, max: number) =>
      numberChainable(intersection(pattern, between(min, max))),
    lt: (max: number) => numberChainable(intersection(pattern, lt(max))),
    gt: (min: number) => numberChainable(intersection(pattern, gt(min))),
    lte: (max: number) => numberChainable(intersection(pattern, lte(max))),
    gte: (min: number) => numberChainable(intersection(pattern, gte(min))),
    int: () => numberChainable(intersection(pattern, int())),
    finite: () => numberChainable(intersection(pattern, finite())),
    positive: () => numberChainable(intersection(pattern, positive())),
    negative: () => numberChainable(intersection(pattern, negative())),
  }) as any;

/**
 * `P.number` is a wildcard pattern, matching any **number**.
 *
 * @example
 *  match(value)
 *   .with(P.number, () => 'will match on numbers')
 */
export const number: NumberPattern = numberChainable(when(isNumber));

/**
 * `P.bigint.between(min, max)` matches **bigint** between `min` and `max`,
 * equal to min or equal to max.
 *
 * @example
 *  match(value)
 *   .with(P.bigint.between(0, 10), () => '0 <= bigints <= 10')
 */
const betweenBigInt = <
  input,
  const min extends bigint,
  const max extends bigint
>(
  min: min,
  max: max
): GuardExcludeP<input, bigint, never> =>
  when((value) => isBigInt(value) && min <= value && max >= value);

/**
 * `P.bigint.lt(max)` matches **bigint** smaller than `max`.
 *
 * @example
 *  match(value)
 *   .with(P.bigint.lt(10), () => 'bigints < 10')
 */
const ltBigInt = <input, const max extends bigint>(
  max: max
): GuardExcludeP<input, bigint, never> =>
  when((value) => isBigInt(value) && value < max);

/**
 * `P.bigint.gt(min)` matches **bigint** greater than `min`.
 *
 * @example
 *  match(value)
 *   .with(P.bigint.gt(10), () => 'bigints > 10')
 */
const gtBigInt = <input, const min extends bigint>(
  min: min
): GuardExcludeP<input, bigint, never> =>
  when((value) => isBigInt(value) && value > min);

/**
 * `P.bigint.lte(max)` matches **bigint** smaller than or equal to `max`.
 *
 * @example
 *  match(value)
 *   .with(P.bigint.lte(10), () => 'bigints <= 10')
 */
const lteBigInt = <input, const max extends bigint>(
  max: max
): GuardExcludeP<input, bigint, never> =>
  when((value) => isBigInt(value) && value <= max);

/**
 * `P.bigint.gte(min)` matches **bigint** greater than or equal to `min`.
 *
 * @example
 *  match(value)
 *   .with(P.bigint.gte(10), () => 'bigints >= 10')
 */
const gteBigInt = <input, const min extends bigint>(
  min: min
): GuardExcludeP<input, bigint, never> =>
  when((value) => isBigInt(value) && value >= min);

/**
 * `P.bigint.positive()` matches **positive** bigints.
 *
 * @example
 *  match(value)
 *   .with(P.bigint.positive(), () => 'bigint > 0')
 */
const positiveBigInt = <input>(): GuardExcludeP<input, bigint, never> =>
  when((value) => isBigInt(value) && value > 0);

/**
 * `P.bigint.negative()` matches **negative** bigints.
 *
 * @example
 *  match(value)
 *   .with(P.bigint.negative(), () => 'bigint < 0')
 */
const negativeBigInt = <input>(): GuardExcludeP<input, bigint, never> =>
  when((value) => isBigInt(value) && value < 0);

const bigintChainable = <pattern extends Matcher<any, any, any, any, any>>(
  pattern: pattern
): BigIntChainable<pattern> =>
  Object.assign(chainable(pattern), {
    between: (min: bigint, max: bigint) =>
      bigintChainable(intersection(pattern, betweenBigInt(min, max))),
    lt: (max: bigint) => bigintChainable(intersection(pattern, ltBigInt(max))),
    gt: (min: bigint) => bigintChainable(intersection(pattern, gtBigInt(min))),
    lte: (max: bigint) =>
      bigintChainable(intersection(pattern, lteBigInt(max))),
    gte: (min: bigint) =>
      bigintChainable(intersection(pattern, gteBigInt(min))),
    positive: () => bigintChainable(intersection(pattern, positiveBigInt())),
    negative: () => bigintChainable(intersection(pattern, negativeBigInt())),
  }) as any;

/**
 * `P.bigint` is a wildcard pattern, matching any **bigint**.
 *
 * @example
 *   .with(P.bigint, () => 'will match on bigints')
 */
export const bigint: BigIntPattern = bigintChainable(when(isBigInt));

/**
 * `P.boolean` is a wildcard pattern, matching any **boolean**.
 *
 * @example
 *   .with(P.boolean, () => 'will match on booleans')
 */
export const boolean: BooleanPattern = chainable(when(isBoolean));

/**
 * `P.symbol` is a wildcard pattern, matching any **symbol**.
 *
 * @example
 *   .with(P.symbol, () => 'will match on symbols')
 */
export const symbol: SymbolPattern = chainable(when(isSymbol));

/**
 * `P.nullish` is a wildcard pattern, matching **null** or **undefined**.
 *
 * @example
 *   .with(P.nullish, (x) => `${x} is null or undefined`)
 */
export const nullish: NullishPattern = chainable(when(isNullish));

/**
 * `P.nonNullable` is a wildcard pattern, matching everything except **null** or **undefined**.
 *
 * @example
 *   .with(P.nonNullable, (x) => `${x} isn't null nor undefined`)
 */
export const nonNullable: NonNullablePattern = chainable(when(isNonNullable));

/**
 * `P.instanceOf(SomeClass)` is a pattern matching instances of a given class.
 *
 *  @example
 *   .with(P.instanceOf(SomeClass), () => 'will match on SomeClass instances')
 */
export function instanceOf<T extends AnyConstructor>(
  classConstructor: T
): Chainable<GuardP<unknown, InstanceType<T>>> {
  return chainable(when(isInstanceOf(classConstructor)));
}

/**
 * `P.shape(somePattern)` lets you call methods like `.optional()`, `.and`, `.or` and `.select()`
 * On structural patterns, like objects and arrays.
 *
 *  @example
 *   .with(
 *     {
 *       state: P.shape({ status: "success" }).optional().select()
 *     },
 *     (state) => 'match the success state, or undefined.'
 *   )
 */
export function shape<input, const pattern extends Pattern<input>>(
  pattern: pattern
): Chainable<GuardP<input, InvertPattern<pattern, input>>>;
export function shape(pattern: UnknownValuePattern) {
  return chainable(when(isMatching(pattern)));
}

/**
 * `P.lazy(() => pattern)` allows defining self-referential patterns without
 * eagerly evaluating the inner pattern.
 *
 * @example
 *  const tree = P.lazy(() => ({
 *    value: P.number,
 *    children: P.array(tree).optional()
 *  }));
 */
export function lazy<
  input = unknown,
  const pattern extends Pattern<input> = Pattern<input>
>(factory: () => pattern): Chainable<LazyP<input, pattern>> {
  let resolved: pattern | undefined;
  let cachedSelectionKeys: string[] | undefined;
  let collectingSelectionKeys = false;


  const getResolved = (): pattern => {
    if (!resolved) {
      resolved = factory();
    }
    return resolved;
  };

  const ensureSelectionKeys = (): string[] => {
    if (cachedSelectionKeys) return cachedSelectionKeys;
    if (collectingSelectionKeys) return [];
    collectingSelectionKeys = true;
    const keys = getSelectionKeys(getResolved());
    cachedSelectionKeys = keys;
    collectingSelectionKeys = false;
    return keys;
  };

  return chainable({
    [matcher]() {
      return {
        match: (value: unknown) => {
          let selections: Record<string, unknown> = {};
          const selector = (key: string, selection: unknown) => {
            selections[key] = selection;
          };
          const matched = matchPattern(getResolved(), value, selector);
          return { matched, selections };
        },
        getSelectionKeys: () => ensureSelectionKeys(),
        matcherType: "lazy",
      };
    },
  }) as Chainable<LazyP<input, pattern>>;
}
