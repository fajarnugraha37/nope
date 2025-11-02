import { describe, expect, test } from "bun:test";

import {
  LruTtlCache,
  jsonSizer,
  now as cacheNow,
  sleep as cacheSleep,
  Singleflight,
} from "../src/index.ts";
import { IdempotencyCache } from "../src/index.ts";
import { KeyedLock } from "../src/index.ts";
import { LoadingCache } from "../src/index.ts";
import { memoize } from "../src/index.ts";
import { createReadThrough } from "../src/index.ts";

describe("cache primitives", () => {
  test("jsonSizer computes string length", () => {
    expect(jsonSizer({ a: 1 })).toBeGreaterThan(0);
  });

  test("now returns epoch milliseconds", () => {
    expect(typeof cacheNow()).toBe("number");
  });

  test("cache sleep resolves", async () => {
    const start = Date.now();
    await cacheSleep(5);
    expect(Date.now() - start).toBeGreaterThanOrEqual(5);
  });
});

describe("LruTtlCache", () => {
  test("set/get respects TTL", async () => {
    const cache = new LruTtlCache<string, number>({ sweepIntervalMs: 5 });
    cache.set("a", 1, { ttlMs: 5 });
    expect(cache.get("a")).toBe(1);
    await cacheSleep(10);
    expect(cache.get("a")).toBeUndefined();
    cache.stop();
  });

  test("sliding TTL updates expiry on access", async () => {
    const cache = new LruTtlCache<string, number>();
    cache.set("a", 1, { ttlMs: 5, slidingTtlMs: 20 });
    expect(cache.get("a")).toBe(1);
    await cacheSleep(10);
    expect(cache.get("a")).toBe(1);
  });

  test("evicts least recently used entries and tracks size", () => {
    const cache = new LruTtlCache<string, number>({ maxEntries: 2 });
    cache.set("a", 1);
    cache.set("b", 2);
    cache.get("a"); // make 'a' most recent
    cache.set("c", 3);
    expect(cache.has("a")).toBe(true);
    expect(cache.has("b")).toBe(false);
    expect(cache.size()).toBe(2);
  });

  test("enforces maxSize, supports del/clear/stop, and reports total size", () => {
    const cache = new LruTtlCache<string, number>({
      maxSize: 3,
      sizer: (v) => v,
      sweepIntervalMs: 5,
    });
    cache.set("a", 1);
    cache.set("b", 2);
    // total should clamp due to maxSize
    expect(cache.total()).toBeLessThanOrEqual(3);
    cache.del("a");
    expect(cache.has("a")).toBe(false);
    expect(cache.total()).toBe(2);
    cache.clear();
    expect(cache.size()).toBe(0);
    cache.stop();
  });
});

describe("Singleflight", () => {
  test("coalesces concurrent calls", async () => {
    const sf = new Singleflight<string, number>();
    let runs = 0;
    const tasks = Promise.all([
      sf.do("key", async () => {
        runs++;
        await cacheSleep(5);
        return 1;
      }),
      sf.do("key", async () => {
        runs++;
        return 2;
      }),
    ]);
    const results = await tasks;
    expect(results).toEqual([1, 1]);
    expect(runs).toBe(1);
  });
});

describe("IdempotencyCache", () => {
  test("execute caches results per key", async () => {
    const cache = new IdempotencyCache<number>(1000);
    let calls = 0;
    const compute = async () => {
      calls++;
      return 42;
    };
    expect(await cache.execute("k", compute)).toBe(42);
    expect(await cache.execute("k", compute)).toBe(42);
    expect(calls).toBe(1);
  });
});

describe("KeyedLock", () => {
  test("enforces per-key mutual exclusion", async () => {
    const lock = new KeyedLock<string>();
    let concurrency = 0;
    let maxConcurrency = 0;

    await Promise.all(
      Array.from({ length: 5 }).map(async () => {
        const release = await lock.acquire("key");
        concurrency++;
        maxConcurrency = Math.max(maxConcurrency, concurrency);
        await cacheSleep(2);
        concurrency--;
        release();
      })
    );

    expect(maxConcurrency).toBe(1);
  });
});

