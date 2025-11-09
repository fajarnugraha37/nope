/**
 * Optimization #11: Batch Operations - COMPARISON
 * 
 * Compares performance between:
 * - BASELINE: withBatchOperations wrapper (loop calling individual ops)
 * - OPTIMIZED: Native batch methods (single iteration, bulk operations)
 * 
 * Measures:
 * - Throughput (ops/sec)
 * - Memory usage (heapStats)
 * - GC overhead (objectCount)
 * - Event emission overhead
 * - Statistics overhead
 * 
 * Run with: bun run tests/batch-operations-comparison.bench.ts
 */

import { OptimizedLruTtlCache } from "../src/cache-optimized";
import { withBatchOperations } from "../src/cache-utils";
import { heapStats } from "bun:jsc";

console.log("=== Optimization #11: Batch Operations - COMPARISON ===\n");

interface BenchmarkResult {
  time: number;
  throughput: number;
  memoryDelta: number;
  objectDelta: number;
  extra?: Record<string, any>;
}

function measureMemory() {
  Bun.gc(true);
  const stats = heapStats();
  return {
    heapSize: stats.heapSize,
    objectCount: stats.objectCount,
  };
}

function formatBytes(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(2) + " MB";
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

// Test configurations
const BATCH_SIZE = 5000;
const CACHE_SIZE = 10_000;
const ITERATIONS = 10; // Average over multiple runs for stability

console.log("Test Configuration:");
console.log(`  Batch size: ${formatNumber(BATCH_SIZE)}`);
console.log(`  Cache capacity: ${formatNumber(CACHE_SIZE)}`);
console.log(`  Iterations: ${ITERATIONS}`);
console.log(`  Runtime: Bun ${Bun.version}\n`);

// ==================================================================
// Scenario 1: setMany (no stats, no events)
// ==================================================================
console.log("=== Scenario 1: setMany (no stats, no events) ===\n");

function benchmarkSetManyBaseline(): BenchmarkResult {
  const times: number[] = [];
  let memoryDelta = 0;
  let objectDelta = 0;

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const cache = new OptimizedLruTtlCache<string, number>({ maxEntries: CACHE_SIZE });
    const batchCache = withBatchOperations(cache);
    const entries: Array<[string, number]> = Array.from(
      { length: BATCH_SIZE },
      (_, i) => [`key${i}`, i]
    );

    const memBefore = measureMemory();
    const start = performance.now();

    batchCache.setMany(entries);

    const elapsed = performance.now() - start;
    const memAfter = measureMemory();

    times.push(elapsed);
    memoryDelta += memAfter.heapSize - memBefore.heapSize;
    objectDelta += memAfter.objectCount - memBefore.objectCount;
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  return {
    time: avgTime,
    throughput: (BATCH_SIZE / avgTime) * 1000,
    memoryDelta: memoryDelta / ITERATIONS,
    objectDelta: objectDelta / ITERATIONS,
  };
}

function benchmarkSetManyOptimized(): BenchmarkResult {
  const times: number[] = [];
  let memoryDelta = 0;
  let objectDelta = 0;

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const cache = new OptimizedLruTtlCache<string, number>({ maxEntries: CACHE_SIZE });
    const entries: Array<[string, number]> = Array.from(
      { length: BATCH_SIZE },
      (_, i) => [`key${i}`, i]
    );

    const memBefore = measureMemory();
    const start = performance.now();

    cache.setMany(entries);

    const elapsed = performance.now() - start;
    const memAfter = measureMemory();

    times.push(elapsed);
    memoryDelta += memAfter.heapSize - memBefore.heapSize;
    objectDelta += memAfter.objectCount - memBefore.objectCount;
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  return {
    time: avgTime,
    throughput: (BATCH_SIZE / avgTime) * 1000,
    memoryDelta: memoryDelta / ITERATIONS,
    objectDelta: objectDelta / ITERATIONS,
  };
}

const setManyBaseline = benchmarkSetManyBaseline();
const setManyOptimized = benchmarkSetManyOptimized();

console.log("BASELINE (withBatchOperations wrapper):");
console.log(`  Time: ${setManyBaseline.time.toFixed(2)}ms`);
console.log(`  Throughput: ${formatNumber(Math.floor(setManyBaseline.throughput))} ops/sec`);
console.log(`  Memory: ${formatBytes(setManyBaseline.memoryDelta)}`);
console.log(`  Objects: ${formatNumber(Math.floor(setManyBaseline.objectDelta))}`);

console.log("\nOPTIMIZED (native batch method):");
console.log(`  Time: ${setManyOptimized.time.toFixed(2)}ms`);
console.log(`  Throughput: ${formatNumber(Math.floor(setManyOptimized.throughput))} ops/sec`);
console.log(`  Memory: ${formatBytes(setManyOptimized.memoryDelta)}`);
console.log(`  Objects: ${formatNumber(Math.floor(setManyOptimized.objectDelta))}`);

const setManySpeedup = (setManyBaseline.time / setManyOptimized.time);
const setManyMemSavings = ((setManyBaseline.memoryDelta - setManyOptimized.memoryDelta) / setManyBaseline.memoryDelta) * 100;
const setManyObjSavings = ((setManyBaseline.objectDelta - setManyOptimized.objectDelta) / setManyBaseline.objectDelta) * 100;

console.log("\n📊 IMPROVEMENT:");
console.log(`  Speedup: ${setManySpeedup.toFixed(2)}x faster`);
console.log(`  Throughput gain: ${formatPercent(((setManyOptimized.throughput / setManyBaseline.throughput) - 1) * 100)}`);
console.log(`  Memory savings: ${formatPercent(setManyMemSavings)}`);
console.log(`  Object reduction: ${formatPercent(setManyObjSavings)}`);

// ==================================================================
// Scenario 2: setMany with stats enabled
// ==================================================================
console.log("\n=== Scenario 2: setMany (with stats) ===\n");

function benchmarkSetManyStatsBaseline(): BenchmarkResult {
  const times: number[] = [];
  let memoryDelta = 0;
  let objectDelta = 0;

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const cache = new OptimizedLruTtlCache<string, number>({ 
      maxEntries: CACHE_SIZE,
      enableStats: true 
    });
    const batchCache = withBatchOperations(cache);
    const entries: Array<[string, number]> = Array.from(
      { length: BATCH_SIZE },
      (_, i) => [`key${i}`, i]
    );

    const memBefore = measureMemory();
    const start = performance.now();

    batchCache.setMany(entries);

    const elapsed = performance.now() - start;
    const memAfter = measureMemory();

    times.push(elapsed);
    memoryDelta += memAfter.heapSize - memBefore.heapSize;
    objectDelta += memAfter.objectCount - memBefore.objectCount;
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  return {
    time: avgTime,
    throughput: (BATCH_SIZE / avgTime) * 1000,
    memoryDelta: memoryDelta / ITERATIONS,
    objectDelta: objectDelta / ITERATIONS,
  };
}

function benchmarkSetManyStatsOptimized(): BenchmarkResult {
  const times: number[] = [];
  let memoryDelta = 0;
  let objectDelta = 0;

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const cache = new OptimizedLruTtlCache<string, number>({ 
      maxEntries: CACHE_SIZE,
      enableStats: true 
    });
    const entries: Array<[string, number]> = Array.from(
      { length: BATCH_SIZE },
      (_, i) => [`key${i}`, i]
    );

    const memBefore = measureMemory();
    const start = performance.now();

    cache.setMany(entries);

    const elapsed = performance.now() - start;
    const memAfter = measureMemory();

    times.push(elapsed);
    memoryDelta += memAfter.heapSize - memBefore.heapSize;
    objectDelta += memAfter.objectCount - memBefore.objectCount;
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  return {
    time: avgTime,
    throughput: (BATCH_SIZE / avgTime) * 1000,
    memoryDelta: memoryDelta / ITERATIONS,
    objectDelta: objectDelta / ITERATIONS,
  };
}

const setManyStatsBaseline = benchmarkSetManyStatsBaseline();
const setManyStatsOptimized = benchmarkSetManyStatsOptimized();

console.log("BASELINE (withBatchOperations wrapper + stats):");
console.log(`  Time: ${setManyStatsBaseline.time.toFixed(2)}ms`);
console.log(`  Throughput: ${formatNumber(Math.floor(setManyStatsBaseline.throughput))} ops/sec`);

console.log("\nOPTIMIZED (native batch method + stats):");
console.log(`  Time: ${setManyStatsOptimized.time.toFixed(2)}ms`);
console.log(`  Throughput: ${formatNumber(Math.floor(setManyStatsOptimized.throughput))} ops/sec`);

const setManyStatsSpeedup = (setManyStatsBaseline.time / setManyStatsOptimized.time);
console.log("\n📊 IMPROVEMENT:");
console.log(`  Speedup: ${setManyStatsSpeedup.toFixed(2)}x faster`);
console.log(`  Stats overhead eliminated: ${((1 - setManyStatsOptimized.time / setManyStatsBaseline.time) * 100).toFixed(1)}%`);

// ==================================================================
// Scenario 3: setMany with events enabled
// ==================================================================
console.log("\n=== Scenario 3: setMany (with events) ===\n");

function benchmarkSetManyEventsBaseline(): BenchmarkResult {
  const times: number[] = [];
  let totalEvents = 0;

  for (let iter = 0; iter < ITERATIONS; iter++) {
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
      { length: BATCH_SIZE },
      (_, i) => [`key${i}`, i]
    );

    const start = performance.now();
    batchCache.setMany(entries);
    const elapsed = performance.now() - start;

    times.push(elapsed);
    totalEvents += eventCount;
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  return {
    time: avgTime,
    throughput: (BATCH_SIZE / avgTime) * 1000,
    memoryDelta: 0,
    objectDelta: 0,
    extra: { events: totalEvents / ITERATIONS },
  };
}

function benchmarkSetManyEventsOptimized(): BenchmarkResult {
  const times: number[] = [];
  let totalEvents = 0;

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const cache = new OptimizedLruTtlCache<string, number>({ 
      maxEntries: CACHE_SIZE,
      enableEvents: true 
    });
    
    let eventCount = 0;
    const events = cache.getEvents();
    if (events) {
      events.on("batch-set", () => { eventCount++; });
    }

    const entries: Array<[string, number]> = Array.from(
      { length: BATCH_SIZE },
      (_, i) => [`key${i}`, i]
    );

    const start = performance.now();
    cache.setMany(entries);
    const elapsed = performance.now() - start;

    times.push(elapsed);
    totalEvents += eventCount;
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  return {
    time: avgTime,
    throughput: (BATCH_SIZE / avgTime) * 1000,
    memoryDelta: 0,
    objectDelta: 0,
    extra: { events: totalEvents / ITERATIONS },
  };
}

const setManyEventsBaseline = benchmarkSetManyEventsBaseline();
const setManyEventsOptimized = benchmarkSetManyEventsOptimized();

console.log("BASELINE (N individual 'set' events):");
console.log(`  Time: ${setManyEventsBaseline.time.toFixed(2)}ms`);
console.log(`  Throughput: ${formatNumber(Math.floor(setManyEventsBaseline.throughput))} ops/sec`);
console.log(`  Events emitted: ${formatNumber(setManyEventsBaseline.extra!.events)}`);

console.log("\nOPTIMIZED (1 'batch-set' event):");
console.log(`  Time: ${setManyEventsOptimized.time.toFixed(2)}ms`);
console.log(`  Throughput: ${formatNumber(Math.floor(setManyEventsOptimized.throughput))} ops/sec`);
console.log(`  Events emitted: ${formatNumber(setManyEventsOptimized.extra!.events)}`);

const setManyEventsSpeedup = (setManyEventsBaseline.time / setManyEventsOptimized.time);
const eventReduction = ((setManyEventsBaseline.extra!.events - setManyEventsOptimized.extra!.events) / setManyEventsBaseline.extra!.events) * 100;

console.log("\n📊 IMPROVEMENT:");
console.log(`  Speedup: ${setManyEventsSpeedup.toFixed(2)}x faster`);
console.log(`  Event reduction: ${formatPercent(eventReduction)}`);
console.log(`  Event overhead eliminated: ${((1 - setManyEventsOptimized.time / setManyEventsBaseline.time) * 100).toFixed(1)}%`);

// ==================================================================
// Scenario 4: getMany (all hits)
// ==================================================================
console.log("\n=== Scenario 4: getMany (all hits) ===\n");

function benchmarkGetManyBaseline(): BenchmarkResult {
  const times: number[] = [];

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const cache = new OptimizedLruTtlCache<string, number>({ maxEntries: CACHE_SIZE });
    const batchCache = withBatchOperations(cache);

    // Pre-populate
    for (let i = 0; i < BATCH_SIZE; i++) {
      cache.set(`key${i}`, i);
    }

    const keys = Array.from({ length: BATCH_SIZE }, (_, i) => `key${i}`);

    const start = performance.now();
    batchCache.getMany(keys);
    const elapsed = performance.now() - start;

    times.push(elapsed);
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  return {
    time: avgTime,
    throughput: (BATCH_SIZE / avgTime) * 1000,
    memoryDelta: 0,
    objectDelta: 0,
  };
}

function benchmarkGetManyOptimized(): BenchmarkResult {
  const times: number[] = [];

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const cache = new OptimizedLruTtlCache<string, number>({ maxEntries: CACHE_SIZE });

    // Pre-populate
    for (let i = 0; i < BATCH_SIZE; i++) {
      cache.set(`key${i}`, i);
    }

    const keys = Array.from({ length: BATCH_SIZE }, (_, i) => `key${i}`);

    const start = performance.now();
    cache.getMany(keys);
    const elapsed = performance.now() - start;

    times.push(elapsed);
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  return {
    time: avgTime,
    throughput: (BATCH_SIZE / avgTime) * 1000,
    memoryDelta: 0,
    objectDelta: 0,
  };
}

const getManyBaseline = benchmarkGetManyBaseline();
const getManyOptimized = benchmarkGetManyOptimized();

console.log("BASELINE (loop calling get()):");
console.log(`  Time: ${getManyBaseline.time.toFixed(2)}ms`);
console.log(`  Throughput: ${formatNumber(Math.floor(getManyBaseline.throughput))} ops/sec`);

console.log("\nOPTIMIZED (single Map iteration):");
console.log(`  Time: ${getManyOptimized.time.toFixed(2)}ms`);
console.log(`  Throughput: ${formatNumber(Math.floor(getManyOptimized.throughput))} ops/sec`);

const getManySpeedup = (getManyBaseline.time / getManyOptimized.time);
console.log("\n📊 IMPROVEMENT:");
console.log(`  Speedup: ${getManySpeedup.toFixed(2)}x faster`);
console.log(`  Throughput gain: ${formatPercent(((getManyOptimized.throughput / getManyBaseline.throughput) - 1) * 100)}`);

// ==================================================================
// Scenario 5: deleteMany
// ==================================================================
console.log("\n=== Scenario 5: deleteMany ===\n");

function benchmarkDeleteManyBaseline(): BenchmarkResult {
  const times: number[] = [];

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const cache = new OptimizedLruTtlCache<string, number>({ maxEntries: CACHE_SIZE });
    const batchCache = withBatchOperations(cache);

    // Pre-populate
    for (let i = 0; i < BATCH_SIZE; i++) {
      cache.set(`key${i}`, i);
    }

    const keys = Array.from({ length: BATCH_SIZE }, (_, i) => `key${i}`);

    const start = performance.now();
    batchCache.deleteMany(keys);
    const elapsed = performance.now() - start;

    times.push(elapsed);
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  return {
    time: avgTime,
    throughput: (BATCH_SIZE / avgTime) * 1000,
    memoryDelta: 0,
    objectDelta: 0,
  };
}

function benchmarkDeleteManyOptimized(): BenchmarkResult {
  const times: number[] = [];

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const cache = new OptimizedLruTtlCache<string, number>({ maxEntries: CACHE_SIZE });

    // Pre-populate
    for (let i = 0; i < BATCH_SIZE; i++) {
      cache.set(`key${i}`, i);
    }

    const keys = Array.from({ length: BATCH_SIZE }, (_, i) => `key${i}`);

    const start = performance.now();
    cache.deleteMany(keys);
    const elapsed = performance.now() - start;

    times.push(elapsed);
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  return {
    time: avgTime,
    throughput: (BATCH_SIZE / avgTime) * 1000,
    memoryDelta: 0,
    objectDelta: 0,
  };
}

const deleteManyBaseline = benchmarkDeleteManyBaseline();
const deleteManyOptimized = benchmarkDeleteManyOptimized();

console.log("BASELINE (loop calling del()):");
console.log(`  Time: ${deleteManyBaseline.time.toFixed(2)}ms`);
console.log(`  Throughput: ${formatNumber(Math.floor(deleteManyBaseline.throughput))} ops/sec`);

console.log("\nOPTIMIZED (bulk deletion):");
console.log(`  Time: ${deleteManyOptimized.time.toFixed(2)}ms`);
console.log(`  Throughput: ${formatNumber(Math.floor(deleteManyOptimized.throughput))} ops/sec`);

const deleteManySpeedup = (deleteManyBaseline.time / deleteManyOptimized.time);
console.log("\n📊 IMPROVEMENT:");
console.log(`  Speedup: ${deleteManySpeedup.toFixed(2)}x faster`);
console.log(`  Throughput gain: ${formatPercent(((deleteManyOptimized.throughput / deleteManyBaseline.throughput) - 1) * 100)}`);

// ==================================================================
// Overall Summary
// ==================================================================
console.log("\n" + "=".repeat(70));
console.log("=== OPTIMIZATION #11 SUMMARY ===");
console.log("=".repeat(70));

console.log("\n📈 Performance Improvements:");
console.log(`  setMany (no overhead):    ${setManySpeedup.toFixed(2)}x faster`);
console.log(`  setMany (with stats):     ${setManyStatsSpeedup.toFixed(2)}x faster`);
console.log(`  setMany (with events):    ${setManyEventsSpeedup.toFixed(2)}x faster`);
console.log(`  getMany (all hits):       ${getManySpeedup.toFixed(2)}x faster`);
console.log(`  deleteMany:               ${deleteManySpeedup.toFixed(2)}x faster`);

const avgSpeedup = (setManySpeedup + setManyStatsSpeedup + setManyEventsSpeedup + getManySpeedup + deleteManySpeedup) / 5;
console.log(`\n  Average speedup: ${avgSpeedup.toFixed(2)}x`);

console.log("\n💾 Resource Optimization:");
console.log(`  Memory reduction (setMany): ${formatPercent(setManyMemSavings)}`);
console.log(`  Object reduction (setMany): ${formatPercent(setManyObjSavings)}`);
console.log(`  Event reduction (batch ops): ${formatPercent(eventReduction)}`);

console.log("\n✅ Optimization Goals:");
console.log(`  Target: 2-4x faster batch operations`);
console.log(`  Achieved: ${avgSpeedup.toFixed(2)}x average speedup`);
console.log(`  Status: ${avgSpeedup >= 2 ? "✅ TARGET MET" : "⚠️ NEEDS REVIEW"}`);

console.log("\n" + "=".repeat(70) + "\n");
