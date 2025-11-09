import type { Clock } from "./circuit-breaker.ts";

const now: Clock = () => Date.now();

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