describe("LoadingCache", () => {
  test("returns cached value and refreshes stale entries", async () => {
    const store = new LruTtlCache<string, number>();
    let loads = 0;
    const loader = async (k: string) => {
      loads++;
      return k.length;
    };
    const lc = new LoadingCache(store, loader);

    expect(await lc.get("aa", { ttlMs: 5 })).toBe(2);
    expect(await lc.get("aa", { ttlMs: 5 })).toBe(2);
    await cacheSleep(6);
    const stale = lc.get("aa", {
      ttlMs: 5,
      staleWhileRevalidateMs: 50,
    });
    expect(await stale).toBe(2);
    await cacheSleep(10);
    expect(loads).toBeGreaterThanOrEqual(2);
  });
});

describe("memoize", () => {
  test("memoize caches sync function results", async () => {
    let calls = 0;
    const fn = memoize((x: number) => {
      console.log("called");
      calls++;
      return x * 2;
    });
    expect(await fn(2)).toBe(4);
    expect(await fn(2)).toBe(4);
    expect(calls).toBe(1);
  });

  test("memoize caches async function and supports SWR", async () => {
    let calls = 0;
    const fn = memoize(
      async (x: number) => {
        calls++;
        return x * 3;
      },
      { ttlMs: 5, swrMs: 20 }
    );
    expect(await fn(2)).toBe(6);
    await cacheSleep(6);
    const stale = fn(2);
    expect(await stale).toBe(6);
    await cacheSleep(5);
    expect(calls).toBeGreaterThanOrEqual(2);
  });

  test("memoize falls back to string key when JSON stringify fails", async () => {
    const originalStringify = JSON.stringify;
    try {
      JSON.stringify = () => {
        throw new Error("no stringify");
      };
      let calls = 0;
      const fn = memoize((obj: { value: number }) => {
        calls++;
        return obj.value;
      });
      const first = await fn({ value: 1 });
      const second = await fn({ value: 1 });
      expect(first).toBe(1);
      expect(second).toBe(1);
      expect(calls).toBe(1);
      (fn as any).clear();
    } finally {
      JSON.stringify = originalStringify;
    }
  });

  test("memoize caches errors when configured", async () => {
    let calls = 0;
    const fn = memoize(
      async () => {
        calls++;
        throw new Error("boom");
      },
      { cacheErrors: true, ttlMs: 10 }
    );
    const first = await fn();
    expect(first).toBeInstanceOf(Error);
    const second = await fn();
    expect(second).toBe(first);
    expect(calls).toBe(1);
  });

  test("memoize serves stale value during SWR window and refreshes", async () => {
    const originalNow = Date.now;
    const originalRandom = Math.random;
    try {
      let now = 0;
      Date.now = () => now;
      Math.random = () => 0.5;
      let calls = 0;
      const fn = memoize(
        async (value: number) => {
          calls++;
          return value * 10 + calls;
        },
        { ttlMs: 10, swrMs: 40, jitter: 0 }
      );

      const initial = await fn(1);
      expect(initial).toBe(11);
      expect(calls).toBe(1);

      now = 20; // expired but within swr
      const stale = await fn(1);
      expect(stale).toBe(initial);
      expect(calls).toBe(1);

      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(calls).toBeGreaterThan(1);

      now = 80;
      const refreshed = await fn(1);
      expect(refreshed).not.toBe(initial);
    } finally {
      Date.now = originalNow;
      Math.random = originalRandom;
    }
  });
});

describe("createReadThrough", () => {
  test("read-through cache uses loader and caching", async () => {
    let calls = 0;
    const readThrough = createReadThrough(
      async (key: string) => {
        calls++;
        return key.toUpperCase();
      },
      { ttlMs: 10 }
    );

    expect(await readThrough.get("foo")).toBe("FOO");
    expect(await readThrough.get("foo")).toBe("FOO");
    expect(calls).toBe(1);
    readThrough.clear();
    readThrough.del("foo");
    expect(await readThrough.get("foo")).toBe("FOO");
    expect(calls).toBe(2);
  });
});
