import { LruTtlCache } from "../src/cache";

/**
 * Benchmark for sweep/expiration performance
 * Compares lazy vs active expiration strategies
 */

console.log("\n=== Expiration Strategy Benchmarks ===\n");

// Helper function
function runBenchmark(name: string, fn: () => void | Promise<void>) {
  const start = performance.now();
  const result = fn();
  if (result instanceof Promise) {
    return result.then(() => {
      const end = performance.now();
      console.log(`✓ ${name}: ${(end - start).toFixed(2)}ms`);
      return end - start;
    });
  } else {
    const end = performance.now();
    console.log(`✓ ${name}: ${(end - start).toFixed(2)}ms`);
    return end - start;
  }
}

// Benchmark 1: Active expiration (old behavior)
console.log("--- BEFORE: Active Sweep (lazyExpiration: false) ---\n");

const activeSweep1 = await runBenchmark("10k entries with 50% expired (active sweep)", () => {
  const cache = new LruTtlCache<string, number>({ 
    maxEntries: 20000,
    sweepIntervalMs: 0,
    lazyExpiration: false // Force active sweep
  });
  
  // Add 10k entries, half already expired
  for (let i = 0; i < 10000; i++) {
    const ttl = i % 2 === 0 ? 1 : 60000; // Half expired, half valid
    cache.set(`key${i}`, i, { ttlMs: ttl });
  }
  
  // Wait for expiration
  const start = Date.now();
  while (Date.now() - start < 10) {} // 10ms delay
  
  // Trigger eviction (will call full sweep)
  cache.set("trigger", 999, { ttlMs: 60000 });
});

const activeSweep2 = await runBenchmark("100k entries with 80% expired (active sweep)", () => {
  const cache = new LruTtlCache<string, number>({ 
    maxEntries: 200000,
    sweepIntervalMs: 0,
    lazyExpiration: false
  });
  
  // Add 100k entries, 80% already expired
  for (let i = 0; i < 100000; i++) {
    const ttl = i % 5 === 0 ? 60000 : 1; // 20% valid, 80% expired
    cache.set(`key${i}`, i, { ttlMs: ttl });
  }
  
  // Wait for expiration
  const start = Date.now();
  while (Date.now() - start < 10) {}
  
  // Trigger eviction (will scan all 100k entries)
  cache.set("trigger", 999, { ttlMs: 60000 });
});

const activeSweepAvg = (activeSweep1 + activeSweep2) / 2;

// Benchmark 2: Lazy expiration (new behavior)
console.log("\n--- AFTER: Lazy Expiration (lazyExpiration: true, default) ---\n");

const lazySweep1 = await runBenchmark("10k entries with 50% expired (lazy + batched)", () => {
  const cache = new LruTtlCache<string, number>({ 
    maxEntries: 20000,
    sweepIntervalMs: 0,
    lazyExpiration: true // Default: only check up to N entries
  });
  
  // Add 10k entries, half already expired
  for (let i = 0; i < 10000; i++) {
    const ttl = i % 2 === 0 ? 1 : 60000;
    cache.set(`key${i}`, i, { ttlMs: ttl });
  }
  
  // Wait for expiration
  const start = Date.now();
  while (Date.now() - start < 10) {}
  
  // Trigger eviction (will check only ~10 entries)
  cache.set("trigger", 999, { ttlMs: 60000 });
});

const lazySweep2 = await runBenchmark("100k entries with 80% expired (lazy + batched)", () => {
  const cache = new LruTtlCache<string, number>({ 
    maxEntries: 200000,
    sweepIntervalMs: 0,
    lazyExpiration: true
  });
  
  // Add 100k entries, 80% already expired
  for (let i = 0; i < 100000; i++) {
    const ttl = i % 5 === 0 ? 60000 : 1;
    cache.set(`key${i}`, i, { ttlMs: ttl });
  }
  
  // Wait for expiration
  const start = Date.now();
  while (Date.now() - start < 10) {}
  
  // Trigger eviction (only checks ~10 entries instead of 100k)
  cache.set("trigger", 999, { ttlMs: 60000 });
});

const lazySweepAvg = (lazySweep1 + lazySweep2) / 2;

// Benchmark 3: Get operations with lazy checking
console.log("\n--- Get Performance with Expired Entries (Lazy) ---\n");

const getPerf = await runBenchmark("Get 1k keys from cache with 50% expired", () => {
  const cache = new LruTtlCache<string, number>({ 
    maxEntries: 20000,
    sweepIntervalMs: 0,
    lazyExpiration: true
  });
  
  // Add entries
  for (let i = 0; i < 10000; i++) {
    const ttl = i % 2 === 0 ? 1 : 60000;
    cache.set(`key${i}`, i, { ttlMs: ttl });
  }
  
  // Wait for expiration
  const start = Date.now();
  while (Date.now() - start < 10) {}
  
  // Get operations (checks expiration on access)
  for (let i = 0; i < 1000; i++) {
    cache.get(`key${i * 10}`);
  }
});

// Calculate improvement
const improvement = ((activeSweepAvg - lazySweepAvg) / activeSweepAvg * 100).toFixed(1);
const speedup = (activeSweepAvg / lazySweepAvg).toFixed(1);

console.log("\n=== Performance Summary ===\n");
console.log(`BEFORE (Active Sweep):  ${activeSweepAvg.toFixed(2)}ms average`);
console.log(`AFTER (Lazy Expiration): ${lazySweepAvg.toFixed(2)}ms average`);
console.log(`\n🚀 Improvement: ${improvement}% faster (${speedup}x speedup)`);
console.log(`\nNote: Lazy expiration avoids scanning entire cache on eviction.`);
console.log(`Instead, it checks up to 10 entries from tail, making eviction O(1) amortized.\n`);

console.log("=== Benchmark Complete ===\n");
