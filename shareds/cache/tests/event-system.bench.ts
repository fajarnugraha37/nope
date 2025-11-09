import { LruTtlCache } from "../src/cache";

/**
 * Benchmark for event system optimization
 * Tests the overhead of event emission in various scenarios
 */

console.log("\n=== Event System Overhead Benchmark ===\n");

// Helper
function runBenchmark(name: string, fn: () => void, iterations: number = 5) {
  const times: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    const end = performance.now();
    times.push(end - start);
  }
  
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  console.log(`✓ ${name}:`);
  console.log(`  Avg: ${avg.toFixed(2)}ms | Min: ${min.toFixed(2)}ms | Max: ${max.toFixed(2)}ms`);
  
  return avg;
}

console.log("--- BASELINE: Events DISABLED ---\n");

let baselineSet = 0;
let baselineGet = 0;
let baselineMixed = 0;

// Benchmark 1: Set operations without events
baselineSet = runBenchmark("Set 100k entries (no events)", () => {
  const cache = new LruTtlCache<string, any>({ 
    maxEntries: 100_000,
    enableEvents: false
  });
  
  for (let i = 0; i < 100_000; i++) {
    cache.set(`key${i}`, { id: i, value: `data_${i}` });
  }
});

// Benchmark 2: Get operations without events
baselineGet = runBenchmark("Get 100k entries (no events)", () => {
  const cache = new LruTtlCache<string, any>({ 
    maxEntries: 100_000,
    enableEvents: false
  });
  
  for (let i = 0; i < 100_000; i++) {
    cache.set(`key${i}`, { id: i });
  }
  
  for (let i = 0; i < 100_000; i++) {
    cache.get(`key${i}`);
  }
});

// Benchmark 3: Mixed operations without events
baselineMixed = runBenchmark("Mixed 100k ops (no events)", () => {
  const cache = new LruTtlCache<string, any>({ 
    maxEntries: 50_000,
    enableEvents: false
  });
  
  for (let i = 0; i < 100_000; i++) {
    if (i % 3 === 0) {
      cache.set(`key${i}`, { id: i });
    } else if (i % 3 === 1) {
      cache.get(`key${i % 10000}`);
    } else {
      cache.has(`key${i % 10000}`);
    }
  }
});

console.log("\n--- CURRENT: Events ENABLED (no listeners) ---\n");

let currentSet = 0;
let currentGet = 0;
let currentMixed = 0;

// Benchmark 1: Set operations with events enabled but no listeners
currentSet = runBenchmark("Set 100k entries (events enabled)", () => {
  const cache = new LruTtlCache<string, any>({ 
    maxEntries: 100_000,
    enableEvents: true
  });
  
  for (let i = 0; i < 100_000; i++) {
    cache.set(`key${i}`, { id: i, value: `data_${i}` });
  }
});

// Benchmark 2: Get operations with events enabled but no listeners
currentGet = runBenchmark("Get 100k entries (events enabled)", () => {
  const cache = new LruTtlCache<string, any>({ 
    maxEntries: 100_000,
    enableEvents: true
  });
  
  for (let i = 0; i < 100_000; i++) {
    cache.set(`key${i}`, { id: i });
  }
  
  for (let i = 0; i < 100_000; i++) {
    cache.get(`key${i}`);
  }
});

// Benchmark 3: Mixed operations with events enabled but no listeners
currentMixed = runBenchmark("Mixed 100k ops (events enabled)", () => {
  const cache = new LruTtlCache<string, any>({ 
    maxEntries: 50_000,
    enableEvents: true
  });
  
  for (let i = 0; i < 100_000; i++) {
    if (i % 3 === 0) {
      cache.set(`key${i}`, { id: i });
    } else if (i % 3 === 1) {
      cache.get(`key${i % 10000}`);
    } else {
      cache.has(`key${i % 10000}`);
    }
  }
});

console.log("\n--- CURRENT: Events ENABLED (with 1 listener) ---\n");

let listener1Set = 0;
let listener1Get = 0;
let listener1Mixed = 0;

// Benchmark with 1 listener
listener1Set = runBenchmark("Set 100k entries (1 listener)", () => {
  const cache = new LruTtlCache<string, any>({ 
    maxEntries: 100_000,
    enableEvents: true
  });
  
  let count = 0;
  cache.on("set", () => { count++; });
  
  for (let i = 0; i < 100_000; i++) {
    cache.set(`key${i}`, { id: i, value: `data_${i}` });
  }
});

listener1Get = runBenchmark("Get 100k entries (1 listener)", () => {
  const cache = new LruTtlCache<string, any>({ 
    maxEntries: 100_000,
    enableEvents: true
  });
  
  let count = 0;
  cache.on("hit", () => { count++; });
  
  for (let i = 0; i < 100_000; i++) {
    cache.set(`key${i}`, { id: i });
  }
  
  for (let i = 0; i < 100_000; i++) {
    cache.get(`key${i}`);
  }
});

listener1Mixed = runBenchmark("Mixed 100k ops (1 listener)", () => {
  const cache = new LruTtlCache<string, any>({ 
    maxEntries: 50_000,
    enableEvents: true
  });
  
  let count = 0;
  cache.on("*", () => { count++; });
  
  for (let i = 0; i < 100_000; i++) {
    if (i % 3 === 0) {
      cache.set(`key${i}`, { id: i });
    } else if (i % 3 === 1) {
      cache.get(`key${i % 10000}`);
    } else {
      cache.has(`key${i % 10000}`);
    }
  }
});

