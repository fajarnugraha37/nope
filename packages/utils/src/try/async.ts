import { collectAll } from "./collections.js";
import type { Result } from "./wrappers.js";
import { tryCatchAsync } from "./wrappers.js";

export async function mapAsync<T, U, E>(
  p: Promise<Result<T, E>>,
  f: (x: T) => Promise<U>
): Promise<Result<U, E>> {
  const r = await p;
  return r.ok ? tryCatchAsync<U, E>(() => f(r.value)) : r;
}

/* ---------- retry logic ---------- */

/** retry async fn up to n times (exponential backoff optional) */
export async function retry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; delayMs?: number; backoff?: number } = {}
): Promise<Result<T>> {
  const { retries = 3, delayMs = 200, backoff = 2 } = opts;
  let lastErr: any;
  let delay = delayMs;
  for (let i = 0; i < retries; i++) {
    const res = await tryCatchAsync(fn);
    if (res.ok) return res;
    lastErr = res.error;
    if (i < retries - 1) await new Promise((r) => setTimeout(r, delay));
    delay *= backoff;
  }
  return { ok: false, error: lastErr };
}

/** abortable timeout wrapper around any promise-returning fn */
export function withTimeout<T>(
  fn: (signal?: AbortSignal) => Promise<T>,
  ms: number,
  opts: { signal?: AbortSignal; onTimeout?: () => void } = {}
): Promise<T> {
  const { signal: outer, onTimeout } = opts;

  return new Promise<T>((resolve, reject) => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let outerHandler: (() => void) | undefined;
    let settled = false;

    const cleanup = () => {
      if (timer !== undefined) clearTimeout(timer);
      if (outer && outerHandler) outer.removeEventListener("abort", outerHandler);
    };

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      try {
        fn();
      } finally {
        cleanup();
      }
    };

    controller.signal.addEventListener(
      "abort",
      () => {
        finish(() => {
          const reason = controller.signal.reason;
          if (reason instanceof Error) {
            reject(reason);
          } else if (reason !== undefined) {
            reject(reason as unknown);
          } else {
            const err = new Error("AbortError");
            err.name = "AbortError";
            reject(err);
          }
        });
      },
      { once: true }
    );

    timer = setTimeout(() => {
      onTimeout?.();
      const err = new Error("TimeoutError");
      err.name = "TimeoutError";
      controller.abort(err);
    }, ms);

    if (outer) {
      outerHandler = () => {
        if (controller.signal.aborted) return;
        const reason =
          outer.reason instanceof Error
            ? outer.reason
            : outer.reason ?? (() => {
                const err = new Error("AbortError");
                err.name = "AbortError";
                return err;
              })();
        controller.abort(reason);
      };
      if (outer.aborted) outerHandler();
      else outer.addEventListener("abort", outerHandler, { once: true });
    }

    let runner: Promise<T>;
    try {
      runner = Promise.resolve(fn(controller.signal));
    } catch (err) {
      runner = Promise.reject(err);
    }

    runner.then(
      (value) => finish(() => resolve(value)),
      (err) => finish(() => reject(err))
    );
  });
}

/** simple promise timeout for an existing promise (no abort), rejects on timeout */
export function timeoutPromise<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

type RetryOpts = {
  retries?: number; // total attempts (default 3)
  delayMs?: number; // initial delay between attempts (default 200)
  backoff?: number; // multiplier (default 2)
  jitter?: number; // 0..1; randomize delay by ±jitter*delay (default 0)
  timeoutMs?: number; // per-attempt timeout (optional)
  signal?: AbortSignal; // cancel whole retry loop
};

/** single-task retry (kept here for reuse by retryAll) */
export async function retryWith<T>(
  fn: (signal?: AbortSignal) => Promise<T>,
  {
    retries = 3,
    delayMs = 200,
    backoff = 2,
    jitter = 0,
    timeoutMs,
    signal,
  }: RetryOpts = {}
): Promise<Result<T>> {
  let delay = delayMs;
  let lastErr: unknown;

  const sleep = (ms: number) =>
    new Promise<void>((res, rej) => {
      if (signal?.aborted) return rej(signal.reason);
      const t = setTimeout(res, ms);
      signal?.addEventListener(
        "abort",
        () => {
          clearTimeout(t);
          rej(signal.reason);
        },
        { once: true }
      );
    });

  for (let attempt = 1; attempt <= retries; attempt++) {
    if (signal?.aborted) return { ok: false, error: signal.reason };

    const run = () =>
      timeoutMs != null ? withTimeout(fn, timeoutMs, { signal }) : fn(signal);

    const r = await tryCatchAsync(run);
    if (r.ok) return r;

    lastErr = r.error;

    if (attempt < retries) {
      const jittered = jitter
        ? Math.max(0, delay + (Math.random() * 2 - 1) * jitter * delay)
        : delay;
      try {
        await sleep(jittered);
      } catch (e) {
        return { ok: false, error: e };
      }
      delay *= backoff;
    }
  }
  return { ok: false, error: lastErr };
}

type BulkItem<T> = () => Promise<T>;
type BulkRetryOpts = RetryOpts & { concurrency?: number };

/**
 * retryAll: run N tasks with per-task retry/backoff/timeout + global concurrency.
 * returns array of Result<T> in the same order as input.
 */
export async function retryAll<T>(
  tasks: BulkItem<T>[],
  {
    concurrency = 5,
    retries = 3,
    delayMs = 200,
    backoff = 2,
    jitter = 0,
    timeoutMs,
    signal,
  }: BulkRetryOpts = {}
): Promise<Result<T>[]> {
  const out: Result<T>[] = Array(tasks.length);
  let i = 0;

  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= tasks.length) break;
      const task = tasks[idx]!;

      const res = await retryWith(task, {
        retries,
        delayMs,
        backoff,
        jitter,
        timeoutMs,
        signal,
      });

      out[idx] = res;
      if (signal?.aborted) break;
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    () => worker()
  );

  await Promise.all(workers);
  return out;
}

/** sugar: collect Ok results only, drop Errs */
export function oksOnly<T, E = unknown>(xs: Result<T, E>[]): T[] {
  const out: T[] = [];
  for (const r of xs) if (r.ok) out.push(r.value);
  return out;
}

/** sugar: stops on first Err across results (short-circuit check) */
export function allOk<T, E = unknown>(xs: Result<T, E>[]): Result<T[], E> {
  return collectAll(xs);
}
