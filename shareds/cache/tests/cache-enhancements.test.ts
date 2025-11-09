import { describe, expect, test } from "bun:test";

import {
  LruTtlCache,
  sleep,
  withBatchOperations,
  createNamespace,
  warmCache,
  TransformCache,
} from "../src/index.ts";

describe("Cache Statistics", () => {
  test("tracks hit/miss rates", () => {
    const cache = new LruTtlCache<string, number>({ enableStats: true });
    
    cache.set("a", 1);
    cache.get("a"); // hit
    cache.get("b"); // miss
    cache.get("a"); // hit
    cache.get("c"); // miss

    const stats = cache.getStats();
    expect(stats).toBeDefined();
    expect(stats!.hits).toBe(2);
    expect(stats!.misses).toBe(2);
    expect(stats!.hitRate).toBe(0.5);
    expect(stats!.missRate).toBe(0.5);
  });

  test("tracks set/delete/eviction counts", () => {
    const cache = new LruTtlCache<string, number>({
      enableStats: true,
      maxEntries: 2,
    });

    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3); // evicts 'a'

    const stats = cache.getStats();
    expect(stats!.sets).toBe(3);
    expect(stats!.evictions).toBe(1);

    cache.del("b");
    const stats2 = cache.getStats();
    expect(stats2!.deletes).toBe(1);
  });

  test("reset stats clears counters", () => {
    const cache = new LruTtlCache<string, number>({ enableStats: true });

    cache.set("a", 1);
    cache.get("a");
    expect(cache.getStats()!.hits).toBe(1);

    cache.resetStats();
    expect(cache.getStats()!.hits).toBe(0);
  });

  test("tracks average size", () => {
    const cache = new LruTtlCache<string, number>({
      enableStats: true,
      sizer: (v) => v,
    });

    cache.set("a", 10);
    cache.set("b", 20);

    const stats = cache.getStats();
    expect(stats!.avgSize).toBe(15); // (10 + 20) / 2
  });
});

describe("Cache Events", () => {
  test("emits hit and miss events", async () => {
    const cache = new LruTtlCache<string, number>({ enableEvents: true });
    const hits: string[] = [];
    const misses: string[] = [];

    cache.on!("hit", (e) => hits.push(e.key));
    cache.on!("miss", (e) => misses.push(e.key));

    cache.set("a", 1);
    cache.get("a");
    cache.get("b");

    expect(hits).toEqual(["a"]);
    expect(misses).toEqual(["b"]);
  });

  test("emits set and delete events", () => {
    const cache = new LruTtlCache<string, number>({ enableEvents: true });
    const events: string[] = [];

    cache.on!("set", (e) => events.push(`set:${e.key}`));
    cache.on!("delete", (e) => events.push(`delete:${e.key}`));

    cache.set("a", 1);
    cache.del("a");

    expect(events).toEqual(["set:a", "delete:a"]);
  });

  test("emits evict event on overflow", () => {
    const cache = new LruTtlCache<string, number>({
      enableEvents: true,
      maxEntries: 2,
    });
    const evicted: string[] = [];

    cache.on!("evict", (e) => evicted.push(e.key));

    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3); // evicts 'a'

    expect(evicted).toEqual(["a"]);
  });

  test("emits expire event on TTL expiry", async () => {
    const cache = new LruTtlCache<string, number>({ enableEvents: true });
    const expired: string[] = [];

    cache.on!("expire", (e) => expired.push(e.key));

    cache.set("a", 1, { ttlMs: 5 });
    await sleep(10);
    cache.get("a"); // triggers expiry check

    expect(expired).toEqual(["a"]);
  });

  test("emits clear event", () => {
    const cache = new LruTtlCache<string, number>({ enableEvents: true });
    let cleared = false;

    cache.on!("clear", () => (cleared = true));

    cache.set("a", 1);
    cache.clear();

    expect(cleared).toBe(true);
  });

  test("wildcard listener receives all events", () => {
    const cache = new LruTtlCache<string, number>({ enableEvents: true });
    const allEvents: string[] = [];

    cache.on!("*", (e) => allEvents.push(e.type));

    cache.set("a", 1);
    cache.get("a");
    cache.del("a");

    expect(allEvents).toContain("set");
    expect(allEvents).toContain("hit");
    expect(allEvents).toContain("delete");
  });

  test("once listener fires only once", () => {
    const cache = new LruTtlCache<string, number>({ enableEvents: true });
    let count = 0;

    cache.once!("set", () => count++);

    cache.set("a", 1);
    cache.set("b", 2);

    expect(count).toBe(1);
  });

  test("off removes listener", () => {
    const cache = new LruTtlCache<string, number>({ enableEvents: true });
    let count = 0;

    const listener = () => count++;
    cache.on!("set", listener);

    cache.set("a", 1);
    expect(count).toBe(1);

    cache.off!("set", listener);
    cache.set("b", 2);
    expect(count).toBe(1); // not incremented
  });

  test("unsubscribe function removes listener", () => {
    const cache = new LruTtlCache<string, number>({ enableEvents: true });
    let count = 0;

    const unsubscribe = cache.on!("set", () => count++);

    cache.set("a", 1);
    expect(count).toBe(1);

    unsubscribe!();
    cache.set("b", 2);
    expect(count).toBe(1);
  });
});

