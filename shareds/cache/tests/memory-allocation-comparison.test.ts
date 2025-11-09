/**
 * Optimization #10: Memory Allocation - Comparison Benchmark
 * 
 * Compares baseline LruTtlCache vs OptimizedLruTtlCache with object pooling.
 * 
 * Run with: bun test ./tests/memory-allocation-comparison.test.ts --timeout 300000
 */

import { describe, test } from "bun:test";
import { heapStats } from "bun:jsc";
import { LruTtlCache, OptimizedLruTtlCache } from "../src";

// Memory utilities using bun:jsc
function forceGC() {
  Bun.gc(true);
  Bun.gc(true);
}

function getMemoryStats() {
  forceGC();
  const stats = heapStats();
  return {
    heapSize: stats.heapSize / (1024 * 1024), // MB
    heapCapacity: stats.heapCapacity / (1024 * 1024), // MB
    extraMemorySize: stats.extraMemorySize / (1024 * 1024), // MB
    objectCount: stats.objectCount,
    protectedObjectCount: stats.protectedObjectCount,
  };
}

function formatMB(mb: number): string {
  return `${mb.toFixed(2)} MB`;
}

// GC tracking
let gcCount = 0;
let gcDuration = 0;
const originalBunGC = Bun.gc;

(Bun as any).gc = (sync: boolean) => {
  const start = performance.now();
  originalBunGC(sync);
  const duration = performance.now() - start;
  gcDuration += duration;
  gcCount++;
};

