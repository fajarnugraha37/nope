import type { Err, Result } from "./wrappers.js";

/** collect all Ok → Ok<T[]>; stop on first Err */
export function collectAll<T, E = unknown>(xs: Result<T, E>[]): Result<T[], E> {
  const out: T[] = [];
  for (const r of xs) {
    if (!r.ok) return r;
    out.push(r.value);
  }
  return { ok: true, value: out };
}

/** split results */
export function partitionOkErr<T, E = unknown>(xs: Result<T, E>[]) {
  const oks: T[] = [];
  const errs: E[] = [];
  for (const r of xs) r.ok ? oks.push(r.value) : errs.push(r.error);
  return { oks, errs };
}

/** first Err if any */
export function firstErr<T, E = unknown>(
  xs: Result<T, E>[]
): Err<E> | undefined {
  for (const r of xs) if (!r.ok) return r as Err<E>;
  return undefined;
}

/** any Ok present? */
export function anyOk<T, E = unknown>(xs: Result<T, E>[]): boolean {
  return xs.some((r) => r.ok);
}

/** collect object of Results → Result<object of unwrapped> */
export function collectAllObj<
  O extends Record<string, Result<any, E>>,
  E = unknown
>(
  obj: O
): Result<
  { [K in keyof O]: O[K] extends Result<infer T, any> ? T : never },
  E
> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj)) {
    const r = obj[k]!;
    if (!r.ok) return r;
    out[k] = r.value;
  }
  return { ok: true, value: out as any };
}