console.log("\n--- CURRENT: Events ENABLED (with 5 listeners) ---\n");

let listener5Set = 0;
let listener5Get = 0;
let listener5Mixed = 0;

// Benchmark with 5 listeners
listener5Set = runBenchmark("Set 100k entries (5 listeners)", () => {
  const cache = new LruTtlCache<string, any>({ 
    maxEntries: 100_000,
    enableEvents: true
  });
  
  let count = 0;
  for (let i = 0; i < 5; i++) {
    cache.on("set", () => { count++; });
  }
  
  for (let i = 0; i < 100_000; i++) {
    cache.set(`key${i}`, { id: i, value: `data_${i}` });
  }
});

listener5Get = runBenchmark("Get 100k entries (5 listeners)", () => {
  const cache = new LruTtlCache<string, any>({ 
    maxEntries: 100_000,
    enableEvents: true
  });
  
  let count = 0;
  for (let i = 0; i < 5; i++) {
    cache.on("hit", () => { count++; });
  }
  
  for (let i = 0; i < 100_000; i++) {
    cache.set(`key${i}`, { id: i });
  }
  
  for (let i = 0; i < 100_000; i++) {
    cache.get(`key${i}`);
  }
});

listener5Mixed = runBenchmark("Mixed 100k ops (5 listeners)", () => {
  const cache = new LruTtlCache<string, any>({ 
    maxEntries: 50_000,
    enableEvents: true
  });
  
  let count = 0;
  for (let i = 0; i < 5; i++) {
    cache.on("*", () => { count++; });
  }
  
  for (let i = 0; i < 100_000; i++) {
    if (i % 3 === 0) {
      cache.set(`key${i}`, { id: i });
    } else if (i % 3 === 1) {
      cache.get(`key${i % 10000}`);
    } else {
      cache.has(`key${i % 10000}`);
    }
  }
});

// Calculate overhead
console.log("\n=== Performance Summary ===\n");

console.log("📊 Set Operations (100k):");
console.log(`   No events (baseline):       ${baselineSet.toFixed(2)}ms`);
console.log(`   Events enabled (no listeners): ${currentSet.toFixed(2)}ms (${((currentSet / baselineSet - 1) * 100).toFixed(1)}% overhead)`);
console.log(`   Events + 1 listener:        ${listener1Set.toFixed(2)}ms (${((listener1Set / baselineSet - 1) * 100).toFixed(1)}% overhead)`);
console.log(`   Events + 5 listeners:       ${listener5Set.toFixed(2)}ms (${((listener5Set / baselineSet - 1) * 100).toFixed(1)}% overhead)`);

console.log(`\n📊 Get Operations (100k):`);
console.log(`   No events (baseline):       ${baselineGet.toFixed(2)}ms`);
console.log(`   Events enabled (no listeners): ${currentGet.toFixed(2)}ms (${((currentGet / baselineGet - 1) * 100).toFixed(1)}% overhead)`);
console.log(`   Events + 1 listener:        ${listener1Get.toFixed(2)}ms (${((listener1Get / baselineGet - 1) * 100).toFixed(1)}% overhead)`);
console.log(`   Events + 5 listeners:       ${listener5Get.toFixed(2)}ms (${((listener5Get / baselineGet - 1) * 100).toFixed(1)}% overhead)`);

console.log(`\n📊 Mixed Operations (100k):`);
console.log(`   No events (baseline):       ${baselineMixed.toFixed(2)}ms`);
console.log(`   Events enabled (no listeners): ${currentMixed.toFixed(2)}ms (${((currentMixed / baselineMixed - 1) * 100).toFixed(1)}% overhead)`);
console.log(`   Events + 1 listener:        ${listener1Mixed.toFixed(2)}ms (${((listener1Mixed / baselineMixed - 1) * 100).toFixed(1)}% overhead)`);
console.log(`   Events + 5 listeners:       ${listener5Mixed.toFixed(2)}ms (${((listener5Mixed / baselineMixed - 1) * 100).toFixed(1)}% overhead)`);

console.log("\n🎯 Key Findings:");
const avgOverheadNoListeners = ((currentSet / baselineSet + currentGet / baselineGet + currentMixed / baselineMixed) / 3 - 1) * 100;
const avgOverhead1Listener = ((listener1Set / baselineSet + listener1Get / baselineGet + listener1Mixed / baselineMixed) / 3 - 1) * 100;
const avgOverhead5Listeners = ((listener5Set / baselineSet + listener5Get / baselineGet + listener5Mixed / baselineMixed) / 3 - 1) * 100;

console.log(`   • Events enabled (no listeners): ${avgOverheadNoListeners.toFixed(1)}% overhead`);
console.log(`   • Events + 1 listener:           ${avgOverhead1Listener.toFixed(1)}% overhead`);
console.log(`   • Events + 5 listeners:          ${avgOverhead5Listeners.toFixed(1)}% overhead`);

if (avgOverheadNoListeners > 10) {
  console.log("\n⚠️  Significant overhead detected even with NO listeners!");
  console.log("   Optimization opportunity: Skip event object creation when no listeners");
} else {
  console.log("\n✅ Event system has minimal overhead when no listeners attached");
}

console.log("\n=== Benchmark Complete ===\n");
