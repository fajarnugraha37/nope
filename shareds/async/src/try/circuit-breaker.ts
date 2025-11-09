import { tryCatchAsync, type Result } from "./wrappers.ts";

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