/**
 * Optimization #11: Batch Operations - BASELINE
 * 
 * Measures current performance of batch operations using withBatchOperations wrapper.
 * This wrapper calls individual operations in a loop, with per-item overhead for:
 * - Event emission (per operation)
 * - Statistics updates (per operation)
 * - Validation and checks (per operation)
 * - Map lookups and updates (per operation)
 * 
 * Run with: bun run tests/batch-operations-baseline.bench.ts
 */

import { OptimizedLruTtlCache } from "../src/cache-optimized";
import { withBatchOperations } from "../src/cache-utils";
import { heapStats } from "bun:jsc";

console.log("=== Optimization #11: Batch Operations - BASELINE ===\n");

interface MemoryStats {
  heapSize: number;
  objectCount: number;
  heapCapacity: number;
}

function measureMemory(): MemoryStats {
  Bun.gc(true);
  const stats = heapStats();
  return {
    heapSize: stats.heapSize,
    objectCount: stats.objectCount,
    heapCapacity: stats.heapCapacity,
  };
}

function formatBytes(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(2) + " MB";
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}

// Test configurations
const BATCH_SIZES = [100, 500, 1000, 5000];
const CACHE_SIZE = 10_000;

console.log("Test Configuration:");
console.log(`  Batch sizes: ${BATCH_SIZES.join(", ")}`);
console.log(`  Cache capacity: ${formatNumber(CACHE_SIZE)}`);
console.log(`  Runtime: Bun ${Bun.version}\n`);

// Scenario 1: setMany with no stats, no events
console.log("--- Scenario 1: setMany (no stats, no events) ---");
for (const batchSize of BATCH_SIZES) {
  const cache = new OptimizedLruTtlCache<string, number>({ maxEntries: CACHE_SIZE });
  const batchCache = withBatchOperations(cache);
  
  const entries: Array<[string, number]> = Array.from(
    { length: batchSize },
    (_, i) => [`key${i}`, i]
  );
  
  const memBefore = measureMemory();
  const start = performance.now();
  
  batchCache.setMany(entries);
  
  const elapsed = performance.now() - start;
  const memAfter = measureMemory();
  
  const throughput = (batchSize / elapsed) * 1000;
  const memDelta = memAfter.heapSize - memBefore.heapSize;
  const objDelta = memAfter.objectCount - memBefore.objectCount;
  
  console.log(`  ${formatNumber(batchSize)} entries:`);
  console.log(`    Time: ${elapsed.toFixed(2)}ms`);
  console.log(`    Throughput: ${formatNumber(Math.floor(throughput))} ops/sec`);
  console.log(`    Memory: ${formatBytes(memDelta)}`);
  console.log(`    Objects: ${formatNumber(objDelta)}`);
}

// Scenario 2: setMany with stats enabled
console.log("\n--- Scenario 2: setMany (with stats) ---");
for (const batchSize of BATCH_SIZES) {
  const cache = new OptimizedLruTtlCache<string, number>({ 
    maxEntries: CACHE_SIZE,
    enableStats: true 
  });
  const batchCache = withBatchOperations(cache);
  
  const entries: Array<[string, number]> = Array.from(
    { length: batchSize },
    (_, i) => [`key${i}`, i]
  );
  
  const memBefore = measureMemory();
  const start = performance.now();
  
  batchCache.setMany(entries);
  
  const elapsed = performance.now() - start;
  const memAfter = measureMemory();
  
  const throughput = (batchSize / elapsed) * 1000;
  const memDelta = memAfter.heapSize - memBefore.heapSize;
  const objDelta = memAfter.objectCount - memBefore.objectCount;
  
  console.log(`  ${formatNumber(batchSize)} entries:`);
  console.log(`    Time: ${elapsed.toFixed(2)}ms`);
  console.log(`    Throughput: ${formatNumber(Math.floor(throughput))} ops/sec`);
  console.log(`    Memory: ${formatBytes(memDelta)}`);
  console.log(`    Objects: ${formatNumber(objDelta)}`);
  console.log(`    Stats overhead: ${((elapsed / batchSize) * 1000).toFixed(2)}µs per op`);
}