describe("Batch Operations", () => {
  test("getMany retrieves multiple keys", () => {
    const cache = new LruTtlCache<string, number>();
    const batch = withBatchOperations(cache);

    batch.set("a", 1);
    batch.set("b", 2);
    batch.set("c", 3);

    const results = batch.getMany(["a", "b", "d"]);
    expect(results.get("a")).toBe(1);
    expect(results.get("b")).toBe(2);
    expect(results.has("d")).toBe(false);
  });

  test("setMany sets multiple entries", () => {
    const cache = new LruTtlCache<string, number>();
    const batch = withBatchOperations(cache);

    batch.setMany([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]);

    expect(cache.get("a")).toBe(1);
    expect(cache.get("b")).toBe(2);
    expect(cache.get("c")).toBe(3);
  });

  test("setMany accepts Map", () => {
    const cache = new LruTtlCache<string, number>();
    const batch = withBatchOperations(cache);

    const entries = new Map([
      ["a", 1],
      ["b", 2],
    ]);
    batch.setMany(entries);

    expect(cache.get("a")).toBe(1);
    expect(cache.get("b")).toBe(2);
  });

  test("deleteMany removes multiple keys", () => {
    const cache = new LruTtlCache<string, number>();
    const batch = withBatchOperations(cache);

    batch.set("a", 1);
    batch.set("b", 2);
    batch.set("c", 3);

    batch.deleteMany(["a", "c"]);

    expect(cache.has("a")).toBe(false);
    expect(cache.has("b")).toBe(true);
    expect(cache.has("c")).toBe(false);
  });

  test("hasMany checks multiple keys", () => {
    const cache = new LruTtlCache<string, number>();
    const batch = withBatchOperations(cache);

    batch.set("a", 1);
    batch.set("c", 3);

    const results = batch.hasMany(["a", "b", "c"]);
    expect(results.get("a")).toBe(true);
    expect(results.get("b")).toBe(false);
    expect(results.get("c")).toBe(true);
  });

  test("setMany with TTL options", () => {
    const cache = new LruTtlCache<string, number>();
    const batch = withBatchOperations(cache);

    batch.setMany(
      [
        ["a", 1],
        ["b", 2],
      ],
      { ttlMs: 100 }
    );

    expect(cache.has("a")).toBe(true);
    expect(cache.has("b")).toBe(true);
  });
});

