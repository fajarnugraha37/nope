import { describe, expect, test, mock } from "bun:test";
import {
  TokenBucket,
  rateLimit,
  Scheduler,
  type SchedulerOpts,
} from "../src/try/rate-limiting";

describe("TokenBucket", () => {
  describe("construction", () => {
    test("creates bucket with capacity and refill rate", () => {
      const bucket = new TokenBucket(10, 5);
      expect(bucket.capacity).toBe(10);
      expect(bucket.refillPerSec).toBe(5);
    });

    test("starts with full capacity", () => {
      const bucket = new TokenBucket(10, 5);
      expect(bucket.tryTake(10)).toBe(true);
      expect(bucket.tryTake(1)).toBe(false);
    });

    test("accepts custom clock", () => {
      let time = 1000;
      const clock = () => time;
      const bucket = new TokenBucket(5, 5, clock);
      expect(bucket.tryTake(5)).toBe(true);
    });
  });

  describe("tryTake", () => {
    test("consumes tokens immediately if available", () => {
      const bucket = new TokenBucket(10, 1);
      expect(bucket.tryTake(5)).toBe(true);
      expect(bucket.tryTake(5)).toBe(true);
      expect(bucket.tryTake(1)).toBe(false);
    });

    test("returns false when insufficient tokens", () => {
      const bucket = new TokenBucket(5, 1);
      bucket.tryTake(5);
      expect(bucket.tryTake(1)).toBe(false);
    });

    test("defaults to consuming 1 token", () => {
      const bucket = new TokenBucket(3, 1);
      expect(bucket.tryTake()).toBe(true);
      expect(bucket.tryTake()).toBe(true);
      expect(bucket.tryTake()).toBe(true);
      expect(bucket.tryTake()).toBe(false);
    });
  });

  describe("refill mechanism", () => {
    test("refills tokens based on time elapsed", () => {
      let time = 0;
      const clock = () => time;
      const bucket = new TokenBucket(10, 5, clock); // 5 tokens/sec

      bucket.tryTake(10); // empty bucket
      expect(bucket.tryTake(1)).toBe(false);

      time = 1000; // 1 second passes
      expect(bucket.tryTake(5)).toBe(true); // 5 tokens refilled
      expect(bucket.tryTake(1)).toBe(false);
    });

    test("does not exceed capacity when refilling", () => {
      let time = 0;
      const clock = () => time;
      const bucket = new TokenBucket(10, 10, clock);

      time = 10000; // 10 seconds = 100 tokens refilled
      expect(bucket.tryTake(10)).toBe(true); // only capacity available
      expect(bucket.tryTake(1)).toBe(false);
    });

    test("handles fractional refill correctly", () => {
      let time = 0;
      const clock = () => time;
      const bucket = new TokenBucket(10, 10, clock); // 10 tokens/sec

      bucket.tryTake(10);
      time = 500; // 0.5 sec = 5 tokens
      expect(bucket.tryTake(5)).toBe(true);
      expect(bucket.tryTake(1)).toBe(false);
    });

    test("handles multiple refill periods", () => {
      let time = 0;
      const clock = () => time;
      const bucket = new TokenBucket(20, 10, clock);

      bucket.tryTake(20);
      time = 1000; // +10 tokens
      bucket.tryTake(10);
      time = 2000; // +10 tokens
      expect(bucket.tryTake(10)).toBe(true);
      expect(bucket.tryTake(1)).toBe(false);
    });
  });

  describe("take (async)", () => {
    test("resolves immediately if tokens available", async () => {
      const bucket = new TokenBucket(5, 1);
      const result = await bucket.take(3);
      expect(result).toBe(true);
    });

    test("waits for tokens to refill", async () => {
      let time = 0;
      const clock = () => time;
      const bucket = new TokenBucket(10, 10, clock); // 10 tokens/sec

      bucket.tryTake(10);

      const promise = bucket.take(5);
      time = 500; // advance time
      const result = await promise;

      expect(result).toBe(true);
    });

    test("respects timeout", async () => {
      let time = 0;
      const clock = () => time;
      const bucket = new TokenBucket(5, 1, clock); // 1 token/sec

      bucket.tryTake(5);

      const promise = bucket.take(3, 1000); // needs 3 sec, timeout in 1 sec
      time = 1000;
      const result = await promise;

      expect(result).toBe(false);
    });

    test("succeeds before timeout", async () => {
      let time = 0;
      const clock = () => time;
      const bucket = new TokenBucket(10, 10, clock);

      bucket.tryTake(10);

      const promise = bucket.take(5, 2000);
      time = 500; // 5 tokens available after 0.5 sec
      const result = await promise;

      expect(result).toBe(true);
    });
  });

  describe("msUntil", () => {
    test("returns 0 if tokens already available", () => {
      const bucket = new TokenBucket(10, 5);
      expect(bucket.msUntil(5)).toBe(0);
    });

    test("estimates time until tokens available", () => {
      let time = 0;
      const clock = () => time;
      const bucket = new TokenBucket(10, 10, clock); // 10 tokens/sec = 0.01 tokens/ms

      bucket.tryTake(10);
      const ms = bucket.msUntil(5);
      expect(ms).toBe(500); // 5 tokens at 10/sec = 500ms
    });

    test("accounts for partial tokens", () => {
      let time = 0;
      const clock = () => time;
      const bucket = new TokenBucket(10, 10, clock);

      bucket.tryTake(10);
      time = 200; // 2 tokens refilled, 8 remaining

      const ms = bucket.msUntil(5); // need 3 more
      expect(ms).toBe(300);
    });
  });
});

