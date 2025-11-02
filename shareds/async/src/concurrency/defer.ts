export type Finalizer = () => void | Promise<void>;

class Defer {
  private stack: Finalizer[] = [];
  private onOk: Finalizer[] = [];
  private onErr: Finalizer[] = [];

  /** run at scope exit (LIFO) */
  defer(fn: Finalizer) { this.stack.push(fn); }

  /** run only if scope succeeds (no throw/ rejection) */
  onSuccess(fn: Finalizer) { this.onOk.push(fn); }

  /** run only if scope fails (throws/rejects) */
  onError(fn: Finalizer) { this.onErr.push(fn); }

  /** internal */
  async _run(ok: boolean) {
    const errs: unknown[] = [];
    const run = async (fns: Finalizer[]) => {
      for (let i = fns.length - 1; i >= 0; i--) {
        try { await fns[i]!(); } catch (e) { errs.push(e); }
      }
    };
    await run(this.stack);
    await run(ok ? this.onOk : this.onErr);
    if (errs.length) throw new AggregateError(errs, "one or more finalizers failed");
  }
}

/**
 * withDefer: wraps a block with go-like defer.
 * use `d.defer(() => cleanup())`, plus optional `onSuccess/onError`.
 */
export async function withDefer<T>(fn: (d: Defer) => Promise<T> | T): Promise<T> {
  const d = new Defer();
  try {
    const val = await fn(d);
    await d._run(true);
    return val;
  } catch (e) {
    try { await d._run(false); } catch (e2) { /* preserve original? chain later */ }
    throw e;
  }
}

/** sync variant (finalizers may still be async; they’ll be awaited) */
export function withDeferSync<T>(fn: (d: Defer) => T): T {
  // note: if any finalizer returns a promise, it won’t be awaited here.
  // prefer withDefer() for mixed async finalizers.
  const d = new Defer();
  try {
    const val = fn(d);
    // best-effort flush (non-await)
    // @ts-ignore
    void d._run(true);
    return val;
  } catch (e) {
    // @ts-ignore
    void d._run(false);
    throw e;
  }
}

/* -----------------------------
   helpers you’ll actually use
   ----------------------------- */

/** run all finalizers now (LIFO), catching errors → Result-style boolean */
export async function flush(...fns: Finalizer[]): Promise<{ ok: boolean; errors?: unknown[] }> {
  const d = new Defer();
  fns.forEach(fn => d.defer(fn));
  try { await d._run(true); return { ok: true }; }
  catch (e) { return { ok: false, errors: (e as AggregateError).errors ?? [e] }; }
}

/** make a simple disposable wrapper (works well with defer) */
export function using<T>(value: T, dispose: (v: T) => void | Promise<void>) {
  return { value, [Symbol.for("dispose")]: () => dispose(value) };
}

/** register AbortController auto-abort at scope exit */
export function withAbort(d: Defer): AbortController {
  const ac = new AbortController();
  d.defer(() => { try { ac.abort(); } catch {} });
  return ac;
}

/** time limiter that cancels via AbortController on exit or timeout */
export function timedAbort(d: Defer, ms: number): AbortController {
  const ac = withAbort(d);
  const t = setTimeout(() => ac.abort(new DOMException("timeout", "TimeoutError")), ms);
  d.defer(() => clearTimeout(t));
  return ac;
}

/** unwrap node streams/files neatly */
export function useFsHandle<T extends { close(): any }>(d: Defer, h: T): T {
  d.defer(() => (h as any).close?.());
  return h;
}

/* -----------------------------
   deferred promise (different “defer”)
   ----------------------------- */

export type Deferred<T> = {
  promise: Promise<T>;
  resolve: (v: T | PromiseLike<T>) => void;
  reject: (e?: unknown) => void;
};
export function deferred<T = void>(): Deferred<T> {
  let resolve!: Deferred<T>["resolve"];
  let reject!: Deferred<T>["reject"];
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