describe("Namespaced Cache", () => {
  test("prefixes keys with namespace", () => {
    const cache = new LruTtlCache<string, number>();
    const ns1 = createNamespace<string, number>(cache, "app1");
    const ns2 = createNamespace<string, number>(cache, "app2");

    ns1.set("key", 1);
    ns2.set("key", 2);

    expect(ns1.get("key")).toBe(1);
    expect(ns2.get("key")).toBe(2);
    expect(cache.get("app1:key")).toBe(1);
    expect(cache.get("app2:key")).toBe(2);
  });

  test("custom separator", () => {
    const cache = new LruTtlCache<string, number>();
    const ns = createNamespace<string, number>(cache, "app", "/");

    ns.set("key", 42);

    expect(cache.get("app/key")).toBe(42);
  });

  test("namespace operations work independently", () => {
    const cache = new LruTtlCache<string, number>();
    const ns1 = createNamespace<string, number>(cache, "ns1");
    const ns2 = createNamespace<string, number>(cache, "ns2");

    ns1.set("a", 1);
    ns2.set("a", 2);

    expect(ns1.has("a")).toBe(true);
    expect(ns2.has("a")).toBe(true);
    expect(ns1.get("a")).toBe(1);
    expect(ns2.get("a")).toBe(2);

    ns1.del("a");
    expect(ns1.has("a")).toBe(false);
    expect(ns2.has("a")).toBe(true);
  });
});

describe("Cache Warming", () => {
  test("warmCache preloads data", async () => {
    const cache = new LruTtlCache<string, number>();

    const count = await warmCache(cache, async () => [
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]);

    expect(count).toBe(3);
    expect(cache.get("a")).toBe(1);
    expect(cache.get("b")).toBe(2);
    expect(cache.get("c")).toBe(3);
  });

  test("warmCache with sync loader", async () => {
    const cache = new LruTtlCache<string, string>();

    await warmCache(cache, () => [
      ["key1", "value1"],
      ["key2", "value2"],
    ]);

    expect(cache.get("key1")).toBe("value1");
    expect(cache.get("key2")).toBe("value2");
  });

  test("warmCache with TTL options", async () => {
    const cache = new LruTtlCache<string, number>();

    await warmCache(
      cache,
      () => [["a", 1]],
      { ttlMs: 100 }
    );

    expect(cache.has("a")).toBe(true);
  });
});

describe("Transform Cache", () => {
  test("transforms values on get/set", () => {
    const cache = new LruTtlCache<string, string>();
    const transformCache = new TransformCache(
      cache,
      (val: number) => String(val), // serialize
      (val: string) => Number(val) // deserialize
    );

    transformCache.set("a", 42);
    expect(cache.get("a")).toBe("42"); // stored as string
    expect(transformCache.get("a")).toBe(42); // retrieved as number
  });

  test("JSON serialization", () => {
    const cache = new LruTtlCache<string, string>();
    const jsonCache = new TransformCache<string, string, { value: number }>(
      cache,
      (obj) => JSON.stringify(obj),
      (str) => JSON.parse(str)
    );

    jsonCache.set("key", { value: 123 });
    const retrieved = jsonCache.get("key");

    expect(retrieved).toEqual({ value: 123 });
    expect(typeof cache.get("key")).toBe("string");
  });

  test("transform cache operations", () => {
    const cache = new LruTtlCache<string, string>();
    const transformCache = new TransformCache(
      cache,
      (val: number) => String(val),
      (val: string) => Number(val)
    );

    transformCache.set("a", 1);
    transformCache.set("b", 2);

    expect(transformCache.has("a")).toBe(true);
    expect(transformCache.size()).toBe(2);

    transformCache.del("a");
    expect(transformCache.has("a")).toBe(false);

    transformCache.clear();
    expect(transformCache.size()).toBe(0);
  });
});

describe("Integration: Stats + Events + Batch", () => {
  test("batch operations emit events and update stats", () => {
    const cache = new LruTtlCache<string, number>({
      enableStats: true,
      enableEvents: true,
    });
    const batch = withBatchOperations(cache);
    let setCount = 0;

    cache.on!("set", () => setCount++);

    batch.setMany([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]);

    expect(setCount).toBe(3);
    expect(cache.getStats()!.sets).toBe(3);
  });

  test("namespaced cache with stats", () => {
    const cache = new LruTtlCache<string, number>({ enableStats: true });
    const ns = createNamespace<string, number>(cache, "app");

    ns.set("a", 1);
    ns.get("a");
    ns.get("b");

    const stats = cache.getStats();
    expect(stats!.hits).toBe(1);
    expect(stats!.misses).toBe(1);
  });
});