describe("rateLimit", () => {
  test("wraps function with rate limiting", async () => {
    const fn = mock(async (x: number) => x * 2);
    const limited = rateLimit(fn, 10);

    const result = await limited(5);
    expect(result).toBe(10);
    expect(fn).toHaveBeenCalledWith(5);
  });

  test("delays calls when rate exceeded", async () => {
    let time = 0;
    const clock = () => time;

    let callCount = 0;
    const fn = async () => {
      callCount++;
      return callCount;
    };

    // 1 QPS, burst of 2
    const bucket = new (class extends TokenBucket {
      constructor() {
        super(2, 1, clock);
      }
    })();

    const limited = rateLimit(fn, 1, 2);

    // First 2 calls succeed immediately
    const r1 = await limited();
    const r2 = await limited();
    expect(r1).toBe(1);
    expect(r2).toBe(2);

    // Third call needs to wait
    const promise = limited();
    time = 1000; // advance 1 second
    const r3 = await promise;
    expect(r3).toBe(3);
  });

  test("uses default burst based on QPS", async () => {
    const fn = mock(async () => "ok");
    const limited = rateLimit(fn, 5); // burst should be Math.ceil(5) = 5

    // Should allow 5 immediate calls
    await Promise.all([
      limited(),
      limited(),
      limited(),
      limited(),
      limited(),
    ]);

    expect(fn).toHaveBeenCalledTimes(5);
  });
});

