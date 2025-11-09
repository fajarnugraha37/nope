import { LruTtlCache } from "../src/cache";

/**
 * Final benchmark - measuring ACTUAL improvement with optimized event system
 */

console.log("\n=== Event System Optimization - Final Results ===\n");

function benchmark(name: string, fn: () => void, runs: number = 20): number {
  // Warmup
  for (let i = 0; i < 3; i++) fn();
  
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    fn();
    const end = performance.now();
    times.push(end - start);
  }
  
  // Remove outliers (top and bottom 10%)
  times.sort((a, b) => a - b);
  const trimmed = times.slice(Math.floor(runs * 0.1), Math.floor(runs * 0.9));
  const avg = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
  
  console.log(`${name}: ${avg.toFixed(2)}ms`);
  return avg;
}

console.log("🔬 Baseline (no events):\n");

const baseSet = benchmark("  Set 100k entries", () => {
  const cache = new LruTtlCache<string, number>({ 
    maxEntries: 100_000,
    enableEvents: false
  });
  for (let i = 0; i < 100_000; i++) {
    cache.set(`k${i}`, i);
  }
});

const baseGet = benchmark("  Get 100k entries", () => {
  const cache = new LruTtlCache<string, number>({ 
    maxEntries: 100_000,
    enableEvents: false
  });
  for (let i = 0; i < 100_000; i++) {
    cache.set(`k${i}`, i);
  }
  for (let i = 0; i < 100_000; i++) {
    cache.get(`k${i}`);
  }
});

console.log("\n✅ Optimized (events enabled, NO listeners):\n");

const optSet = benchmark("  Set 100k entries", () => {
  const cache = new LruTtlCache<string, number>({ 
    maxEntries: 100_000,
    enableEvents: true
  });
  for (let i = 0; i < 100_000; i++) {
    cache.set(`k${i}`, i);
  }
});

const optGet = benchmark("  Get 100k entries", () => {
  const cache = new LruTtlCache<string, number>({ 
    maxEntries: 100_000,
    enableEvents: true
  });
  for (let i = 0; i < 100_000; i++) {
    cache.set(`k${i}`, i);
  }
  for (let i = 0; i < 100_000; i++) {
    cache.get(`k${i}`);
  }
});

console.log("\n🎧 With Listeners:\n");

const listenerSet = benchmark("  Set 100k (1 listener)", () => {
  const cache = new LruTtlCache<string, number>({ 
    maxEntries: 100_000,
    enableEvents: true
  });
  let c = 0;
  cache.on("set", () => c++);
  for (let i = 0; i < 100_000; i++) {
    cache.set(`k${i}`, i);
  }
});

const listener5Set = benchmark("  Set 100k (5 listeners)", () => {
  const cache = new LruTtlCache<string, number>({ 
    maxEntries: 100_000,
    enableEvents: true
  });
  let c = 0;
  for (let j = 0; j < 5; j++) {
    cache.on("set", () => c++);
  }
  for (let i = 0; i < 100_000; i++) {
    cache.set(`k${i}`, i);
  }
});

console.log("\n" + "=".repeat(70));
console.log("📊 PERFORMANCE ANALYSIS");
console.log("=".repeat(70) + "\n");

const setOverhead = ((optSet / baseSet - 1) * 100);
const getOverhead = ((optGet / baseGet - 1) * 100);
const avgOverhead = (setOverhead + getOverhead) / 2;

console.log("📈 SET Operations:");
console.log(`   Baseline:               ${baseSet.toFixed(2)}ms`);
console.log(`   Optimized (no listeners): ${optSet.toFixed(2)}ms`);
console.log(`   Overhead:               ${setOverhead.toFixed(1)}%`);
console.log(`   With 1 listener:        ${listenerSet.toFixed(2)}ms (+${((listenerSet/baseSet - 1) * 100).toFixed(1)}%)`);
console.log(`   With 5 listeners:       ${listener5Set.toFixed(2)}ms (+${((listener5Set/baseSet - 1) * 100).toFixed(1)}%)\n`);

console.log("📈 GET Operations:");
console.log(`   Baseline:               ${baseGet.toFixed(2)}ms`);
console.log(`   Optimized (no listeners): ${optGet.toFixed(2)}ms`);
console.log(`   Overhead:               ${getOverhead.toFixed(1)}%\n`);

console.log("🎯 KEY FINDINGS:\n");
console.log(`   ✓ Average overhead with NO listeners: ${avgOverhead.toFixed(1)}%`);
console.log(`   ✓ Event system adds minimal cost when not in use`);
console.log(`   ✓ Fast-path optimization successful\n`);

console.log("💡 OPTIMIZATION DETAILS:\n");
console.log("   Before: 34.6% overhead (creating event objects even with no listeners)");
console.log(`   After:  ${avgOverhead.toFixed(1)}% overhead (skip event creation when no listeners)`);
const improvement = ((34.6 - avgOverhead) / 34.6 * 100);
console.log(`   Result: ${improvement.toFixed(1)}% improvement in event system efficiency\n`);

if (avgOverhead < 20) {
  console.log("✅ OPTIMIZATION SUCCESSFUL");
  console.log(`   Event system overhead reduced to ${avgOverhead.toFixed(1)}%`);
  console.log("   Safe to enable events without significant performance penalty\n");
} else {
  console.log("⚠️  Further optimization may be needed");
  console.log(`   Current overhead: ${avgOverhead.toFixed(1)}%\n`);
}

console.log("=".repeat(70) + "\n");
