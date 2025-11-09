import {
	Channel,
	select,
	Mutex,
	Semaphore,
	FairSemaphore,
	JobQueue,
	CountdownLatch,
	PriorityQueue,
	ThreadPool,
} from "../src/concurrency/index";
import { EventBus } from "../src/emitter/index";
import mitt from "../src/emitter/event-emitter";

/**
 * Benchmark test suite for @fajarnugraha37/async
 * Run with: bun run tests/async.bench.ts
 */

console.log("\n=== @fajarnugraha37/async Performance Benchmarks ===\n");

// Helper function to run benchmarks
function runBenchmark(name: string, fn: () => void | Promise<void>) {
  const start = performance.now();
  const result = fn();
  if (result instanceof Promise) {
    return result.then(() => {
      const end = performance.now();
      console.log(`✓ ${name}: ${(end - start).toFixed(2)}ms`);
    });
  } else {
    const end = performance.now();
    console.log(`✓ ${name}: ${(end - start).toFixed(2)}ms`);
  }
}

// Benchmark 1: Set operations (no stats, no events)
runBenchmark("Set 10k entries (no stats, no events)", () => {
  const cache = new LruTtlCache<string, number>({ maxEntries: 10_000 });
  for (let i = 0; i < 10_000; i++) {
    cache.set(`key${i}`, i);
  }
});

// Benchmark 2: Set operations (with stats)
runBenchmark("Set 10k entries (with stats)", () => {
  const cache = new LruTtlCache<string, number>({
    maxEntries: 10_000,
    enableStats: true,
  });
  for (let i = 0; i < 10_000; i++) {
    cache.set(`key${i}`, i);
  }
});

// Benchmark 3: Set operations (with events)
runBenchmark("Set 10k entries (with events)", () => {
  const cache = new LruTtlCache<string, number>({
    maxEntries: 10_000,
    enableEvents: true,
  });
  cache.on("set", () => {}); // Add listener
  for (let i = 0; i < 10_000; i++) {
    cache.set(`key${i}`, i);
  }
});

// Benchmark 4: Get operations (cache hits)
runBenchmark("Get 10k entries (cache hits)", () => {
  const cache = new LruTtlCache<string, number>({ maxEntries: 10_000 });
  for (let i = 0; i < 10_000; i++) {
    cache.set(`key${i}`, i);
  }
  for (let i = 0; i < 10_000; i++) {
    cache.get(`key${i}`);
  }
});

// Benchmark 5: Get operations (cache misses)
runBenchmark("Get 10k entries (cache misses)", () => {
  const cache = new LruTtlCache<string, number>({ maxEntries: 10_000 });
  for (let i = 0; i < 10_000; i++) {
    cache.get(`key${i}`);
  }
});

// Benchmark 6: Set with TTL
runBenchmark("Set with TTL (10k entries)", () => {
  const cache = new LruTtlCache<string, number>({ maxEntries: 10_000 });
  for (let i = 0; i < 10_000; i++) {
    cache.set(`key${i}`, i, { ttlMs: 5000 });
  }
});

// Benchmark 7: LRU eviction
runBenchmark("LRU eviction (1k entries, max 100)", () => {
  const cache = new LruTtlCache<string, number>({ maxEntries: 100 });
  for (let i = 0; i < 1_000; i++) {
    cache.set(`key${i}`, i);
  }
});

// Benchmark 8: Delete operations
runBenchmark("Delete 1k entries", () => {
  const cache = new LruTtlCache<string, number>({ maxEntries: 10_000 });
  for (let i = 0; i < 1_000; i++) {
    cache.set(`key${i}`, i);
  }
  for (let i = 0; i < 1_000; i++) {
    cache.del(`key${i}`);
  }
});

// Benchmark 9: Clear cache
runBenchmark("Clear cache (10k entries)", () => {
  const cache = new LruTtlCache<string, number>({ maxEntries: 10_000 });
  for (let i = 0; i < 10_000; i++) {
    cache.set(`key${i}`, i);
  }
  cache.clear();
});

console.log("\n=== Batch Operations Performance ===\n");

// Benchmark 10: setMany
runBenchmark("setMany 1k entries", () => {
  const cache = new LruTtlCache<string, number>({ maxEntries: 10_000 });
  const batchCache = withBatchOperations(cache);
  const entries: Array<[string, number]> = Array.from(
    { length: 1_000 },
    (_, i) => [`key${i}`, i]
  );
  batchCache.setMany(entries);
});

// Benchmark 11: getMany (all hits)
runBenchmark("getMany 1k entries (all hits)", () => {
  const cache = new LruTtlCache<string, number>({ maxEntries: 10_000 });
  const batchCache = withBatchOperations(cache);
  for (let i = 0; i < 1_000; i++) {
    cache.set(`key${i}`, i);
  }
  const keys = Array.from({ length: 1_000 }, (_, i) => `key${i}`);
  batchCache.getMany(keys);
});