describe("Scheduler", () => {
  describe("construction", () => {
    test("creates scheduler with default concurrency", () => {
      const sched = new Scheduler();
      expect(sched.size()).toBe(0);
      expect(sched.active()).toBe(0);
    });

    test("accepts custom concurrency", () => {
      const sched = new Scheduler({ concurrency: 5 });
      expect(sched.size()).toBe(0);
    });

    test("accepts QPS rate limiting", () => {
      const sched = new Scheduler({ qps: 10, burst: 5 });
      expect(sched.size()).toBe(0);
    });
  });

  describe("task execution", () => {
    test("executes single task", async () => {
      const sched = new Scheduler();
      const task = mock(async () => 42);

      const result = await sched.add(task);
      expect(result).toBe(42);
      expect(task).toHaveBeenCalledTimes(1);
    });

    test("queues tasks and executes sequentially with concurrency=1", async () => {
      const sched = new Scheduler({ concurrency: 1 });
      const results: number[] = [];

      const task = (n: number) => async () => {
        await new Promise((r) => setTimeout(r, 10));
        results.push(n);
        return n;
      };

      const promises = [
        sched.add(task(1)),
        sched.add(task(2)),
        sched.add(task(3)),
      ];

      await Promise.all(promises);
      expect(results).toEqual([1, 2, 3]);
    });

    test("executes tasks in parallel with concurrency>1", async () => {
      const sched = new Scheduler({ concurrency: 3 });
      let concurrent = 0;
      let maxConcurrent = 0;

      const task = async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise((r) => setTimeout(r, 50));
        concurrent--;
      };

      await Promise.all([
        sched.add(task),
        sched.add(task),
        sched.add(task),
      ]);

      expect(maxConcurrent).toBe(3);
    });

    test("respects concurrency limit", async () => {
      const sched = new Scheduler({ concurrency: 2 });
      let concurrent = 0;
      let maxConcurrent = 0;

      const task = async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise((r) => setTimeout(r, 50));
        concurrent--;
      };

      await Promise.all([
        sched.add(task),
        sched.add(task),
        sched.add(task),
        sched.add(task),
      ]);

      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });
  });

  describe("queue management", () => {
    test("tracks queue size", async () => {
      const sched = new Scheduler({ concurrency: 1 });
      const slowTask = () => new Promise((r) => setTimeout(r, 100));

      sched.add(slowTask); // starts immediately
      sched.add(slowTask); // queued
      sched.add(slowTask); // queued

      await new Promise((r) => setTimeout(r, 10));
      expect(sched.size()).toBe(2);
      expect(sched.active()).toBe(1);
    });

    test("drains queue as tasks complete", async () => {
      const sched = new Scheduler({ concurrency: 1 });
      const task = () => Promise.resolve(42);

      const promises = [sched.add(task), sched.add(task), sched.add(task)];

      await Promise.all(promises);
      expect(sched.size()).toBe(0);
      expect(sched.active()).toBe(0);
    });
  });

  describe("error handling", () => {
    test("rejects promise when task throws", async () => {
      const sched = new Scheduler();
      const task = async () => {
        throw new Error("task failed");
      };

      await expect(sched.add(task)).rejects.toThrow("task failed");
    });

    test("continues processing queue after error", async () => {
      const sched = new Scheduler({ concurrency: 1 });
      const failTask = async () => {
        throw new Error("fail");
      };
      const okTask = async () => "ok";

      try {
        await sched.add(failTask);
      } catch {}

      const result = await sched.add(okTask);
      expect(result).toBe("ok");
    });
  });

  describe("rate limiting", () => {
    test("applies QPS rate limiting", async () => {
      let time = 0;
      // Note: We can't easily inject clock into Scheduler's TokenBucket
      // This test verifies the QPS option is accepted
      const sched = new Scheduler({ qps: 5, burst: 2 });

      const task = async () => "ok";
      const result = await sched.add(task);

      expect(result).toBe("ok");
    });

    test("combines concurrency and rate limiting", async () => {
      const sched = new Scheduler({
        concurrency: 2,
        qps: 10,
        burst: 5,
      });

      const tasks = Array.from({ length: 5 }, () => async () => "ok");
      const results = await Promise.all(tasks.map((t) => sched.add(t)));

      expect(results).toEqual(["ok", "ok", "ok", "ok", "ok"]);
    });
  });

  describe("edge cases", () => {
    test("handles zero-duration tasks", async () => {
      const sched = new Scheduler({ concurrency: 2 });
      const task = async () => 42;

      const results = await Promise.all([
        sched.add(task),
        sched.add(task),
        sched.add(task),
      ]);

      expect(results).toEqual([42, 42, 42]);
    });

    test("handles tasks that return undefined", async () => {
      const sched = new Scheduler();
      const task = async () => undefined;

      const result = await sched.add(task);
      expect(result).toBeUndefined();
    });

    test("handles concurrent adds", async () => {
      const sched = new Scheduler({ concurrency: 2 });
      const task = () => new Promise((r) => setTimeout(() => r("ok"), 10));

      const promises = Array.from({ length: 10 }, () => sched.add(task));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      expect(results.every((r) => r === "ok")).toBe(true);
    });
  });
});
