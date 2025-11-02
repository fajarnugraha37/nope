/* =======================================
   circuit breaker + rate limit + policies
   ======================================= */

import { tryCatchAsync, type Result } from "./wrappers.js";

export type Clock = () => number; // ms
const now: Clock = () => Date.now();

/* -------------------------
   1) Circuit Breaker (CB)
   ------------------------- */

type CBState = "closed" | "open" | "half-open";

export interface CircuitBreakerOpts {
  failureThreshold?: number; // consecutive failures to open
  successThreshold?: number; // successes in half-open to close
  cooldownMs?: number; // time to stay open before half-open
  onStateChange?: (from: CBState, to: CBState) => void;
  clock?: Clock;
}

export class CircuitBreaker {
  private state: CBState = "closed";
  private consecutiveFail = 0;
  private halfOpenSuccess = 0;
  private nextAttemptAt = 0;
  private readonly cfg: Required<CircuitBreakerOpts>;

  constructor(opts: CircuitBreakerOpts = {}) {
    this.cfg = {
      failureThreshold: opts.failureThreshold ?? 5,
      successThreshold: opts.successThreshold ?? 2,
      cooldownMs: opts.cooldownMs ?? 10_000,
      onStateChange: opts.onStateChange ?? (() => {}),
      clock: opts.clock ?? now,
    };
  }

  getState() {
    return this.state;
  }

  private setState(s: CBState) {
    if (s === this.state) return;
    const prev = this.state;
    this.state = s;
    this.cfg.onStateChange(prev, s);
  }

  /** whether calls are allowed at this moment */
  allow(): boolean {
    const t = this.cfg.clock();
    if (this.state === "open") {
      if (t >= this.nextAttemptAt) {
        this.setState("half-open");
        this.halfOpenSuccess = 0;
        return true;
      }
      return false;
    }
    return true;
  }

  /** record a success */
  success() {
    this.consecutiveFail = 0;
    if (this.state === "half-open") {
      this.halfOpenSuccess++;
      if (this.halfOpenSuccess >= this.cfg.successThreshold) {
        this.setState("closed");
      }
    }
  }

  /** record a failure */
  fail() {
    this.consecutiveFail++;
    if (this.state === "half-open") {
      // any failure in half-open -> open again
      this.tripOpen();
      return;
    }
    if (this.consecutiveFail >= this.cfg.failureThreshold) {
      this.tripOpen();
    }
  }

  private tripOpen() {
    this.setState("open");
    this.nextAttemptAt = this.cfg.clock() + this.cfg.cooldownMs;
    this.halfOpenSuccess = 0;
  }

  forceOpen(ms?: number) {
    this.setState("open");
    this.nextAttemptAt = this.cfg.clock() + (ms ?? this.cfg.cooldownMs);
  }

  forceClose() {
    this.setState("closed");
    this.consecutiveFail = 0;
    this.halfOpenSuccess = 0;
  }
}

/** wrap an async fn with a circuit breaker */
export function withCircuitBreaker<T>(
  cb: CircuitBreaker,
  fn: (signal?: AbortSignal) => Promise<T>
): (signal?: AbortSignal) => Promise<Result<T>> {
  return async (signal?: AbortSignal) => {
    if (!cb.allow()) return { ok: false, error: new Error("circuit open") };
    const r = await tryCatchAsync(() => fn(signal));
    r.ok ? cb.success() : cb.fail();
    return r;
  };
}

/* -------------------------
   2) Rate Limiting + Queue
   ------------------------- */

/** token bucket limiter: capacity (burst) + refillRate (tokens/sec) */
export class TokenBucket {
  private tokens: number;
  private last: number;
  constructor(
    readonly capacity: number,
    readonly refillPerSec: number,
    private readonly clock: Clock = now
  ) {
    this.tokens = capacity;
    this.last = this.clock();
  }

  /** try consume n immediately */
  tryTake(n = 1): boolean {
    this.refill();
    if (this.tokens >= n) {
      this.tokens -= n;
      return true;
    }
    return false;
  }

  /** wait until n tokens available (optional timeout) */
  async take(n = 1, timeoutMs?: number): Promise<boolean> {
    const start = this.clock();
    while (true) {
      if (this.tryTake(n)) return true;
      if (timeoutMs != null && this.clock() - start >= timeoutMs) return false;
      const ms = this.msUntil(n);
      await new Promise((r) => setTimeout(r, Math.max(1, ms)));
    }
  }

  /** estimate ms until n tokens available */
  msUntil(n = 1): number {
    this.refill();
    if (this.tokens >= n) return 0;
    const need = n - this.tokens;
    const perMs = this.refillPerSec / 1000;
    return Math.ceil(need / perMs);
  }

  private refill() {
    const t = this.clock();
    const deltaMs = Math.max(0, t - this.last);
    if (deltaMs > 0) {
      this.tokens = Math.min(
        this.capacity,
        this.tokens + (deltaMs / 1000) * this.refillPerSec
      );
      this.last = t;
    }
  }
}

/** simple wrapper: rate-limit an async fn (qps with burst) */
export function rateLimit<T>(
  fn: (...args: any[]) => Promise<T>,
  qps: number,
  burst = Math.max(1, Math.ceil(qps))
) {
  const bucket = new TokenBucket(burst, qps);
  return async (...args: any[]) => {
    await bucket.take(1);
    return fn(...args);
  };
}