describe("Memory Allocation Comparison", () => {
  test("Baseline vs Optimized - 500k entries", async () => {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`📊 COMPARISON: Baseline vs Optimized (500k entries)`);
    console.log("=".repeat(70));

    /* ---------- BASELINE ---------- */
    console.log(`\n🔵 BASELINE: LruTtlCache`);
    console.log("─".repeat(70));
    
    const baselineStart = getMemoryStats();
    gcCount = 0;
    gcDuration = 0;

    const baselineCache = new LruTtlCache<string, { id: number; data: string }>({
      maxEntries: 500_100,
      maxSize: 500_000 * 500,
    });

    const baselinePopulateStart = performance.now();
    for (let i = 0; i < 500_000; i++) {
      baselineCache.set(`key-${i}`, {
        id: i,
        data: `value-${i}-${"x".repeat(50)}`,
      });
    }
    const baselinePopulateTime = performance.now() - baselinePopulateStart;
    const baselineAfterPopulate = getMemoryStats();
    const baselineGCCount = gcCount;
    const baselineGCDuration = gcDuration;

    console.log(`\n✅ Population Complete:`);
    console.log(`   Time: ${baselinePopulateTime.toFixed(2)}ms`);
    console.log(`   Throughput: ${(500_000 / baselinePopulateTime * 1000).toFixed(0)} ops/sec`);
    console.log(`   Memory Used: ${formatMB(baselineAfterPopulate.heapSize - baselineStart.heapSize)}`);
    console.log(`   Object Count: ${(baselineAfterPopulate.objectCount - baselineStart.objectCount).toLocaleString()}`);
    console.log(`   Per Entry: ${((baselineAfterPopulate.heapSize - baselineStart.heapSize) * 1024 / 500_000).toFixed(2)} KB`);
    console.log(`   GC Count: ${baselineGCCount}`);
    console.log(`   GC Duration: ${baselineGCDuration.toFixed(2)}ms`);
    console.log(`   GC Overhead: ${(baselineGCDuration / baselinePopulateTime * 100).toFixed(2)}%`);

    // Access test
    const baselineAccessStart = performance.now();
    gcCount = 0;
    gcDuration = 0;
    let baselineHits = 0;

    for (let i = 0; i < 50_000; i++) {
      const key = `key-${Math.floor(Math.random() * 500_000)}`;
      if (baselineCache.get(key) !== undefined) baselineHits++;
    }

    const baselineAccessTime = performance.now() - baselineAccessStart;
    const baselineAccessGCCount = gcCount;
    const baselineAccessGCDuration = gcDuration;

    console.log(`\n🔍 Access Test (50k operations):`);
    console.log(`   Time: ${baselineAccessTime.toFixed(2)}ms`);
    console.log(`   Throughput: ${(50_000 / baselineAccessTime * 1000).toFixed(0)} ops/sec`);
    console.log(`   Hit Rate: ${(baselineHits / 50_000 * 100).toFixed(1)}%`);
    console.log(`   GC Count: ${baselineAccessGCCount}`);
    console.log(`   GC Overhead: ${(baselineAccessGCDuration / baselineAccessTime * 100).toFixed(2)}%`);

    baselineCache.clear();
    const baselineAfterClear = getMemoryStats();

    /* ---------- OPTIMIZED ---------- */
    console.log(`\n\n🟢 OPTIMIZED: OptimizedLruTtlCache (with Object Pooling)`);
    console.log("─".repeat(70));

    const optimizedStart = getMemoryStats();
    gcCount = 0;
    gcDuration = 0;

    const optimizedCache = new OptimizedLruTtlCache<string, { id: number; data: string }>({
      maxEntries: 500_100,
      maxSize: 500_000 * 500,
    });

    const optimizedPopulateStart = performance.now();
    for (let i = 0; i < 500_000; i++) {
      optimizedCache.set(`key-${i}`, {
        id: i,
        data: `value-${i}-${"x".repeat(50)}`,
      });
    }
    const optimizedPopulateTime = performance.now() - optimizedPopulateStart;
    const optimizedAfterPopulate = getMemoryStats();
    const optimizedGCCount = gcCount;
    const optimizedGCDuration = gcDuration;

    console.log(`\n✅ Population Complete:`);
    console.log(`   Time: ${optimizedPopulateTime.toFixed(2)}ms`);
    console.log(`   Throughput: ${(500_000 / optimizedPopulateTime * 1000).toFixed(0)} ops/sec`);
    console.log(`   Memory Used: ${formatMB(optimizedAfterPopulate.heapSize - optimizedStart.heapSize)}`);
    console.log(`   Object Count: ${(optimizedAfterPopulate.objectCount - optimizedStart.objectCount).toLocaleString()}`);
    console.log(`   Per Entry: ${((optimizedAfterPopulate.heapSize - optimizedStart.heapSize) * 1024 / 500_000).toFixed(2)} KB`);
    console.log(`   GC Count: ${optimizedGCCount}`);
    console.log(`   GC Duration: ${optimizedGCDuration.toFixed(2)}ms`);
    console.log(`   GC Overhead: ${(optimizedGCDuration / optimizedPopulateTime * 100).toFixed(2)}%`);

    // Access test
    const optimizedAccessStart = performance.now();
    gcCount = 0;
    gcDuration = 0;
    let optimizedHits = 0;

    for (let i = 0; i < 50_000; i++) {
      const key = `key-${Math.floor(Math.random() * 500_000)}`;
      if (optimizedCache.get(key) !== undefined) optimizedHits++;
    }

    const optimizedAccessTime = performance.now() - optimizedAccessStart;
    const optimizedAccessGCCount = gcCount;
    const optimizedAccessGCDuration = gcDuration;

    console.log(`\n🔍 Access Test (50k operations):`);
    console.log(`   Time: ${optimizedAccessTime.toFixed(2)}ms`);
    console.log(`   Throughput: ${(50_000 / optimizedAccessTime * 1000).toFixed(0)} ops/sec`);
    console.log(`   Hit Rate: ${(optimizedHits / 50_000 * 100).toFixed(1)}%`);
    console.log(`   GC Count: ${optimizedAccessGCCount}`);
    console.log(`   GC Overhead: ${(optimizedAccessGCDuration / optimizedAccessTime * 100).toFixed(2)}%`);

    optimizedCache.clear();
    const optimizedAfterClear = getMemoryStats();

    /* ---------- COMPARISON ---------- */
    console.log(`\n\n📊 IMPROVEMENT SUMMARY`);
    console.log("=".repeat(70));

    const baselineMemory = baselineAfterPopulate.heapSize - baselineStart.heapSize;
    const optimizedMemory = optimizedAfterPopulate.heapSize - optimizedStart.heapSize;
    const memoryImprovement = ((baselineMemory - optimizedMemory) / baselineMemory * 100);

    const baselineObjects = baselineAfterPopulate.objectCount - baselineStart.objectCount;
    const optimizedObjects = optimizedAfterPopulate.objectCount - optimizedStart.objectCount;
    const objectImprovement = ((baselineObjects - optimizedObjects) / baselineObjects * 100);

    const baselineMemPerEntry = (baselineMemory * 1024 / 500_000);
    const optimizedMemPerEntry = (optimizedMemory * 1024 / 500_000);
    const memPerEntryImprovement = ((baselineMemPerEntry - optimizedMemPerEntry) / baselineMemPerEntry * 100);

    const baselineGCOverhead = baselineGCDuration / baselinePopulateTime * 100;
    const optimizedGCOverhead = optimizedGCDuration / optimizedPopulateTime * 100;
    const gcOverheadImprovement = ((baselineGCOverhead - optimizedGCOverhead) / baselineGCOverhead * 100);

    const baselineThroughput = 500_000 / baselinePopulateTime * 1000;
    const optimizedThroughput = 500_000 / optimizedPopulateTime * 1000;
    const throughputImprovement = ((optimizedThroughput - baselineThroughput) / baselineThroughput * 100);

    console.log(`\n💾 Memory Metrics:`);
    console.log(`   Total Memory:`);
    console.log(`     Baseline:  ${formatMB(baselineMemory)}`);
    console.log(`     Optimized: ${formatMB(optimizedMemory)}`);
    console.log(`     ${memoryImprovement >= 0 ? '✅' : '❌'} Improvement: ${memoryImprovement.toFixed(2)}%`);

    console.log(`\n   Memory per Entry:`);
    console.log(`     Baseline:  ${baselineMemPerEntry.toFixed(2)} KB`);
    console.log(`     Optimized: ${optimizedMemPerEntry.toFixed(2)} KB`);
    console.log(`     ${memPerEntryImprovement >= 0 ? '✅' : '❌'} Improvement: ${memPerEntryImprovement.toFixed(2)}%`);

    console.log(`\n   Object Count:`);
    console.log(`     Baseline:  ${baselineObjects.toLocaleString()}`);
    console.log(`     Optimized: ${optimizedObjects.toLocaleString()}`);
    console.log(`     ${objectImprovement >= 0 ? '✅' : '❌'} Improvement: ${objectImprovement.toFixed(2)}%`);

    console.log(`\n🗑️  GC Metrics:`);
    console.log(`   GC Count (Populate):`);
    console.log(`     Baseline:  ${baselineGCCount}`);
    console.log(`     Optimized: ${optimizedGCCount}`);
    console.log(`     ${optimizedGCCount <= baselineGCCount ? '✅' : '❌'} ${baselineGCCount > 0 ? ((baselineGCCount - optimizedGCCount) / baselineGCCount * 100).toFixed(2) : '0.00'}% reduction`);

    console.log(`\n   GC Overhead (Populate):`);
    console.log(`     Baseline:  ${baselineGCOverhead.toFixed(2)}%`);
    console.log(`     Optimized: ${optimizedGCOverhead.toFixed(2)}%`);
    console.log(`     ${gcOverheadImprovement >= 0 ? '✅' : '❌'} Improvement: ${gcOverheadImprovement.toFixed(2)}%`);

    console.log(`\n   GC Count (Access):`);
    console.log(`     Baseline:  ${baselineAccessGCCount}`);
    console.log(`     Optimized: ${optimizedAccessGCCount}`);

    console.log(`\n⚡ Performance Metrics:`);
    console.log(`   Populate Throughput:`);
    console.log(`     Baseline:  ${baselineThroughput.toFixed(0)} ops/sec`);
    console.log(`     Optimized: ${optimizedThroughput.toFixed(0)} ops/sec`);
    console.log(`     ${throughputImprovement >= 0 ? '✅' : '❌'} Improvement: ${throughputImprovement.toFixed(2)}%`);

    const baselineAccessThroughput = 50_000 / baselineAccessTime * 1000;
    const optimizedAccessThroughput = 50_000 / optimizedAccessTime * 1000;
    const accessThroughputImprovement = ((optimizedAccessThroughput - baselineAccessThroughput) / baselineAccessThroughput * 100);

    console.log(`\n   Access Throughput:`);
    console.log(`     Baseline:  ${baselineAccessThroughput.toFixed(0)} ops/sec`);
    console.log(`     Optimized: ${optimizedAccessThroughput.toFixed(0)} ops/sec`);
    console.log(`     ${accessThroughputImprovement >= 0 ? '✅' : '❌'} Improvement: ${accessThroughputImprovement.toFixed(2)}%`);

    console.log(`\n🎯 Target vs Actual:`);
    console.log(`   Memory/Entry: Target -30-50%, Actual ${memPerEntryImprovement.toFixed(1)}% ${memPerEntryImprovement >= 30 ? '✅' : memPerEntryImprovement >= 20 ? '⚠️' : '❌'}`);
    console.log(`   GC Overhead:  Target -40-60%, Actual ${gcOverheadImprovement.toFixed(1)}% ${gcOverheadImprovement >= 40 ? '✅' : gcOverheadImprovement >= 25 ? '⚠️' : '❌'}`);
    console.log(`   Throughput:   Target +20-30%, Actual ${throughputImprovement.toFixed(1)}% ${throughputImprovement >= 20 ? '✅' : throughputImprovement >= 10 ? '⚠️' : '❌'}`);
  });

  test("Baseline vs Optimized - Rapid Churn (50k cache, 500k ops)", async () => {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`📊 COMPARISON: Rapid Churn Test`);
    console.log("=".repeat(70));

    /* ---------- BASELINE ---------- */
    console.log(`\n🔵 BASELINE: LruTtlCache`);
    
    const baselineStart = getMemoryStats();
    const baselineCache = new LruTtlCache<string, { id: number; data: string }>({
      maxEntries: 50_000,
      maxSize: 50_000 * 500,
    });

    gcCount = 0;
    gcDuration = 0;
    const baselineChurnStart = performance.now();

    for (let i = 0; i < 500_000; i++) {
      baselineCache.set(`key-${i}`, {
        id: i,
        data: `value-${i}-${"x".repeat(50)}`,
      });
    }

    const baselineChurnTime = performance.now() - baselineChurnStart;
    const baselineAfterChurn = getMemoryStats();
    const baselineGCCount = gcCount;
    const baselineGCDuration = gcDuration;

    console.log(`   Time: ${baselineChurnTime.toFixed(2)}ms`);
    console.log(`   Throughput: ${(500_000 / baselineChurnTime * 1000).toFixed(0)} ops/sec`);
    console.log(`   GC Count: ${baselineGCCount}`);
    console.log(`   GC Duration: ${baselineGCDuration.toFixed(2)}ms`);
    console.log(`   GC Overhead: ${(baselineGCDuration / baselineChurnTime * 100).toFixed(2)}%`);
    console.log(`   GC Frequency: ${(baselineGCCount / baselineChurnTime * 1000).toFixed(2)} GCs/sec`);

    baselineCache.clear();

    /* ---------- OPTIMIZED ---------- */
    console.log(`\n🟢 OPTIMIZED: OptimizedLruTtlCache`);

    const optimizedStart = getMemoryStats();
    const optimizedCache = new OptimizedLruTtlCache<string, { id: number; data: string }>({
      maxEntries: 50_000,
      maxSize: 50_000 * 500,
    });

    gcCount = 0;
    gcDuration = 0;
    const optimizedChurnStart = performance.now();

    for (let i = 0; i < 500_000; i++) {
      optimizedCache.set(`key-${i}`, {
        id: i,
        data: `value-${i}-${"x".repeat(50)}`,
      });
    }

    const optimizedChurnTime = performance.now() - optimizedChurnStart;
    const optimizedAfterChurn = getMemoryStats();
    const optimizedGCCount = gcCount;
    const optimizedGCDuration = gcDuration;

    console.log(`   Time: ${optimizedChurnTime.toFixed(2)}ms`);
    console.log(`   Throughput: ${(500_000 / optimizedChurnTime * 1000).toFixed(0)} ops/sec`);
    console.log(`   GC Count: ${optimizedGCCount}`);
    console.log(`   GC Duration: ${optimizedGCDuration.toFixed(2)}ms`);
    console.log(`   GC Overhead: ${(optimizedGCDuration / optimizedChurnTime * 100).toFixed(2)}%`);
    console.log(`   GC Frequency: ${(optimizedGCCount / optimizedChurnTime * 1000).toFixed(2)} GCs/sec`);

    optimizedCache.dispose();

    /* ---------- COMPARISON ---------- */
    console.log(`\n\n📊 CHURN TEST RESULTS`);
    console.log("=".repeat(70));

    const baselineGCOverhead = baselineGCDuration / baselineChurnTime * 100;
    const optimizedGCOverhead = optimizedGCDuration / optimizedChurnTime * 100;
    const gcOverheadImprovement = ((baselineGCOverhead - optimizedGCOverhead) / baselineGCOverhead * 100);

    const baselineGCFreq = baselineGCCount / baselineChurnTime * 1000;
    const optimizedGCFreq = optimizedGCCount / optimizedChurnTime * 1000;
    const gcFreqImprovement = ((baselineGCFreq - optimizedGCFreq) / baselineGCFreq * 100);

    const baselineThroughput = 500_000 / baselineChurnTime * 1000;
    const optimizedThroughput = 500_000 / optimizedChurnTime * 1000;
    const throughputImprovement = ((optimizedThroughput - baselineThroughput) / baselineThroughput * 100);

    console.log(`\n🗑️  GC Improvement:`);
    console.log(`   GC Count:     ${baselineGCCount} → ${optimizedGCCount} (${((baselineGCCount - optimizedGCCount) / baselineGCCount * 100).toFixed(1)}% reduction)`);
    console.log(`   GC Overhead:  ${baselineGCOverhead.toFixed(2)}% → ${optimizedGCOverhead.toFixed(2)}% (${gcOverheadImprovement.toFixed(1)}% improvement)`);
    console.log(`   GC Frequency: ${baselineGCFreq.toFixed(2)} → ${optimizedGCFreq.toFixed(2)} GCs/sec (${gcFreqImprovement.toFixed(1)}% reduction)`);

    console.log(`\n⚡ Performance:`);
    console.log(`   Throughput: ${baselineThroughput.toFixed(0)} → ${optimizedThroughput.toFixed(0)} ops/sec (${throughputImprovement.toFixed(1)}% improvement)`);

    console.log(`\n🎯 Assessment:`);
    if (optimizedGCOverhead < 15) {
      console.log(`   ✅ EXCELLENT: GC overhead reduced to ${optimizedGCOverhead.toFixed(2)}% (target < 15%)`);
    } else if (optimizedGCOverhead < 20) {
      console.log(`   ⚠️  GOOD: GC overhead at ${optimizedGCOverhead.toFixed(2)}% (target < 15%)`);
    } else {
      console.log(`   ❌ NEEDS WORK: GC overhead still ${optimizedGCOverhead.toFixed(2)}% (target < 15%)`);
    }
  });
});
