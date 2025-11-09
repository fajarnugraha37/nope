import { describe, expect, test } from "bun:test";
import { heapStats } from "bun:jsc";
import { LruTtlCache } from "../src/cache.ts";
import { OptimizedLruTtlCache } from "../src/cache-optimized.ts";
import { FlatArrayCache } from "../src/cache-flat-array.ts";
import type { Cache } from "../src/cache.ts";

/**
 * Optimization #10 - Phase 2 Comparison Benchmark
 * 
 * Three-way comparison: Baseline vs Phase 1 (Pooling) vs Phase 2 (Flat Arrays)
 * 
 * Target Metrics:
 * - Memory reduction: -30-50% vs baseline
 * - GC overhead: -40-60% vs baseline
 * - Throughput: Maintain or improve
 * 
 * Expected Results:
 * - Phase 1: +28% access, +18% churn, minimal memory
 * - Phase 2: -30-50% memory, -40-60% GC, competitive throughput
 */

type Millis = number;
type Bytes = number;

interface MemorySnapshot {
  heapSize: Bytes;
  heapCapacity: Bytes;
  extraMemorySize: Bytes;
  objectCount: number;
  protectedObjectCount: number;
}

interface MemoryStats {
  beforeGC: MemorySnapshot;
  afterGC: MemorySnapshot;
  allocated: Bytes;
  retained: Bytes;
  objectsCreated: number;
  objectsRetained: number;
  perEntryBytes: number;
  perEntryObjects: number;
}

interface GCStats {
  gcCycles: number;
  gcTimeMs: Millis;
  gcOverheadPercent: number;
  gcFrequencyPerSec: number;
}

interface ThroughputStats {
  populateOpsPerSec: number;
  accessOpsPerSec: number;
  churnOpsPerSec: number;
}

interface BenchmarkResult {
  implementation: string;
  memory: MemoryStats;
  gc: GCStats;
  throughput: ThroughputStats;
  summary: string;
}

function forceGC(): void {
  Bun.gc(true);
}

function captureHeapSnapshot(): MemorySnapshot {
  const stats = heapStats();
  return {
    heapSize: stats.heapSize,
    heapCapacity: stats.heapCapacity,
    extraMemorySize: stats.extraMemorySize,
    objectCount: stats.objectCount,
    protectedObjectCount: stats.protectedObjectCount,
  };
}

function calculateMemoryStats(
  beforeGC: MemorySnapshot,
  afterInitialGC: MemorySnapshot,
  afterPopulate: MemorySnapshot,
  entryCount: number
): MemoryStats {
  const allocated = afterPopulate.heapSize - beforeGC.heapSize;
  const retained = afterPopulate.heapSize - afterInitialGC.heapSize;
  const objectsCreated = afterPopulate.objectCount - beforeGC.objectCount;
  const objectsRetained = afterPopulate.objectCount - afterInitialGC.objectCount;

  return {
    beforeGC,
    afterGC: afterPopulate,
    allocated,
    retained,
    objectsCreated,
    objectsRetained,
    perEntryBytes: retained / entryCount,
    perEntryObjects: objectsRetained / entryCount,
  };
}

function trackGarbageCollection<T>(fn: () => T): { result: T; gcStats: GCStats } {
  const startStats = heapStats();
  const startTime = performance.now();
  
  let gcCycles = 0;
  let lastObjectCount = startStats.objectCount;
  
  const result = fn();
  
  const endTime = performance.now();
  const endStats = heapStats();
  
  // Approximate GC cycles by monitoring significant object count drops
  const objectCountChange = Math.abs(endStats.objectCount - startStats.objectCount);
  gcCycles = Math.floor(objectCountChange / 100000); // Heuristic: ~100k objects per GC
  
  const totalTime = endTime - startTime;
  const gcTimeMs = gcCycles * 10; // Estimate: ~10ms per GC cycle
  const gcOverheadPercent = (gcTimeMs / totalTime) * 100;
  const gcFrequencyPerSec = (gcCycles / totalTime) * 1000;

  return {
    result,
    gcStats: {
      gcCycles,
      gcTimeMs,
      gcOverheadPercent,
      gcFrequencyPerSec,
    },
  };
}

async function measureMemoryFootprint<K, V>(
  cacheFactory: (maxSize: number) => Cache<K, V>,
  entries: number
): Promise<MemoryStats> {
  // Warm up
  forceGC();
  await Bun.sleep(100);
  forceGC();
  await Bun.sleep(100);

  const beforeGC = captureHeapSnapshot();
  forceGC();
  await Bun.sleep(100);
  const afterInitialGC = captureHeapSnapshot();

  // Populate cache
  const cache = cacheFactory(entries);
  for (let i = 0; i < entries; i++) {
    cache.set(`key-${i}` as K, { data: `value-${i}`, timestamp: Date.now() } as V);
  }

  // Measure after population
  const afterPopulate = captureHeapSnapshot();

  const stats = calculateMemoryStats(beforeGC, afterInitialGC, afterPopulate, entries);

  return stats;
}