// Scenario 3: setMany with events enabled
console.log("\n--- Scenario 3: setMany (with events) ---");
for (const batchSize of BATCH_SIZES) {
  const cache = new OptimizedLruTtlCache<string, number>({ 
    maxEntries: CACHE_SIZE,
    enableEvents: true 
  });
  const batchCache = withBatchOperations(cache);
  
  let eventCount = 0;
  const events = cache.getEvents();
  if (events) {
    events.on("set", () => { eventCount++; });
  }
  
  const entries: Array<[string, number]> = Array.from(
    { length: batchSize },
    (_, i) => [`key${i}`, i]
  );
  
  const memBefore = measureMemory();
  const start = performance.now();
  
  batchCache.setMany(entries);
  
  const elapsed = performance.now() - start;
  const memAfter = measureMemory();
  
  const throughput = (batchSize / elapsed) * 1000;
  const memDelta = memAfter.heapSize - memBefore.heapSize;
  const objDelta = memAfter.objectCount - memBefore.objectCount;
  
  console.log(`  ${formatNumber(batchSize)} entries:`);
  console.log(`    Time: ${elapsed.toFixed(2)}ms`);
  console.log(`    Throughput: ${formatNumber(Math.floor(throughput))} ops/sec`);
  console.log(`    Memory: ${formatBytes(memDelta)}`);
  console.log(`    Objects: ${formatNumber(objDelta)}`);
  console.log(`    Events emitted: ${formatNumber(eventCount)}`);
  console.log(`    Event overhead: ${((elapsed / batchSize) * 1000).toFixed(2)}µs per op`);
}

// Scenario 4: getMany (all hits)
console.log("\n--- Scenario 4: getMany (all hits) ---");
for (const batchSize of BATCH_SIZES) {
  const cache = new OptimizedLruTtlCache<string, number>({ maxEntries: CACHE_SIZE });
  const batchCache = withBatchOperations(cache);
  
  // Pre-populate cache
  for (let i = 0; i < batchSize; i++) {
    cache.set(`key${i}`, i);
  }
  
  const keys = Array.from({ length: batchSize }, (_, i) => `key${i}`);
  
  const memBefore = measureMemory();
  const start = performance.now();
  
  const results = batchCache.getMany(keys);
  
  const elapsed = performance.now() - start;
  const memAfter = measureMemory();
  
  const throughput = (batchSize / elapsed) * 1000;
  const memDelta = memAfter.heapSize - memBefore.heapSize;
  const objDelta = memAfter.objectCount - memBefore.objectCount;
  
  console.log(`  ${formatNumber(batchSize)} entries:`);
  console.log(`    Time: ${elapsed.toFixed(2)}ms`);
  console.log(`    Throughput: ${formatNumber(Math.floor(throughput))} ops/sec`);
  console.log(`    Memory: ${formatBytes(memDelta)}`);
  console.log(`    Objects: ${formatNumber(objDelta)}`);
  console.log(`    Results size: ${results.size}`);
}

// Scenario 5: getMany (50% hits)
console.log("\n--- Scenario 5: getMany (50% hits) ---");
for (const batchSize of BATCH_SIZES) {
  const cache = new OptimizedLruTtlCache<string, number>({ maxEntries: CACHE_SIZE });
  const batchCache = withBatchOperations(cache);
  
  // Pre-populate cache with 50% of keys
  for (let i = 0; i < batchSize / 2; i++) {
    cache.set(`key${i}`, i);
  }
  
  const keys = Array.from({ length: batchSize }, (_, i) => `key${i}`);
  
  const memBefore = measureMemory();
  const start = performance.now();
  
  const results = batchCache.getMany(keys);
  
  const elapsed = performance.now() - start;
  const memAfter = measureMemory();
  
  const throughput = (batchSize / elapsed) * 1000;
  const memDelta = memAfter.heapSize - memBefore.heapSize;
  const objDelta = memAfter.objectCount - memBefore.objectCount;
  
  console.log(`  ${formatNumber(batchSize)} entries:`);
  console.log(`    Time: ${elapsed.toFixed(2)}ms`);
  console.log(`    Throughput: ${formatNumber(Math.floor(throughput))} ops/sec`);
  console.log(`    Memory: ${formatBytes(memDelta)}`);
  console.log(`    Objects: ${formatNumber(objDelta)}`);
  console.log(`    Results size: ${results.size} (expected: ${batchSize / 2})`);
}

