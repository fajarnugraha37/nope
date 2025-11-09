import type { RateLimitOptions } from "../api.js";

type Waiter = {
  resolve: () => void;
};

export class TokenBucket {
  private readonly capacity: number;
  private readonly refillRate: number;
  private readonly refillIntervalMs: number;
  private tokens: number;
  private lastRefill: number;
  private readonly waiters: Waiter[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(options: RateLimitOptions) {
    if (options.capacity <= 0) {
      throw new Error("Rate limit capacity must be greater than 0");
    }
    this.capacity = options.capacity;
    this.refillRate = options.refillRate;
    this.refillIntervalMs = options.refillIntervalMs;
    const initial = options.burst ?? this.capacity;
    this.tokens = Math.min(initial, this.capacity);
    this.lastRefill = Date.now();
  }

  async take(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    await new Promise<void>((resolve) => {
      this.waiters.push({ resolve });
      this.ensureTimer();
    });
  }

  private refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    if (elapsed <= 0) {
      return;
    }
    const increments = Math.floor(elapsed / this.refillIntervalMs);
    if (increments <= 0) {
      return;
    }
    const refillAmount = increments * this.refillRate;
    this.tokens = Math.min(this.capacity, this.tokens + refillAmount);
    this.lastRefill = now;
    this.flush();
  }

  private flush() {
    while (this.tokens >= 1 && this.waiters.length > 0) {
      this.tokens -= 1;
      const next = this.waiters.shift();
      next?.resolve();
    }
    if (this.waiters.length === 0 && this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  private ensureTimer() {
    if (this.timer) {
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.refill();
      if (this.waiters.length > 0) {
        this.ensureTimer();
      }
    }, this.refillIntervalMs);
    if (typeof this.timer === "object" && "unref" in this.timer && typeof (this.timer as any).unref === "function") {
      (this.timer as any).unref();
    }
  }
}