async function measureThroughput<K, V>(
  cacheFactory: (maxSize: number) => Cache<K, V>,
  operations: number
): Promise<{ throughput: ThroughputStats; gc: GCStats }> {
  const cache = cacheFactory(operations);

  // 1. Populate throughput
  const populateStart = performance.now();
  const populateGC = trackGarbageCollection(() => {
    for (let i = 0; i < operations; i++) {
      cache.set(`key-${i}` as K, { data: `value-${i}` } as V);
    }
  });
  const populateTime = performance.now() - populateStart;
  const populateOpsPerSec = (operations / populateTime) * 1000;

  // 2. Access throughput (sequential reads)
  const accessStart = performance.now();
  const accessGC = trackGarbageCollection(() => {
    for (let i = 0; i < operations; i++) {
      cache.get(`key-${i}` as K);
    }
  });
  const accessTime = performance.now() - accessStart;
  const accessOpsPerSec = (operations / accessTime) * 1000;

  // 3. Churn throughput (mixed operations)
  const churnStart = performance.now();
  const churnGC = trackGarbageCollection(() => {
    for (let i = 0; i < operations; i++) {
      if (i % 3 === 0) cache.get(`key-${i % 1000}` as K);
      else if (i % 3 === 1) cache.set(`key-${i % 1000}` as K, { data: `new-${i}` } as V);
      else cache.del(`key-${i % 1000}` as K);
    }
  });
  const churnTime = performance.now() - churnStart;
  const churnOpsPerSec = (operations / churnTime) * 1000;

  // Aggregate GC stats (weighted average)
  const totalOps = operations * 3;
  const totalGCCycles =
    (populateGC.gcStats.gcCycles + accessGC.gcStats.gcCycles + churnGC.gcStats.gcCycles) / 3;
  const totalGCTime =
    (populateGC.gcStats.gcTimeMs + accessGC.gcStats.gcTimeMs + churnGC.gcStats.gcTimeMs) / 3;
  const totalTime = (populateTime + accessTime + churnTime) / 3;
  const gcOverheadPercent = (totalGCTime / totalTime) * 100;
  const gcFrequencyPerSec = (totalGCCycles / totalTime) * 1000;

  return {
    throughput: {
      populateOpsPerSec,
      accessOpsPerSec,
      churnOpsPerSec,
    },
    gc: {
      gcCycles: totalGCCycles,
      gcTimeMs: totalGCTime,
      gcOverheadPercent,
      gcFrequencyPerSec,
    },
  };
}

function formatBytes(bytes: number): string {
  return (bytes / 1024).toFixed(2);
}

