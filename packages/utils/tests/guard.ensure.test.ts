import { describe, expect, test } from "bun:test";

import {
  ensure,
  ensureNotNil,
  ensureNonEmptyString,
  ensureArray,
  ensureArrayNonEmpty,
  ensureObject,
  ensureShape,
  unwrap,
  unwrapOr,
  unwrapOrElse,
  coalesce,
  coalesceTo,
  coalesceLazy,
  coalesceEmpty,
  coalesceProps,
  assignIfDef,
} from "../src/guard/ensure";

const isString = (x: unknown): x is string => typeof x === "string";

describe("guard ensure helpers", () => {
  test("ensure variants validate input and surface custom errors", () => {
    expect(ensure("ok", isString)).toBe("ok");
    expect(() => ensure(123, isString, "bad value")).toThrow("bad value");

    expect(ensureNotNil(1)).toBe(1);
    expect(() => ensureNotNil(null, () => new Error("nil"))).toThrow("nil");

    expect(ensureNonEmptyString("hi")).toBe("hi");
    expect(() => ensureNonEmptyString("")).toThrow("invariant failed");

    expect(ensureArray<number>([1, 2])).toEqual([1, 2]);
    expect(() => ensureArray(null)).toThrow();

    expect(ensureArrayNonEmpty([1])).toEqual([1]);
    expect(() => ensureArrayNonEmpty([])).toThrow();

    const obj = { a: 1 };
    expect(ensureObject(obj)).toBe(obj);
    expect(() => ensureObject(null)).toThrow();

    const shaped = ensureShape({ name: "A" }, { name: isString });
    expect(shaped.name).toBe("A");
    expect(() => ensureShape({ name: 1 } as any, { name: isString })).toThrow();
  });

  test("unwrap helpers coalesce values", () => {
    expect(unwrap("x")).toBe("x");
    expect(() => unwrap(undefined)).toThrow();
    expect(unwrapOr(null, "fallback")).toBe("fallback");
    expect(unwrapOrElse(undefined, () => "lazy")).toBe("lazy");
  });

  test("coalesce utilities merge or throw appropriately", () => {
    expect(coalesce(null, undefined, "value")).toBe("value");
    expect(() => coalesce(null, undefined)).toThrow("coalesce: all values are nullish");

    expect(coalesceTo(null, "alt")).toBe("alt");

    const lazy = coalesceLazy(
      () => null,
      () => 0,
      () => 5
    );
    expect(lazy).toBe(0);
    expect(() =>
      coalesceLazy(
        () => null,
        () => undefined
      )
    ).toThrow("coalesceLazy: all suppliers returned nullish");

    expect(coalesceEmpty([], [1])).toEqual([1]);
    expect(coalesceEmpty([2], [1])).toEqual([2]);
  });

  test("coalesceProps and assignIfDef merge values respecting nullish input", () => {
    const defaults = { a: 1, b: 2, c: 3 };
    const merged = coalesceProps({ a: 10, b: undefined }, defaults);
    expect(merged).toEqual({ a: 10, b: 2, c: 3 });

    const target = { a: 1, b: 2 } as Record<string, number | undefined>;
    assignIfDef(target, { a: 5, b: undefined, c: 7 });
    expect(target).toEqual({ a: 5, b: 2, c: 7 });
  });
});