// Benchmark 12: deleteMany
runBenchmark("deleteMany 1k entries", () => {
  const cache = new LruTtlCache<string, number>({ maxEntries: 10_000 });
  const batchCache = withBatchOperations(cache);
  for (let i = 0; i < 1_000; i++) {
    cache.set(`key${i}`, i);
  }
  const keys = Array.from({ length: 1_000 }, (_, i) => `key${i}`);
  batchCache.deleteMany(keys);
});

// Benchmark 13: hasMany
runBenchmark("hasMany 1k entries", () => {
  const cache = new LruTtlCache<string, number>({ maxEntries: 10_000 });
  const batchCache = withBatchOperations(cache);
  for (let i = 0; i < 1_000; i++) {
    cache.set(`key${i}`, i);
  }
  const keys = Array.from({ length: 1_000 }, (_, i) => `key${i}`);
  batchCache.hasMany(keys);
});

console.log("\n=== LoadingCache Performance ===\n");

// Benchmark 14: LoadingCache (1k loads)
await runBenchmark("LoadingCache get (1k loads)", async () => {
  const store = new LruTtlCache<string, number>();
  const loader = new LoadingCache(store, async (key: string) => {
    return key.length;
  });

  const promises = [];
  for (let i = 0; i < 1_000; i++) {
    promises.push(loader.get(`key${i}`, { ttlMs: 5000 }));
  }
  await Promise.all(promises);
});

// Benchmark 15: LoadingCache (1k cached hits)
await runBenchmark("LoadingCache get (1k cached hits)", async () => {
  const store = new LruTtlCache<string, number>();
  const loader = new LoadingCache(store, async (key: string) => {
    return key.length;
  });

  // Pre-populate
  for (let i = 0; i < 1_000; i++) {
    await loader.get(`key${i}`, { ttlMs: 5000 });
  }

  const promises = [];
  for (let i = 0; i < 1_000; i++) {
    promises.push(loader.get(`key${i}`, { ttlMs: 5000 }));
  }
  await Promise.all(promises);
});

console.log("\n=== Memoize Performance ===\n");

// Benchmark 16: Memoize sync function
runBenchmark("memoize sync function (1k calls, 100 unique)", () => {
  let callCount = 0;
  const fn = memoize((x: number) => {
    callCount++;
    return x * 2;
  });

  for (let i = 0; i < 1_000; i++) {
    fn(i % 100);
  }
});

// Benchmark 17: Memoize async function
await runBenchmark("memoize async function (1k calls, 100 unique)", async () => {
  let callCount = 0;
  const fn = memoize(async (x: number) => {
    callCount++;
    return x * 2;
  });

  const promises = [];
  for (let i = 0; i < 1_000; i++) {
    promises.push(fn(i % 100));
  }
  await Promise.all(promises);
});

console.log("\n=== Namespaced Cache Performance ===\n");

// Benchmark 18: Namespaced set
runBenchmark("namespaced set (1k entries, 10 namespaces)", () => {
  const cache = new LruTtlCache<string, number>({ maxEntries: 10_000 });
  const namespaces = Array.from({ length: 10 }, (_, i) =>
    createNamespace(cache, `ns${i}`)
  );

  for (let i = 0; i < 1_000; i++) {
    const ns = namespaces[i % 10];
    ns.set(`key${i}`, i);
  }
});

// Benchmark 19: Namespaced get
runBenchmark("namespaced get (1k entries, 10 namespaces)", () => {
  const cache = new LruTtlCache<string, number>({ maxEntries: 10_000 });
  const namespaces = Array.from({ length: 10 }, (_, i) =>
    createNamespace(cache, `ns${i}`)
  );

  for (let i = 0; i < 1_000; i++) {
    const ns = namespaces[i % 10];
    ns.set(`key${i}`, i);
  }

  for (let i = 0; i < 1_000; i++) {
    const ns = namespaces[i % 10];
    ns.get(`key${i}`);
  }
});

console.log("\n=== Transform Cache Performance ===\n");

// Benchmark 20: TransformCache JSON set
runBenchmark("TransformCache JSON set (1k entries)", () => {
  const cache = new LruTtlCache<string, string>({ maxEntries: 10_000 });
  const transformCache = new TransformCache(
    cache,
    (obj) => JSON.stringify(obj),
    (str) => JSON.parse(str)
  );

  for (let i = 0; i < 1_000; i++) {
    transformCache.set(`key${i}`, { id: i, name: `user${i}` });
  }
});

