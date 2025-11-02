import {
  isNil,
  isStr,
  isArr,
  isObj,
  isDef,
  isEmpty,
  isShape as _isShape,
} from "../is/index.js";
import type { Guard, ErrLike, ErrFn } from "./guard.js";
import { toErr } from "./guard.js";

export function ensure<T>(
  x: unknown,
  guard: Guard<T>,
  err?: ErrLike | ErrFn
): T {
  if (guard(x)) return x;
  throw toErr(err) instanceof Error
    ? toErr(err)
    : new Error(String(toErr(err)));
}

export function ensureNotNil<T>(x: T, err?: ErrLike | ErrFn): NonNullable<T> {
  if (!isNil(x)) return x as NonNullable<T>;
  throw toErr(err) instanceof Error
    ? toErr(err)
    : new Error(String(toErr(err)));
}

export function ensureNonEmptyString(
  x: unknown,
  err?: ErrLike | ErrFn
): string {
  if (isStr(x) && x.length > 0) return x;
  throw toErr(err) instanceof Error
    ? toErr(err)
    : new Error(String(toErr(err)));
}

export function ensureArray<T = unknown>(
  x: unknown,
  err?: ErrLike | ErrFn
): T[] {
  if (isArr<T>(x)) return x;
  throw toErr(err) instanceof Error
    ? toErr(err)
    : new Error(String(toErr(err)));
}

export function ensureArrayNonEmpty<T = unknown>(
  x: unknown,
  err?: ErrLike | ErrFn
): [T, ...T[]] {
  if (isArr<T>(x) && x.length > 0) return x as [T, ...T[]];
  throw toErr(err) instanceof Error
    ? toErr(err)
    : new Error(String(toErr(err)));
}

export function ensureObject<T extends object = Record<string, unknown>>(
  x: unknown,
  err?: ErrLike | ErrFn
): T {
  if (isObj(x)) return x as T;
  throw toErr(err) instanceof Error
    ? toErr(err)
    : new Error(String(toErr(err)));
}

/** ensure a structural shape (uses your is-utils.isShape) */
export function ensureShape<T extends Record<string, (x: any) => boolean>>(
  x: unknown,
  shape: T,
  err?: ErrLike | ErrFn
): { [K in keyof T]: T[K] extends (x: any) => x is infer U ? U : unknown } {
  if (_isShape(x, shape)) return x;
  throw toErr(err) instanceof Error
    ? toErr(err)
    : new Error(String(toErr(err)));
}

/* optional: unwrap (for results/options) */
export function unwrap<T>(x: T | null | undefined, err?: ErrLike | ErrFn): T {
  if (isDef(x)) return x;
  throw toErr(err) instanceof Error
    ? toErr(err)
    : new Error(String(toErr(err)));
}
export const unwrapOr = <T>(x: T | null | undefined, fallback: T): T =>
  isDef(x) ? x : fallback;
export const unwrapOrElse = <T>(x: T | null | undefined, f: () => T): T =>
  isDef(x) ? x : f();

/* ----------------- coalesce ----------------- */

/** first non-null/undefined value (like ?? chain across many) */
export function coalesce<T>(...xs: Array<T | null | undefined>): T {
  for (const x of xs) if (x !== null && x !== undefined) return x as T;
  throw new Error("coalesce: all values are nullish");
}

/** coalesce with default */
export function coalesceTo<T>(x: T | null | undefined, fallback: T): T {
  return isDef(x) ? x : fallback;
}

/** lazy coalesce: evaluate suppliers in order until one yields a non-nullish */
export function coalesceLazy<T>(
  ...suppliers: Array<() => T | null | undefined>
): T {
  for (const s of suppliers) {
    const v = s();
    if (!isNil(v)) return v;
  }
  throw new Error("coalesceLazy: all suppliers returned nullish");
}

/** empty-aware coalesce: treats '', [], {}, Map(0), Set(0) as empty */
export function coalesceEmpty<T>(x: T, fallback: T): T {
  return isEmpty(x as unknown) ? fallback : x;
}

/** per-prop coalesce from defaults (nullish-aware) */
export function coalesceProps<T extends Record<string, any>>(
  partial: Partial<T>,
  defaults: T
): T {
  const out = { ...defaults } as T;
  for (const k in defaults) {
    out[k] = isNil(partial[k])
      ? defaults[k]
      : (partial[k] as T[Extract<keyof T, string>]);
  }
  return out;
}

/** map-merge but skip nullish on source; keep target if source is null/undefined */
export function assignIfDef<T extends Record<string, any>>(
  target: T,
  src: Partial<T>
): T {
  for (const k in src) if (!isNil(src[k])) (target as any)[k] = src[k];
  return target;
}
