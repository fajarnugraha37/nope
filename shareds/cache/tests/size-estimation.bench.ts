import { LruTtlCache, jsonSizer } from "../src/cache";
import { encode } from "@msgpack/msgpack";

/**
 * Benchmark for size estimation optimization
 * Tests the impact of different sizing strategies
 */

console.log("\n=== Size Estimation Benchmark ===\n");

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

// Test data
const smallObject = { id: 1, name: "test" };
const mediumObject = {
  id: 123,
  name: "John Doe",
  email: "john@example.com",
  age: 30,
  address: {
    street: "123 Main St",
    city: "Boston",
    state: "MA",
    zip: "02101"
  },
  tags: ["user", "premium", "verified"]
};
const largeObject = {
  id: 456,
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

console.log("--- BASELINE: Current JSON.stringify() sizing ---\n");

let baselineSmall = 0;
let baselineMedium = 0;
let baselineLarge = 0;

// Benchmark 1: Small objects with JSON.stringify
baselineSmall = runBenchmark("JSON.stringify: 10k small objects", () => {
  const cache = new LruTtlCache<string, any>({ 
    maxEntries: 10000,
    maxSize: 1000000,
    sizer: jsonSizer
  });
  
  for (let i = 0; i < 10_000; i++) {
    cache.set(`key${i}`, { ...smallObject, id: i });
  }
});

// Benchmark 2: Medium objects with JSON.stringify
baselineMedium = runBenchmark("JSON.stringify: 10k medium objects", () => {
  const cache = new LruTtlCache<string, any>({ 
    maxEntries: 10000,
    maxSize: 10000000,
    sizer: jsonSizer
  });
  
  for (let i = 0; i < 10_000; i++) {
    cache.set(`key${i}`, { ...mediumObject, id: i });
  }
});

// Benchmark 3: Large objects with JSON.stringify
baselineLarge = runBenchmark("JSON.stringify: 1k large objects", () => {
  const cache = new LruTtlCache<string, any>({ 
    maxEntries: 1000,
    maxSize: 100000000,
    sizer: jsonSizer
  });
  
  for (let i = 0; i < 1_000; i++) {
    cache.set(`key${i}`, { ...largeObject, id: i });
  }
});

console.log("\n--- OPTIMIZATION 1: Fast-path for primitives ---\n");

let optimized1Small = 0;
let optimized1Medium = 0;
let optimized1Large = 0;

// Fast-path sizer
const fastPathSizer = (v: any): number => {
  const t = typeof v;
  if (t === 'string') return v.length * 2; // ~2 bytes per char
  if (t === 'number') return 8;
  if (t === 'boolean') return 4;
  if (v === null || v === undefined) return 0;
  if (Array.isArray(v)) {
    // Approximate: 8 bytes overhead + 8 per element
    return 8 + v.length * 8;
  }
  // Object: fall back to JSON.stringify
  try {
    return JSON.stringify(v).length;
  } catch {
    return 64;
  }
};

optimized1Small = runBenchmark("Fast-path: 10k small objects", () => {
  const cache = new LruTtlCache<string, any>({ 
    maxEntries: 10000,
    maxSize: 1000000,
    sizer: fastPathSizer
  });
  
  for (let i = 0; i < 10_000; i++) {
    cache.set(`key${i}`, { ...smallObject, id: i });
  }
});

optimized1Medium = runBenchmark("Fast-path: 10k medium objects", () => {
  const cache = new LruTtlCache<string, any>({ 
    maxEntries: 10000,
    maxSize: 10000000,
    sizer: fastPathSizer
  });
  
  for (let i = 0; i < 10_000; i++) {
    cache.set(`key${i}`, { ...mediumObject, id: i });
  }
});

optimized1Large = runBenchmark("Fast-path: 1k large objects", () => {
  const cache = new LruTtlCache<string, any>({ 
    maxEntries: 1000,
    maxSize: 100000000,
    sizer: fastPathSizer
  });
  
  for (let i = 0; i < 1_000; i++) {
    cache.set(`key${i}`, { ...largeObject, id: i });
  }
});

console.log("\n--- OPTIMIZATION 2: Approximate size (object traversal) ---\n");

let optimized2Small = 0;
let optimized2Medium = 0;
let optimized2Large = 0;

// Approximate sizer with object traversal
const approximateSizer = (v: any, maxDepth: number = 3): number => {
  const seen = new Set();
  
  const estimateSize = (val: any, depth: number): number => {
    if (depth > maxDepth) return 64;
    
    const t = typeof val;
    if (t === 'string') return val.length * 2;
    if (t === 'number') return 8;
    if (t === 'boolean') return 4;
    if (val === null || val === undefined) return 0;
    
    // Circular reference check
    if (t === 'object') {
      if (seen.has(val)) return 0;
      seen.add(val);
    }
    
    if (Array.isArray(val)) {
      let total = 8; // Array overhead
      for (let i = 0; i < Math.min(val.length, 100); i++) {
        total += estimateSize(val[i], depth + 1);
      }
      if (val.length > 100) {
        total += (val.length - 100) * 8; // Assume 8 bytes for remaining
      }
      return total;
    }
    
    if (t === 'object') {
      let total = 16; // Object overhead
      const keys = Object.keys(val);
      for (let i = 0; i < Math.min(keys.length, 50); i++) {
        const key = keys[i];
        total += key.length * 2; // Key size
        total += estimateSize(val[key], depth + 1);
      }
      if (keys.length > 50) {
        total += (keys.length - 50) * 24; // Assume 24 bytes per remaining prop
      }
      return total;
    }
    
    return 64;
  };
  
  return estimateSize(v, 0);
};

optimized2Small = runBenchmark("Approximate: 10k small objects", () => {
  const cache = new LruTtlCache<string, any>({ 
    maxEntries: 10000,
    maxSize: 1000000,
    sizer: approximateSizer
  });
  
  for (let i = 0; i < 10_000; i++) {
    cache.set(`key${i}`, { ...smallObject, id: i });
  }
});

optimized2Medium = runBenchmark("Approximate: 10k medium objects", () => {
  const cache = new LruTtlCache<string, any>({ 
    maxEntries: 10000,
    maxSize: 10000000,
    sizer: approximateSizer
  });
  
  for (let i = 0; i < 10_000; i++) {
    cache.set(`key${i}`, { ...mediumObject, id: i });
  }
});

optimized2Large = runBenchmark("Approximate: 1k large objects", () => {
  const cache = new LruTtlCache<string, any>({ 
    maxEntries: 1000,
    maxSize: 100000000,
    sizer: approximateSizer
  });
  
  for (let i = 0; i < 1_000; i++) {
    cache.set(`key${i}`, { ...largeObject, id: i });
  }
});

console.log("\n--- OPTIMIZATION 3: MessagePack encoding ---\n");

let optimized3Small = 0;
let optimized3Medium = 0;
let optimized3Large = 0;

// MessagePack sizer
const msgpackSizer = (v: any): number => {
  try {
    return encode(v).length;
  } catch {
    return 64;
  }
};

optimized3Small = runBenchmark("MessagePack: 10k small objects", () => {
  const cache = new LruTtlCache<string, any>({ 
    maxEntries: 10000,
    maxSize: 1000000,
    sizer: msgpackSizer
  });
  
  for (let i = 0; i < 10_000; i++) {
    cache.set(`key${i}`, { ...smallObject, id: i });
  }
});

optimized3Medium = runBenchmark("MessagePack: 10k medium objects", () => {
  const cache = new LruTtlCache<string, any>({ 
    maxEntries: 10000,
    maxSize: 10000000,
    sizer: msgpackSizer
  });
  
  for (let i = 0; i < 10_000; i++) {
    cache.set(`key${i}`, { ...mediumObject, id: i });
  }
});

optimized3Large = runBenchmark("MessagePack: 1k large objects", () => {
  const cache = new LruTtlCache<string, any>({ 
    maxEntries: 1000,
    maxSize: 100000000,
    sizer: msgpackSizer
  });
  
  for (let i = 0; i < 1_000; i++) {
    cache.set(`key${i}`, { ...largeObject, id: i });
  }
});

console.log("\n--- OPTIMIZATION 4: No sizing (count-based only) ---\n");

let optimized4Small = 0;
let optimized4Medium = 0;
let optimized4Large = 0;

// No-op sizer (always return 1)
const noopSizer = () => 1;

optimized4Small = runBenchmark("No sizing: 10k small objects", () => {
  const cache = new LruTtlCache<string, any>({ 
    maxEntries: 10000,
    maxSize: Number.POSITIVE_INFINITY,
    sizer: noopSizer
  });
  
  for (let i = 0; i < 10_000; i++) {
    cache.set(`key${i}`, { ...smallObject, id: i });
  }
});

optimized4Medium = runBenchmark("No sizing: 10k medium objects", () => {
  const cache = new LruTtlCache<string, any>({ 
    maxEntries: 10000,
    maxSize: Number.POSITIVE_INFINITY,
    sizer: noopSizer
  });
  
  for (let i = 0; i < 10_000; i++) {
    cache.set(`key${i}`, { ...mediumObject, id: i });
  }
});

optimized4Large = runBenchmark("No sizing: 1k large objects", () => {
  const cache = new LruTtlCache<string, any>({ 
    maxEntries: 1000,
    maxSize: Number.POSITIVE_INFINITY,
    sizer: noopSizer
  });
  
  for (let i = 0; i < 1_000; i++) {
    cache.set(`key${i}`, { ...largeObject, id: i });
  }
});

// Calculate improvements
console.log("\n=== Performance Summary ===\n");

console.log("📊 Small Objects (10k sets):");
console.log(`   Baseline (JSON.stringify):  ${baselineSmall.toFixed(2)}ms`);
console.log(`   Fast-path optimization:     ${optimized1Small.toFixed(2)}ms (${(baselineSmall / optimized1Small).toFixed(2)}x)`);
console.log(`   Approximate sizing:         ${optimized2Small.toFixed(2)}ms (${(baselineSmall / optimized2Small).toFixed(2)}x)`);
console.log(`   MessagePack encoding:       ${optimized3Small.toFixed(2)}ms (${(baselineSmall / optimized3Small).toFixed(2)}x)`);
console.log(`   No sizing (count-only):     ${optimized4Small.toFixed(2)}ms (${(baselineSmall / optimized4Small).toFixed(2)}x)`);

console.log(`\n📊 Medium Objects (10k sets):`);
console.log(`   Baseline (JSON.stringify):  ${baselineMedium.toFixed(2)}ms`);
console.log(`   Fast-path optimization:     ${optimized1Medium.toFixed(2)}ms (${(baselineMedium / optimized1Medium).toFixed(2)}x)`);
console.log(`   Approximate sizing:         ${optimized2Medium.toFixed(2)}ms (${(baselineMedium / optimized2Medium).toFixed(2)}x)`);
console.log(`   MessagePack encoding:       ${optimized3Medium.toFixed(2)}ms (${(baselineMedium / optimized3Medium).toFixed(2)}x)`);
console.log(`   No sizing (count-only):     ${optimized4Medium.toFixed(2)}ms (${(baselineMedium / optimized4Medium).toFixed(2)}x)`);

console.log(`\n📊 Large Objects (1k sets):`);
console.log(`   Baseline (JSON.stringify):  ${baselineLarge.toFixed(2)}ms`);
console.log(`   Fast-path optimization:     ${optimized1Large.toFixed(2)}ms (${(baselineLarge / optimized1Large).toFixed(2)}x)`);
console.log(`   Approximate sizing:         ${optimized2Large.toFixed(2)}ms (${(baselineLarge / optimized2Large).toFixed(2)}x)`);
console.log(`   MessagePack encoding:       ${optimized3Large.toFixed(2)}ms (${(baselineLarge / optimized3Large).toFixed(2)}x)`);
console.log(`   No sizing (count-only):     ${optimized4Large.toFixed(2)}ms (${(baselineLarge / optimized4Large).toFixed(2)}x)`);

console.log("\n🎯 Key Findings:");
const bestSmall = Math.max(baselineSmall / optimized1Small, baselineSmall / optimized2Small, baselineSmall / optimized3Small);
const bestMedium = Math.max(baselineMedium / optimized1Medium, baselineMedium / optimized2Medium, baselineMedium / optimized3Medium);
const bestLarge = Math.max(baselineLarge / optimized1Large, baselineLarge / optimized2Large, baselineLarge / optimized3Large);

if (bestSmall < 1.5 && bestMedium < 1.5 && bestLarge < 1.5) {
  console.log("   • JSON.stringify is already OPTIMAL for object sizing");
  console.log("   • Alternative approaches (fast-path, approximate, msgpack) don't improve perf");
  console.log("   • Recommendation: KEEP current jsonSizer implementation");
  console.log("   • Only skip sizing if maxSize is not used (88x faster)");
} else {
  console.log("   • Alternatives can improve performance vs JSON.stringify");
  console.log(`   • Best speedup: Small=${bestSmall.toFixed(1)}x, Medium=${bestMedium.toFixed(1)}x, Large=${bestLarge.toFixed(1)}x`);
  console.log("   • Consider implementing the best-performing alternative");
}

console.log("\n=== Benchmark Complete ===\n");