// Benchmark 21: TransformCache JSON get
runBenchmark("TransformCache JSON get (1k entries)", () => {
  const cache = new LruTtlCache<string, string>({ maxEntries: 10_000 });
  const transformCache = new TransformCache(
    cache,
    (obj) => JSON.stringify(obj),
    (str) => JSON.parse(str)
  );

  for (let i = 0; i < 1_000; i++) {
    transformCache.set(`key${i}`, { id: i, name: `user${i}` });
  }

  for (let i = 0; i < 1_000; i++) {
    transformCache.get(`key${i}`);
  }
});

console.log("\n=== Cache Warming Performance ===\n");

// Benchmark 22: warmCache with 1k entries
await runBenchmark("warmCache with 1k entries", async () => {
  const cache = new LruTtlCache<string, number>({ maxEntries: 10_000 });
  await warmCache(cache, async () => {
    return Array.from({ length: 1_000 }, (_, i): [string, number] => [
      `key${i}`,
      i,
    ]);
  });
});

// Benchmark 23: warmCache with sync loader
await runBenchmark("warmCache with 1k entries (sync loader)", async () => {
  const cache = new LruTtlCache<string, number>({ maxEntries: 10_000 });
  await warmCache(cache, () => {
    return Array.from({ length: 1_000 }, (_, i): [string, number] => [
      `key${i}`,
      i,
    ]);
  });
});

console.log("\n=== Memory Efficiency ===\n");

// Benchmark 24: 100k small entries
runBenchmark("memory: 100k small entries", () => {
  const cache = new LruTtlCache<string, number>({ maxEntries: 100_000 });
  for (let i = 0; i < 100_000; i++) {
    cache.set(`key${i}`, i);
  }
});

// Benchmark 25: 10k large objects
runBenchmark("memory: 10k large objects", () => {
  const cache = new LruTtlCache<string, any>({ maxEntries: 10_000 });
  for (let i = 0; i < 10_000; i++) {
    cache.set(`key${i}`, {
      id: i,
      name: `user${i}`,
      email: `user${i}@example.com`,
      data: Array.from({ length: 100 }, (_, j) => j),
    });
  }
});

console.log("\n=== Event System Performance ===\n");

// Benchmark 26: Events with 1 listener
runBenchmark("events: 10k operations with 1 listener", () => {
  const cache = new LruTtlCache<string, number>({
    maxEntries: 10_000,
    enableEvents: true,
  });
  cache.on("set", () => {});

  for (let i = 0; i < 10_000; i++) {
    cache.set(`key${i}`, i);
  }
});

// Benchmark 27: Events with 5 listeners
runBenchmark("events: 10k operations with 5 listeners", () => {
  const cache = new LruTtlCache<string, number>({
    maxEntries: 10_000,
    enableEvents: true,
  });
  for (let j = 0; j < 5; j++) {
    cache.on("set", () => {});
  }

  for (let i = 0; i < 10_000; i++) {
    cache.set(`key${i}`, i);
  }
});

// Benchmark 28: Events with wildcard listener
runBenchmark("events: 10k operations with wildcard listener", () => {
  const cache = new LruTtlCache<string, number>({
    maxEntries: 10_000,
    enableEvents: true,
  });
  cache.on("*", () => {});

  for (let i = 0; i < 10_000; i++) {
    cache.set(`key${i}`, i);
  }
});

console.log("\n=== Statistics Performance ===\n");

// Benchmark 29: Stats 10k operations
runBenchmark("stats: 10k operations", () => {
  const cache = new LruTtlCache<string, number>({
    maxEntries: 10_000,
    enableStats: true,
  });

  for (let i = 0; i < 10_000; i++) {
    cache.set(`key${i}`, i);
    cache.get(`key${i}`);
  }
});

// Benchmark 30: getStats() 1k calls
runBenchmark("stats: getStats() 1k calls", () => {
  const cache = new LruTtlCache<string, number>({
    maxEntries: 10_000,
    enableStats: true,
  });

  for (let i = 0; i < 10_000; i++) {
    cache.set(`key${i}`, i);
  }

  for (let i = 0; i < 1_000; i++) {
    cache.getStats();
  }
});

// Benchmark 31: resetStats() 1k calls
runBenchmark("stats: resetStats() 1k calls", () => {
  const cache = new LruTtlCache<string, number>({
    maxEntries: 10_000,
    enableStats: true,
  });

  for (let i = 0; i < 10_000; i++) {
    cache.set(`key${i}`, i);
    cache.get(`key${i}`);
  }

  for (let i = 0; i < 1_000; i++) {
    cache.getStats();
    cache.resetStats();
  }
});

console.log("\n=== Benchmark Complete ===\n");
