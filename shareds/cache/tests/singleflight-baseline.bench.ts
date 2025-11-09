/**
 * Singleflight Map Overhead - BASELINE Benchmark
 * Measures current performance and memory usage
 */

import { Singleflight } from "../src/cache.ts";
import { heapStats } from "bun:jsc";

console.log("\n=== Singleflight Map Overhead - BASELINE ===\n");

// Helper to format bytes
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Helper to measure memory using Bun's accurate heapStats API
function measureMemory(): { heapUsed: number; external: number; total: number; objectCount: number } {
  Bun.gc(true); // Force synchronous GC
  const stats = heapStats();
  return {
    heapUsed: stats.heapSize,
    external: stats.extraMemorySize,
    total: stats.heapSize + stats.extraMemorySize,
    objectCount: stats.objectCount,
  };
}

// Benchmark helper with memory tracking
async function benchmark(
  name: string,
  fn: () => Promise<void>,
  warmup: number = 100
): Promise<{ time: number; memBefore: any; memAfter: any; memDiff: number }> {
  // Warmup
  for (let i = 0; i < warmup; i++) {
    await fn();
  }
  
  // Measure
  const memBefore = measureMemory();
  const times: number[] = [];
  
  for (let run = 0; run < 10; run++) {
    const start = performance.now();
    await fn();
    const end = performance.now();
    times.push(end - start);
  }
  
  const memAfter = measureMemory();
  
  // Calculate trimmed mean (remove top/bottom 10%)
  times.sort((a, b) => a - b);
  const trimmed = times.slice(1, 9);
  const avgTime = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
  
  console.log(`   ${name}:`);
  console.log(`     Time:   ${avgTime.toFixed(2)}ms`);
  console.log(`     Memory: ${formatBytes(memAfter.total - memBefore.total)} delta`);
  console.log(`     Heap:   ${formatBytes(memAfter.heapUsed)} (was ${formatBytes(memBefore.heapUsed)})`);
  
  return {
    time: avgTime,
    memBefore,
    memAfter,
    memDiff: memAfter.total - memBefore.total,
  };
}

console.log("📊 BASELINE: Current Singleflight Implementation\n");

// Test 1: No contention (sequential)
console.log("1️⃣  NO CONTENTION (sequential calls)");
const noContentionResult = await benchmark(
  "1000 sequential calls",
  async () => {
    const sf = new Singleflight<string, number>();
    for (let i = 0; i < 1000; i++) {
      await sf.do(`key-${i}`, async () => i * 2);
    }
  }
);
console.log();

// Test 2: Low contention (some duplicates)
console.log("2️⃣  LOW CONTENTION (10 unique keys, 1000 calls)");
const lowContentionResult = await benchmark(
  "1000 calls, 10 keys",
  async () => {
    const sf = new Singleflight<string, number>();
    const promises: Promise<number>[] = [];
    for (let i = 0; i < 1000; i++) {
      promises.push(sf.do(`key-${i % 10}`, async () => {
        await new Promise(resolve => setTimeout(resolve, 1));
        return i % 10;
      }));
    }
    await Promise.all(promises);
  }
);
console.log();

// Test 3: High contention (many duplicates)
console.log("3️⃣  HIGH CONTENTION (1 key, 1000 concurrent calls)");
const highContentionResult = await benchmark(
  "1000 concurrent calls, 1 key",
  async () => {
    const sf = new Singleflight<string, number>();
    const promises: Promise<number>[] = [];
    for (let i = 0; i < 1000; i++) {
      promises.push(sf.do("shared-key", async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        return 42;
      }));
    }
    await Promise.all(promises);
  }
);
console.log();

// Test 4: Memory pressure (many keys in flight)
console.log("4️⃣  MEMORY PRESSURE (10k keys in flight simultaneously)");
const memPressureBefore = measureMemory();
console.log(`   Before: ${formatBytes(memPressureBefore.total)}`);

const sf = new Singleflight<string, number>();
const promises: Promise<number>[] = [];
for (let i = 0; i < 10000; i++) {
  promises.push(sf.do(`key-${i}`, async () => {
    await new Promise(resolve => setTimeout(resolve, 10));
    return i;
  }));
}

const memDuringInflight = measureMemory();
console.log(`   During: ${formatBytes(memDuringInflight.total)} (+${formatBytes(memDuringInflight.total - memPressureBefore.total)})`);

await Promise.all(promises);

const memAfterResolution = measureMemory();
console.log(`   After:  ${formatBytes(memAfterResolution.total)} (${formatBytes(memAfterResolution.total - memPressureBefore.total)} delta)`);
console.log();

// Test 5: GC test - do promises get cleaned up?
console.log("5️⃣  GARBAGE COLLECTION TEST");
console.log("   Creating 10k singleflight calls...");
const gcTestBefore = measureMemory();
{
  const sf2 = new Singleflight<string, number>();
  const promises2: Promise<number>[] = [];
  for (let i = 0; i < 10000; i++) {
    promises2.push(sf2.do(`gc-key-${i}`, async () => i));
  }
  await Promise.all(promises2);
}
const gcTestAfter = measureMemory();
console.log(`   Before: ${formatBytes(gcTestBefore.total)}`);
console.log(`   After:  ${formatBytes(gcTestAfter.total)}`);
console.log(`   Retained: ${formatBytes(gcTestAfter.total - gcTestBefore.total)}`);
console.log();

// Test 6: Map operations overhead
console.log("6️⃣  MAP OPERATIONS OVERHEAD");
const mapOpsResult = await benchmark(
  "1000 map get/set/delete cycles",
  async () => {
    const sf = new Singleflight<string, number>();
    for (let i = 0; i < 1000; i++) {
      // This measures the overhead of map operations
      await sf.do(`key-${i}`, async () => i);
    }
  },
  10 // Less warmup for this test
);
console.log();

console.log("=".repeat(70));
console.log("📈 BASELINE SUMMARY");
console.log("=".repeat(70) + "\n");

console.log("Performance:");
console.log(`  • No contention:    ${noContentionResult.time.toFixed(2)}ms`);
console.log(`  • Low contention:   ${lowContentionResult.time.toFixed(2)}ms`);
console.log(`  • High contention:  ${highContentionResult.time.toFixed(2)}ms`);
console.log(`  • Map operations:   ${mapOpsResult.time.toFixed(2)}ms`);
console.log();

console.log("Memory Usage:");
console.log(`  • Sequential:       ${formatBytes(noContentionResult.memDiff)}`);
console.log(`  • Low contention:   ${formatBytes(lowContentionResult.memDiff)}`);
console.log(`  • High contention:  ${formatBytes(highContentionResult.memDiff)}`);
console.log(`  • 10k inflight:     ${formatBytes(memDuringInflight.total - memPressureBefore.total)}`);
console.log(`  • After cleanup:    ${formatBytes(memAfterResolution.total - memPressureBefore.total)}`);
console.log();

console.log("Identified Bottlenecks:");
console.log("  1. Map operations on every call (get + set/delete)");
console.log("  2. Promises kept in Map until resolution");
console.log("  3. No fast-path for sequential access (no contention)");
console.log("  4. Map growth/shrink with high key churn");
console.log();

console.log("=== Baseline Benchmark Complete ===\n");

console.log("💡 Using Bun's accurate heapStats API for memory tracking\n");