/** p-queue-ish scheduler: concurrency + optional rate limit */
export interface SchedulerOpts {
  concurrency?: number; // parallel workers
  qps?: number; // max per second
  burst?: number; // bucket size
}

export class Scheduler {
  private running = 0;
  private queue: Array<() => Promise<void>> = [];
  private limiter?: TokenBucket;

  constructor(private opts: SchedulerOpts = {}) {
    if (opts.qps) {
      this.limiter = new TokenBucket(
        opts.burst ?? Math.max(1, Math.ceil(opts.qps)),
        opts.qps
      );
    }
  }

  /** enqueue a task; resolves with its result */
  add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = async () => {
        try {
          if (this.limiter) await this.limiter.take(1);
          const val = await task();
          resolve(val);
        } catch (e) {
          reject(e);
        } finally {
          this.running--;
          this.drain();
        }
      };

      this.queue.push(run);
      this.drain();
    });
  }

  private drain() {
    const maxC = Math.max(1, this.opts.concurrency ?? 1);
    while (this.running < maxC && this.queue.length > 0) {
      const job = this.queue.shift()!;
      this.running++;
      void job();
    }
  }

  size() {
    return this.queue.length;
  }
  active() {
    return this.running;
  }
}

/* -------------------------
   3) Retry Policy Presets
   ------------------------- */

export interface RetryDecision {
  retry: boolean;
  reason?: string;
  // optional per-attempt delay override (ms); if undefined, caller uses backoff sequence
  delayMs?: number;
}

/** parse Retry-After header to delay (ms) if present */
export function retryAfterDelayMs(
  headers: Headers | Record<string, string> | undefined
): number | undefined {
  if (!headers) return undefined;
  const get = (k: string) =>
    headers instanceof Headers
      ? headers.get(k) ?? undefined
      : (headers as any)[k] ?? (headers as any)[k.toLowerCase()];
  const v = get("Retry-After");
  if (!v) return undefined;
  const s = v.trim();
  // seconds
  if (/^\d+$/.test(s)) return Number(s) * 1000;
  // http-date
  const t = Date.parse(s);
  return Number.isFinite(t) ? Math.max(0, t - Date.now()) : undefined;
}

export interface HttpLike {
  status: number;
  headers?: Headers | Record<string, string>;
  method?: string; // optional, if you pass it
}

/** idempotent methods (safe to retry by default) */
export const IDEMPOTENT = new Set(["GET", "HEAD", "PUT", "DELETE", "OPTIONS"]);

/** basic http-aware retry policy */
export function httpRetryPolicy(
  respOrErr: HttpLike | Error,
  attempt: number
): RetryDecision {
  // network error (no response) → retry
  if (respOrErr instanceof Error) {
    return { retry: true, reason: `network:${respOrErr.name}` };
  }
  const { status, headers, method } = respOrErr;
  // 408 Request Timeout, 429 Too Many Requests, 5xx → retry
  if (status === 408 || status === 429 || (status >= 500 && status <= 599)) {
    const delayMs = retryAfterDelayMs(headers);
    // for non-idempotent, be more conservative (allow at most 2 attempts)
    if (method && !IDEMPOTENT.has(method.toUpperCase()) && attempt > 2) {
      return { retry: false, reason: "non-idempotent cap" };
    }
    return { retry: true, reason: `http:${status}`, delayMs };
  }
  return { retry: false };
}

/** choose backoff delay (ms) with optional jitter (0..1) */
export function expBackoffDelay(
  attempt: number,
  baseMs = 200,
  factor = 2,
  jitter = 0
): number {
  const raw = baseMs * Math.pow(factor, Math.max(0, attempt - 1));
  if (!jitter) return raw;
  const delta = raw * jitter;
  return Math.max(0, raw + (Math.random() * 2 - 1) * delta);
}

/**
 * http-aware retry wrapper around a fetch-like fn.
 * - calls policy for each attempt; honors Retry-After when present
 */
export async function retryHttp<T extends { status: number; headers?: any }>(
  fn: () => Promise<T>,
  opts: {
    maxAttempts?: number;
    baseMs?: number;
    factor?: number;
    jitter?: number; // 0..1
    policy?: (respOrErr: HttpLike | Error, attempt: number) => RetryDecision;
    method?: string; // hint for policy
    signal?: AbortSignal;
  } = {}
): Promise<Result<T>> {
  const {
    maxAttempts = 5,
    baseMs = 200,
    factor = 2,
    jitter = 0.2,
    policy = httpRetryPolicy,
    method,
    signal,
  } = opts;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) return { ok: false, error: signal.reason };
    try {
      const resp = await fn();
      const dec = policy(
        { status: resp.status, headers: resp.headers, method },
        attempt
      );
      if (!dec.retry) return { ok: true, value: resp };
      if (attempt >= maxAttempts)
        return {
          ok: false,
          error: new Error(`retry exhausted: ${dec.reason}`),
        };
      const wait =
        dec.delayMs ?? expBackoffDelay(attempt, baseMs, factor, jitter);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    } catch (e: any) {
      const dec = policy(e, attempt);
      if (!dec.retry || attempt >= maxAttempts) return { ok: false, error: e };
      const wait =
        dec.delayMs ?? expBackoffDelay(attempt, baseMs, factor, jitter);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  return { ok: false, error: new Error("retry exhausted") };
}