// Scenario 6: deleteMany
console.log("\n--- Scenario 6: deleteMany ---");
for (const batchSize of BATCH_SIZES) {
  const cache = new OptimizedLruTtlCache<string, number>({ maxEntries: CACHE_SIZE });
  const batchCache = withBatchOperations(cache);
  
  // Pre-populate cache
  for (let i = 0; i < batchSize; i++) {
    cache.set(`key${i}`, i);
  }
  
  const keys = Array.from({ length: batchSize }, (_, i) => `key${i}`);
  
  const memBefore = measureMemory();
  const start = performance.now();
  
  batchCache.deleteMany(keys);
  
  const elapsed = performance.now() - start;
  const memAfter = measureMemory();
  
  const throughput = (batchSize / elapsed) * 1000;
  const memDelta = memAfter.heapSize - memBefore.heapSize;
  const objDelta = memAfter.objectCount - memBefore.objectCount;
  
  console.log(`  ${formatNumber(batchSize)} entries:`);
  console.log(`    Time: ${elapsed.toFixed(2)}ms`);
  console.log(`    Throughput: ${formatNumber(Math.floor(throughput))} ops/sec`);
  console.log(`    Memory: ${formatBytes(memDelta)}`);
  console.log(`    Objects: ${formatNumber(objDelta)}`);
  console.log(`    Cache size after: ${cache.size()}`);
}

// Scenario 7: hasMany
console.log("\n--- Scenario 7: hasMany ---");
for (const batchSize of BATCH_SIZES) {
  const cache = new OptimizedLruTtlCache<string, number>({ maxEntries: CACHE_SIZE });
  const batchCache = withBatchOperations(cache);
  
  // Pre-populate cache with 75% of keys
  for (let i = 0; i < (batchSize * 3) / 4; i++) {
    cache.set(`key${i}`, i);
  }
  
  const keys = Array.from({ length: batchSize }, (_, i) => `key${i}`);
  
  const memBefore = measureMemory();
  const start = performance.now();
  
  const results = batchCache.hasMany(keys);
  
  const elapsed = performance.now() - start;
  const memAfter = measureMemory();
  
  const throughput = (batchSize / elapsed) * 1000;
  const memDelta = memAfter.heapSize - memBefore.heapSize;
  const objDelta = memAfter.objectCount - memBefore.objectCount;
  
  const trueCount = Array.from(results.values()).filter(v => v).length;
  
  console.log(`  ${formatNumber(batchSize)} entries:`);
  console.log(`    Time: ${elapsed.toFixed(2)}ms`);
  console.log(`    Throughput: ${formatNumber(Math.floor(throughput))} ops/sec`);
  console.log(`    Memory: ${formatBytes(memDelta)}`);
  console.log(`    Objects: ${formatNumber(objDelta)}`);
  console.log(`    Found: ${trueCount} (expected: ${(batchSize * 3) / 4})`);
}

console.log("\n=== Baseline Summary ===");
console.log("Current batch operations use withBatchOperations wrapper which:");
console.log("  ✗ Calls individual set/get/del methods in a loop");
console.log("  ✗ Per-item event emission (N events for N operations)");
console.log("  ✗ Per-item statistics updates");
console.log("  ✗ Per-item validation and checks");
console.log("  ✗ Multiple Map lookups per operation");
console.log("\nExpected improvements with native batch operations:");
console.log("  ✓ Single Map iteration for bulk operations");
console.log("  ✓ Batch event emission (1 event for N operations)");
console.log("  ✓ Bulk statistics updates");
console.log("  ✓ Direct Map operations without wrapper overhead");
console.log("  ✓ Target: 2-4x faster batch operations\n");