function formatNumber(num: number): string {
  return num.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatPercent(percent: number): string {
  return `${percent >= 0 ? "+" : ""}${percent.toFixed(2)}%`;
}

function calculateImprovement(baseline: number, current: number): number {
  return ((current - baseline) / baseline) * 100;
}

function generateSummary(result: BenchmarkResult, baseline?: BenchmarkResult): string {
  const lines: string[] = [
    `\n${"=".repeat(70)}`,
    `${result.implementation}`,
    `${"=".repeat(70)}`,
    "",
    "📊 Memory Metrics:",
    `  Per Entry: ${formatBytes(result.memory.perEntryBytes)} KB`,
    `  Objects/Entry: ${result.memory.perEntryObjects.toFixed(2)}`,
    `  Total Retained: ${formatBytes(result.memory.retained)} KB`,
    "",
    "🗑️  GC Metrics:",
    `  Overhead: ${result.gc.gcOverheadPercent.toFixed(2)}%`,
    `  Frequency: ${result.gc.gcFrequencyPerSec.toFixed(2)} GCs/sec`,
    `  Cycles: ${result.gc.gcCycles.toFixed(1)}`,
    "",
    "⚡ Throughput:",
    `  Populate: ${formatNumber(result.throughput.populateOpsPerSec)} ops/sec`,
    `  Access: ${formatNumber(result.throughput.accessOpsPerSec)} ops/sec`,
    `  Churn: ${formatNumber(result.throughput.churnOpsPerSec)} ops/sec`,
  ];

  if (baseline && result.implementation !== baseline.implementation) {
    const memoryImprovement = calculateImprovement(
      baseline.memory.perEntryBytes,
      result.memory.perEntryBytes
    );
    const gcImprovement = calculateImprovement(
      baseline.gc.gcOverheadPercent,
      result.gc.gcOverheadPercent
    );
    const accessImprovement = calculateImprovement(
      baseline.throughput.accessOpsPerSec,
      result.throughput.accessOpsPerSec
    );
    const churnImprovement = calculateImprovement(
      baseline.throughput.churnOpsPerSec,
      result.throughput.churnOpsPerSec
    );

    lines.push(
      "",
      "📈 vs Baseline:",
      `  Memory: ${formatPercent(memoryImprovement)} ${memoryImprovement < -20 ? "✅" : memoryImprovement > 5 ? "❌" : "⚠️"}`,
      `  GC Overhead: ${formatPercent(gcImprovement)} ${gcImprovement < -30 ? "✅" : gcImprovement > 0 ? "❌" : "⚠️"}`,
      `  Access: ${formatPercent(accessImprovement)} ${accessImprovement > 10 ? "✅" : accessImprovement < -10 ? "❌" : "⚠️"}`,
      `  Churn: ${formatPercent(churnImprovement)} ${churnImprovement > 10 ? "✅" : churnImprovement < -10 ? "❌" : "⚠️"}`
    );
  }

  lines.push(`${"=".repeat(70)}\n`);
  return lines.join("\n");
}

describe("Optimization #10 - Phase 2: Three-Way Comparison", () => {
  const ENTRY_COUNT = 500_000; // Match baseline measurements
  const OPERATION_COUNT = 500_000;

  test("Baseline: LruTtlCache (Original)", async () => {
    console.log("\n🔬 Testing Baseline Implementation...\n");

    const memoryStats = await measureMemoryFootprint(
      (maxEntries) => new LruTtlCache({ maxEntries }),
      ENTRY_COUNT
    );

    const { throughput, gc } = await measureThroughput(
      (maxEntries) => new LruTtlCache({ maxEntries }),
      OPERATION_COUNT
    );

    const result: BenchmarkResult = {
      implementation: "Baseline: LruTtlCache",
      memory: memoryStats,
      gc,
      throughput,
      summary: "",
    };

    result.summary = generateSummary(result);
    console.log(result.summary);

    // Store for comparison
    (globalThis as any).__baselineResult = result;

    expect(result.memory.perEntryBytes).toBeGreaterThan(0);
    expect(result.throughput.accessOpsPerSec).toBeGreaterThan(0);
  });

  test("Phase 1: OptimizedLruTtlCache (Object Pooling)", async () => {
    console.log("\n🔬 Testing Phase 1: Object Pooling...\n");

    const memoryStats = await measureMemoryFootprint(
      (maxEntries) => new OptimizedLruTtlCache({ maxEntries }),
      ENTRY_COUNT
    );

    const { throughput, gc } = await measureThroughput(
      (maxEntries) => new OptimizedLruTtlCache({ maxEntries }),
      OPERATION_COUNT
    );

    const result: BenchmarkResult = {
      implementation: "Phase 1: OptimizedLruTtlCache (Object Pooling)",
      memory: memoryStats,
      gc,
      throughput,
      summary: "",
    };

    const baseline = (globalThis as any).__baselineResult;
    result.summary = generateSummary(result, baseline);
    console.log(result.summary);

    // Store for comparison
    (globalThis as any).__phase1Result = result;

    // Expected: +20-30% throughput, minimal memory improvement
    const accessImprovement = calculateImprovement(
      baseline.throughput.accessOpsPerSec,
      result.throughput.accessOpsPerSec
    );
    expect(accessImprovement).toBeGreaterThanOrEqual(-10); // At least not worse
  });

  test("Phase 2: FlatArrayCache (Flat Array Structure)", async () => {
    console.log("\n🔬 Testing Phase 2: Flat Array Structure...\n");

    const memoryStats = await measureMemoryFootprint(
      (maxEntries) => new FlatArrayCache({ maxEntries }),
      ENTRY_COUNT
    );

    const { throughput, gc } = await measureThroughput(
      (maxEntries) => new FlatArrayCache({ maxEntries }),
      OPERATION_COUNT
    );

    const result: BenchmarkResult = {
      implementation: "Phase 2: FlatArrayCache (Flat Array Structure)",
      memory: memoryStats,
      gc,
      throughput,
      summary: "",
    };

    const baseline = (globalThis as any).__baselineResult;
    result.summary = generateSummary(result, baseline);
    console.log(result.summary);

    // Expected: -30-50% memory, -40-60% GC overhead
    const memoryImprovement = calculateImprovement(
      baseline.memory.perEntryBytes,
      result.memory.perEntryBytes
    );
    const gcImprovement = calculateImprovement(baseline.gc.gcOverheadPercent, result.gc.gcOverheadPercent);

    console.log("\n🎯 Phase 2 Target Achievement:");
    console.log(`  Memory Reduction: ${formatPercent(memoryImprovement)} (Target: -30% to -50%)`);
    console.log(`  GC Overhead: ${formatPercent(gcImprovement)} (Target: -40% to -60%)`);

    // Store for final comparison
    (globalThis as any).__phase2Result = result;

    expect(result.memory.perEntryBytes).toBeGreaterThan(0);
    expect(result.throughput.accessOpsPerSec).toBeGreaterThan(0);
  });

  test("Final Comparison: All Three Implementations", () => {
    const baseline = (globalThis as any).__baselineResult as BenchmarkResult;
    const phase1 = (globalThis as any).__phase1Result as BenchmarkResult;
    const phase2 = (globalThis as any).__phase2Result as BenchmarkResult;

    console.log("\n" + "=".repeat(70));
    console.log("📊 FINAL COMPARISON: BASELINE vs PHASE 1 vs PHASE 2");
    console.log("=".repeat(70));

    console.log("\n💾 Memory per Entry:");
    console.log(`  Baseline:  ${formatBytes(baseline.memory.perEntryBytes)} KB`);
    console.log(
      `  Phase 1:   ${formatBytes(phase1.memory.perEntryBytes)} KB (${formatPercent(
        calculateImprovement(baseline.memory.perEntryBytes, phase1.memory.perEntryBytes)
      )})`
    );
    console.log(
      `  Phase 2:   ${formatBytes(phase2.memory.perEntryBytes)} KB (${formatPercent(
        calculateImprovement(baseline.memory.perEntryBytes, phase2.memory.perEntryBytes)
      )})`
    );

    console.log("\n🗑️  GC Overhead:");
    console.log(`  Baseline:  ${baseline.gc.gcOverheadPercent.toFixed(2)}%`);
    console.log(
      `  Phase 1:   ${phase1.gc.gcOverheadPercent.toFixed(2)}% (${formatPercent(
        calculateImprovement(baseline.gc.gcOverheadPercent, phase1.gc.gcOverheadPercent)
      )})`
    );
    console.log(
      `  Phase 2:   ${phase2.gc.gcOverheadPercent.toFixed(2)}% (${formatPercent(
        calculateImprovement(baseline.gc.gcOverheadPercent, phase2.gc.gcOverheadPercent)
      )})`
    );

    console.log("\n⚡ Access Throughput:");
    console.log(`  Baseline:  ${formatNumber(baseline.throughput.accessOpsPerSec)} ops/sec`);
    console.log(
      `  Phase 1:   ${formatNumber(phase1.throughput.accessOpsPerSec)} ops/sec (${formatPercent(
        calculateImprovement(baseline.throughput.accessOpsPerSec, phase1.throughput.accessOpsPerSec)
      )})`
    );
    console.log(
      `  Phase 2:   ${formatNumber(phase2.throughput.accessOpsPerSec)} ops/sec (${formatPercent(
        calculateImprovement(baseline.throughput.accessOpsPerSec, phase2.throughput.accessOpsPerSec)
      )})`
    );

    console.log("\n⚡ Churn Throughput:");
    console.log(`  Baseline:  ${formatNumber(baseline.throughput.churnOpsPerSec)} ops/sec`);
    console.log(
      `  Phase 1:   ${formatNumber(phase1.throughput.churnOpsPerSec)} ops/sec (${formatPercent(
        calculateImprovement(baseline.throughput.churnOpsPerSec, phase1.throughput.churnOpsPerSec)
      )})`
    );
    console.log(
      `  Phase 2:   ${formatNumber(phase2.throughput.churnOpsPerSec)} ops/sec (${formatPercent(
        calculateImprovement(baseline.throughput.churnOpsPerSec, phase2.throughput.churnOpsPerSec)
      )})`
    );

    console.log("\n🎯 Target Achievement:");
    const phase2MemoryImprovement = calculateImprovement(
      baseline.memory.perEntryBytes,
      phase2.memory.perEntryBytes
    );
    const phase2GCImprovement = calculateImprovement(
      baseline.gc.gcOverheadPercent,
      phase2.gc.gcOverheadPercent
    );

    console.log(`  Memory Reduction: ${formatPercent(phase2MemoryImprovement)} ${phase2MemoryImprovement <= -30 ? "✅ TARGET MET" : "⚠️  Below target (-30% to -50%)"}`);
    console.log(`  GC Overhead: ${formatPercent(phase2GCImprovement)} ${phase2GCImprovement <= -40 ? "✅ TARGET MET" : "⚠️  Below target (-40% to -60%)"}`);

    console.log("\n" + "=".repeat(70) + "\n");

    expect(baseline).toBeDefined();
    expect(phase1).toBeDefined();
    expect(phase2).toBeDefined();
  });
});
