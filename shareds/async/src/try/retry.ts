import { type Result } from "./wrappers.ts";

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
