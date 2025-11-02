/** Result type (Ok | Err) — works for both sync and async flows */
export type Ok<T> = { ok: true; value: T };
export type Err<E = unknown> = { ok: false; error: E };
export type Result<T, E = unknown> = Ok<T> | Err<E>;

/* ---------- core wrappers ---------- */

/** wrap sync fn with try/catch → Result */
export function tryCatch<T>(fn: () => T): Result<T> {
  try {
    return { ok: true, value: fn() };
  } catch (error) {
    return { ok: false, error };
  }
}

/** wrap async fn → Promise<Result> */
export async function tryCatchAsync<T, E = unknown>(
  fn: () => Promise<T>
): Promise<Result<T, E>> {
  try {
    const value = await fn();
    return { ok: true, value };
  } catch (error) {
    return { ok: false, error: error as E };
  }
}

/** unwrap result or throw */
export function unwrap<T, E = unknown>(r: Result<T, E>): T {
  if (r.ok) return r.value;
  throw r.error;
}

/** unwrap with fallback */
export function unwrapOr<T, E = unknown>(r: Result<T, E>, fallback: T): T {
  return r.ok ? r.value : fallback;
}

/** unwrap or run lazy fallback */
export function unwrapOrElse<T, E = unknown>(
  r: Result<T, E>,
  f: (err: E) => T
): T {
  return r.ok ? r.value : f(r.error);
}

/* ---------- helpers ---------- */

/** map over Ok */
export function map<T, U, E = unknown>(
  r: Result<T, E>,
  f: (x: T) => U
): Result<U, E> {
  return r.ok ? { ok: true, value: f(r.value) } : r;
}

/** mapErr over Err */
export function mapErr<T, E, F>(r: Result<T, E>, f: (e: E) => F): Result<T, F> {
  return r.ok ? r : { ok: false, error: f(r.error) };
}

/** chain flatMap */
export function andThen<T, U, E>(
  r: Result<T, E>,
  f: (x: T) => Result<U, E>
): Result<U, E> {
  return r.ok ? f(r.value) : r;
}
