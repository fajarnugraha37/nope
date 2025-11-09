/** Result type (Ok | Err) — works for both sync and async flows */
export type Ok<T> = { ok: true; value: T };
export type Err<E = unknown> = { ok: false; error: E };
export type Result<T, E = unknown> = Ok<T> | Err<E>;

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

export async function mapAsync<T, U, E>(
  p: Promise<Result<T, E>>,
  f: (x: T) => Promise<U>
): Promise<Result<U, E>> {
  const r = await p;
  return r.ok ? tryCatchAsync<U, E>(() => f(r.value)) : r;
}
