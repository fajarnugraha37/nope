    import type { Result } from "./wrappers.js";

    /** log error but don’t throw */
    export function logErr<E>(r: Result<any, E>, label = "tryCatch"): void {
    if (!r.ok) console.error(`[${label}]`, r.error);
    }

    /** ensure result, throw with optional context */
    export function ensureOk<T, E>(r: Result<T, E>, ctx?: string): T {
    if (r.ok) return r.value;
    const msg = ctx ? `${ctx}: ${String(r.error)}` : String(r.error);
    throw new Error(msg);
    }

    /** run side-effect on Ok; return original result */
    export function tapOk<T, E = unknown>(
    r: Result<T, E>,
    f: (v: T) => void
    ): Result<T, E> {
    if (r.ok) {
        try {
        f(r.value);
        } catch {
        /* ignore tap errors */
        }
    }
    return r;
    }

    /** run side-effect on Err; return original result */
    export function tapErr<T, E = unknown>(
    r: Result<T, E>,
    f: (e: E) => void
    ): Result<T, E> {
    if (!r.ok) {
        try {
        f(r.error);
        } catch {
        /* ignore tap errors */
        }
    }
    return r;
    }

    /** sugar: console taps */
    export const tapLogOk =
    <T, E = unknown>(label = "ok") =>
    (r: Result<T, E>) =>
        tapOk(r, (v) => console.log(`[${label}]`, v));

    export const tapLogErr =
    <T, E = unknown>(label = "err") =>
    (r: Result<T, E>) =>
        tapErr(r, (e) => console.error(`[${label}]`, e));
