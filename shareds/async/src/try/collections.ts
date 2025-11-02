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
  for (const r of xs) (r.ok ? oks.push(r.value) : errs.push(r.error));
  return { oks, errs };
}

/** first Err if any */
export function firstErr<T, E = unknown>(xs: Result<T, E>[]): Err<E> | undefined {
  for (const r of xs) if (!r.ok) return r as Err<E>;
  return undefined;
}

/** any Ok present? */
export function anyOk<T, E = unknown>(xs: Result<T, E>[]): boolean {
  return xs.some(r => r.ok);
}

/** collect object of Results → Result<object of unwrapped> */
export function collectAllObj<
  O extends Record<string, Result<any, E>>,
  E = unknown
>(obj: O): Result<{ [K in keyof O]: O[K] extends Result<infer T, any> ? T : never }, E> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj)) {
    const r = obj[k]!;
    if (!r.ok) return r;
    out[k] = r.value;
  }
  return { ok: true, value: out as any };
}

/* ---- parallel async combinators ---- */

/** run funcs in parallel, wrap as Result<T[]>; stops on first failure (short-circuit) */
export async function allAsync<T>(
  fns: Array<() => Promise<T>>
): Promise<Result<T[]>> {
  try {
    const p = fns.map(fn => fn());
    const vals = await Promise.all(p);
    return { ok: true, value: vals };
  } catch (error) {
    return { ok: false, error };
  }
}

/** like Promise.allSettled but returned as Result[] */
export async function allSettledAsResults<T>(
  promises: Array<Promise<T>>
): Promise<Array<Result<T>>> {
  const settled = await Promise.allSettled(promises);
  return settled.map(s =>
    s.status === "fulfilled" ? { ok: true, value: s.value } : { ok: false, error: s.reason }
  );
}

/** parallel funcs returning Result; short-circuit on first Err */
export async function allResultsAsync<T, E = unknown>(
  fns: Array<() => Promise<Result<T, E>>>
): Promise<Result<T[], E>> {
  const running = fns.map(fn => fn());
  const vals: T[] = [];
  for (const p of running) {
    const r = await p;
    if (!r.ok) return r;
    vals.push(r.value);
  }
  return { ok: true, value: vals };
}

/** race funcs → first fulfilled or rejected wrapped as Result */
export async function raceAsync<T>(
  fns: Array<() => Promise<T>>
): Promise<Result<T>> {
  try {
    const winner = await Promise.race(fns.map(fn => fn()));
    return { ok: true, value: winner };
  } catch (error) {
    return { ok: false, error };
  }
}

/** race Result-producing funcs; preserves Err if the first settled is Err */
export async function raceResultsAsync<T, E = unknown>(
  fns: Array<() => Promise<Result<T, E>>>
): Promise<Result<T, E>> {
  return new Promise(resolve => {
    for (const fn of fns) {
      fn().then(resolve).catch(e => resolve({ ok: false, error: e }));
    }
  });
}

/** parallel with concurrency limit (plain promises) */
export async function allAsyncLimited<T>(
  fns: Array<() => Promise<T>>,
  limit = 5
): Promise<Result<T[]>> {
  const out: T[] = [];
  let i = 0;
  let err: unknown;

  async function worker() {
    while (i < fns.length && err === undefined) {
      const idx = i++;
      try {
        out[idx] = await fns[idx]!();
      } catch (e) {
        err = e;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, fns.length) }, worker));
  return err === undefined ? { ok: true, value: out } : { ok: false, error: err };
}