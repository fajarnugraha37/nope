import { LruTtlCache } from "../src/cache";

/**
 * Comprehensive benchmark for README.md
 * Tests with realistic workloads: 1M small entries, 100k large objects
 */

console.log("\n=== Comprehensive Cache Benchmark for README ===\n");

function benchmark(name: string, fn: () => void, runs: number = 10): number {
  // Warmup
  for (let i = 0; i < 2; i++) fn();
  
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    fn();
    const end = performance.now();
    times.push(end - start);
  }
  
  // Remove outliers
  times.sort((a, b) => a - b);
  const trimmed = times.slice(Math.floor(runs * 0.1), Math.floor(runs * 0.9));
  const avg = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
  
  return avg;
}

console.log("📊 SMALL ENTRIES (1M operations)\n");

// 1M set operations
const set1M = benchmark("Set 1M small entries", () => {
  const cache = new LruTtlCache<string, number>({ 
    maxEntries: 1_000_000 
  });
  for (let i = 0; i < 1_000_000; i++) {
    cache.set(`key${i}`, i);
  }
});

console.log(`   Set 1M entries:  ${set1M.toFixed(0)}ms (${(1_000_000 / set1M * 1000).toFixed(0)} ops/sec)`);

// 1M get operations
const get1M = benchmark("Get 1M small entries", () => {
  const cache = new LruTtlCache<string, number>({ 
    maxEntries: 1_000_000 
  });
  for (let i = 0; i < 1_000_000; i++) {
    cache.set(`key${i}`, i);
  }
  for (let i = 0; i < 1_000_000; i++) {
    cache.get(`key${i}`);
  }
});

console.log(`   Get 1M entries:  ${get1M.toFixed(0)}ms (${(1_000_000 / get1M * 1000).toFixed(0)} ops/sec)\n`);

console.log("📊 LARGE OBJECTS (100k operations)\n");

const largeObject = {
  id: 123,
  users: Array.from({ length: 100 }, (_, i) => ({
    id: i,
    name: `User ${i}`,
    email: `user${i}@example.com`,
    metadata: { key: `value_${i}`, score: Math.random() }
  })),
  settings: {
    theme: "dark",
    notifications: true,
    privacy: { level: "high", cookies: false }
  }
};

const set100k = benchmark("Set 100k large objects", () => {
  const cache = new LruTtlCache<string, any>({ 
    maxEntries: 100_000 
  });
  for (let i = 0; i < 100_000; i++) {
    cache.set(`key${i}`, { ...largeObject, id: i });
  }
}, 5);

console.log(`   Set 100k large:  ${set100k.toFixed(0)}ms (${(100_000 / set100k * 1000).toFixed(0)} ops/sec)`);

const get100k = benchmark("Get 100k large objects", () => {
  const cache = new LruTtlCache<string, any>({ 
    maxEntries: 100_000 
  });
  for (let i = 0; i < 100_000; i++) {
    cache.set(`key${i}`, { ...largeObject, id: i });
  }
  for (let i = 0; i < 100_000; i++) {
    cache.get(`key${i}`);
  }
}, 5);

console.log(`   Get 100k large:  ${get100k.toFixed(0)}ms (${(100_000 / get100k * 1000).toFixed(0)} ops/sec)\n`);

console.log("📊 LRU EVICTION\n");

const evict = benchmark("LRU eviction (1M→500k)", () => {
  const cache = new LruTtlCache<string, number>({ 
    maxEntries: 500_000 
  });
  // Fill cache beyond capacity to trigger eviction
  for (let i = 0; i < 1_000_000; i++) {
    cache.set(`key${i}`, i);
  }
}, 3);

console.log(`   Evict 500k:      ${evict.toFixed(0)}ms (${(500_000 / evict * 1000).toFixed(0)} evictions/sec)\n`);

console.log("📊 TTL EXPIRATION\n");

const expire = benchmark("Lazy expiration (100k)", () => {
  const cache = new LruTtlCache<string, number>({ 
    maxEntries: 100_000,
    lazyExpiration: true
  });
  // Set with short TTL
  for (let i = 0; i < 100_000; i++) {
    cache.set(`key${i}`, i, { ttlMs: 1 });
  }
  // Wait for expiration
  const start = Date.now();
  while (Date.now() - start < 10) {}
  // Access to trigger lazy expiration
  for (let i = 0; i < 100_000; i++) {
    cache.get(`key${i}`);
  }
}, 5);

console.log(`   Lazy expire 100k: ${expire.toFixed(0)}ms\n`);

console.log("📊 EVENT SYSTEM\n");

const noEvents = benchmark("Set 100k (no events)", () => {
  const cache = new LruTtlCache<string, number>({ 
    maxEntries: 100_000,
    enableEvents: false
  });
  for (let i = 0; i < 100_000; i++) {
    cache.set(`key${i}`, i);
  }
});

const withEvents = benchmark("Set 100k (events, no listeners)", () => {
  const cache = new LruTtlCache<string, number>({ 
    maxEntries: 100_000,
    enableEvents: true
  });
  for (let i = 0; i < 100_000; i++) {
    cache.set(`key${i}`, i);
  }
});

const withListener = benchmark("Set 100k (events + 1 listener)", () => {
  const cache = new LruTtlCache<string, number>({ 
    maxEntries: 100_000,
    enableEvents: true
  });
  let count = 0;
  cache.on("set", () => count++);
  for (let i = 0; i < 100_000; i++) {
    cache.set(`key${i}`, i);
  }
});

const eventOverhead = ((withEvents / noEvents - 1) * 100).toFixed(1);
console.log(`   No events:       ${noEvents.toFixed(0)}ms`);
console.log(`   Events enabled:  ${withEvents.toFixed(0)}ms (+${eventOverhead}% overhead)`);
console.log(`   With listener:   ${withListener.toFixed(0)}ms\n`);

console.log("📊 MEMORY EFFICIENCY\n");

const cache = new LruTtlCache<string, { data: string }>({ 
  maxEntries: 10_000 
});

// Estimate memory per entry
const memBefore = (performance as any).memory?.usedJSHeapSize || 0;
for (let i = 0; i < 10_000; i++) {
  cache.set(`key_${i}`, { data: `value_${i}` });
}
const memAfter = (performance as any).memory?.usedJSHeapSize || 0;
const memPerEntry = Math.round((memAfter - memBefore) / 10_000);

console.log(`   10k entries:     ~${memPerEntry} bytes/entry (estimated)\n`);

console.log("=".repeat(70));
console.log("📈 SUMMARY FOR README");
console.log("=".repeat(70) + "\n");

console.log("Performance Benchmarks:");
console.log(`  • 1M set operations:      ${set1M.toFixed(0)}ms (${(1_000_000 / set1M * 1000).toFixed(0)} ops/sec)`);
console.log(`  • 1M get operations:      ${get1M.toFixed(0)}ms (${(1_000_000 / get1M * 1000).toFixed(0)} ops/sec)`);
console.log(`  • 100k large objects set: ${set100k.toFixed(0)}ms (${(100_000 / set100k * 1000).toFixed(0)} ops/sec)`);
console.log(`  • 100k large objects get: ${get100k.toFixed(0)}ms (${(100_000 / get100k * 1000).toFixed(0)} ops/sec)`);
console.log(`  • LRU eviction:           ${evict.toFixed(0)}ms (${(500_000 / evict * 1000).toFixed(0)} evictions/sec)`);
console.log(`  • Event system overhead:  ${eventOverhead}% (when enabled with no listeners)`);
console.log(`  • Memory per entry:       ~${memPerEntry} bytes\n`);

console.log("=== Benchmark Complete ===\n");
