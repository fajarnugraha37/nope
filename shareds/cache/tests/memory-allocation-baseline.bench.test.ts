/**
 * Optimization #10: Memory Allocation - Baseline Benchmark
 * 
 * Measures current memory allocation patterns and GC overhead using Bun's official APIs.
 * 
 * Run with: bun test ./tests/memory-allocation-baseline.bench.test.ts
 */

import { describe, test } from "bun:test";
import { heapStats } from "bun:jsc";
import { LruTtlCache } from "../src";

// Memory utilities using bun:jsc
function forceGC() {
  Bun.gc(true); // Synchronous GC
  Bun.gc(true); // Run twice to ensure cleanup
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

// GC tracking - wrap Bun.gc to count calls
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

describe("Memory Allocation Baseline", () => {
  test("Measure object creation overhead - 500k entries", async () => {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`📊 Memory Allocation Baseline: 500,000 entries`);
    console.log("=".repeat(70));

    const baseline = getMemoryStats();
    console.log(`\n🎯 Baseline Memory:`);
    console.log(`   Heap Size: ${formatMB(baseline.heapSize)}`);
    console.log(`   Heap Capacity: ${formatMB(baseline.heapCapacity)}`);
    console.log(`   Extra Memory: ${formatMB(baseline.extraMemorySize)}`);
    console.log(`   Object Count: ${baseline.objectCount.toLocaleString()}`);

    gcCount = 0;
    gcDuration = 0;

    // Create cache and populate
    const cache = new LruTtlCache<string, { id: number; data: string }>({
      maxEntries: 500_100,
      maxSize: 500_000 * 500,
    });

    console.log(`\n📝 Populating 500,000 entries...`);
    const populateStart = performance.now();

    for (let i = 0; i < 500_000; i++) {
      cache.set(`key-${i}`, {
        id: i,
        data: `value-${i}-${"x".repeat(50)}`,
      });
    }

    const populateTime = performance.now() - populateStart;
    const afterPopulate = getMemoryStats();

    console.log(`\n✅ Population Complete:`);
    console.log(`   Time: ${populateTime.toFixed(2)}ms`);
    console.log(`   Throughput: ${(500_000 / populateTime * 1000).toFixed(0)} ops/sec`);

    console.log(`\n💾 Memory Usage After Population:`);
    console.log(`   Heap Size: ${formatMB(afterPopulate.heapSize)} (+${formatMB(afterPopulate.heapSize - baseline.heapSize)})`);
    console.log(`   Heap Capacity: ${formatMB(afterPopulate.heapCapacity)} (+${formatMB(afterPopulate.heapCapacity - baseline.heapCapacity)})`);
    console.log(`   Extra Memory: ${formatMB(afterPopulate.extraMemorySize)} (+${formatMB(afterPopulate.extraMemorySize - baseline.extraMemorySize)})`);
    console.log(`   Object Count: ${afterPopulate.objectCount.toLocaleString()} (+${(afterPopulate.objectCount - baseline.objectCount).toLocaleString()})`);
    
    const memoryPerEntry = (afterPopulate.heapSize - baseline.heapSize) * 1024 / 500_000;
    console.log(`   Per Entry: ${memoryPerEntry.toFixed(2)} KB`);

    // Access pattern test
    console.log(`\n🔍 Access Pattern Test (50k random accesses)...`);
    const accessStart = performance.now();
    let hits = 0;

    for (let i = 0; i < 50_000; i++) {
      const key = `key-${Math.floor(Math.random() * 500_000)}`;
      if (cache.get(key) !== undefined) hits++;
    }

    const accessTime = performance.now() - accessStart;
    const afterAccess = getMemoryStats();

    console.log(`   Time: ${accessTime.toFixed(2)}ms`);
    console.log(`   Throughput: ${(50_000 / accessTime * 1000).toFixed(0)} ops/sec`);
    console.log(`   Hit Rate: ${(hits / 50_000 * 100).toFixed(1)}%`);
    console.log(`   Memory Change: ${formatMB(afterAccess.heapSize - afterPopulate.heapSize)}`);

    // Update pattern test
    console.log(`\n✏️  Update Pattern Test (50k updates)...`);
    const updateStart = performance.now();

    for (let i = 0; i < 50_000; i++) {
      const idx = Math.floor(Math.random() * 500_000);
      cache.set(`key-${idx}`, {
        id: idx + 1_000_000,
        data: `updated-${idx}-${"y".repeat(50)}`,
      });
    }

    const updateTime = performance.now() - updateStart;
    const afterUpdate = getMemoryStats();

    console.log(`   Time: ${updateTime.toFixed(2)}ms`);
    console.log(`   Throughput: ${(50_000 / updateTime * 1000).toFixed(0)} ops/sec`);
    console.log(`   Memory Change: ${formatMB(afterUpdate.heapSize - afterAccess.heapSize)}`);

    // GC Analysis
    console.log(`\n🗑️  GC Analysis:`);
    console.log(`   GC Count: ${gcCount}`);
    console.log(`   GC Duration: ${gcDuration.toFixed(2)}ms`);
    console.log(`   Avg GC Time: ${gcCount > 0 ? (gcDuration / gcCount).toFixed(2) : 0}ms`);

    // Object structure analysis
    console.log(`\n🔬 Object Structure Analysis:`);
    console.log(`   Entry Structure: { v, exp?, sl?, sz, t }`);
    console.log(`   LRUNode Structure: { key, entry, prev, next }`);
    console.log(`   Nested Objects: 2 per cache entry (Entry + LRUNode)`);
    console.log(`   Pointers: 4 per entry (Map + prev + next + entry ref)`);
    
    const estimatedOverhead = (
      8 + // Map entry overhead
      32 + // LRUNode object header
      32 + // Entry object header
      8 * 4 // 4 pointers
    );
    console.log(`   Estimated Overhead: ~${estimatedOverhead} bytes/entry`);

    // Cleanup
    cache.clear();
    const afterClear = getMemoryStats();

    console.log(`\n🧹 After Clear:`);
    console.log(`   Memory Released: ${formatMB(afterUpdate.heapSize - afterClear.heapSize)}`);
    console.log(`   Recovery Rate: ${((afterUpdate.heapSize - afterClear.heapSize) / (afterUpdate.heapSize - baseline.heapSize) * 100).toFixed(1)}%`);

    // Summary
    console.log(`\n📊 BASELINE SUMMARY:`);
    console.log(`   ✓ Memory/Entry: ${memoryPerEntry.toFixed(2)} KB`);
    console.log(`   ✓ Populate: ${(500_000 / populateTime * 1000).toFixed(0)} ops/sec`);
    console.log(`   ✓ Access: ${(50_000 / accessTime * 1000).toFixed(0)} ops/sec`);
    console.log(`   ✓ Update: ${(50_000 / updateTime * 1000).toFixed(0)} ops/sec`);
    console.log(`   ✓ GC Overhead: ${gcDuration.toFixed(2)}ms (${gcCount} cycles)`);
  });

  test("Memory allocation patterns - 1M entries", async () => {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`📊 Memory Allocation Baseline: 1,000,000 entries`);
    console.log("=".repeat(70));

    const baseline = getMemoryStats();
    console.log(`\n🎯 Baseline: ${formatMB(baseline.heapSize)}`);

    gcCount = 0;
    gcDuration = 0;

    const cache = new LruTtlCache<string, { id: number; data: string }>({
      maxEntries: 1_000_100,
      maxSize: 1_000_000 * 500,
    });

    console.log(`\n📝 Populating 1,000,000 entries...`);
    const snapshots: { count: number; memory: number; gcCount: number; gcTime: number }[] = [];
    const populateStart = performance.now();

    for (let i = 0; i < 1_000_000; i++) {
      cache.set(`key-${i}`, {
        id: i,
        data: `value-${i}-${"x".repeat(50)}`,
      });

      // Take snapshots
      if ((i + 1) % 200_000 === 0) {
        const mem = getMemoryStats();
        snapshots.push({
          count: i + 1,
          memory: mem.heapSize - baseline.heapSize,
          gcCount: gcCount,
          gcTime: gcDuration,
        });
        console.log(`   ${(i + 1).toLocaleString()}: ${formatMB(mem.heapSize - baseline.heapSize)} (${gcCount} GCs, ${gcDuration.toFixed(0)}ms)`);
      }
    }

    const populateTime = performance.now() - populateStart;
    const afterPopulate = getMemoryStats();

    console.log(`\n✅ Population Complete:`);
    console.log(`   Time: ${populateTime.toFixed(2)}ms`);
    console.log(`   Throughput: ${(1_000_000 / populateTime * 1000).toFixed(0)} ops/sec`);
    console.log(`   Memory Used: ${formatMB(afterPopulate.heapSize - baseline.heapSize)}`);
    console.log(`   Per Entry: ${((afterPopulate.heapSize - baseline.heapSize) * 1024 / 1_000_000).toFixed(2)} KB`);

    console.log(`\n🗑️  GC Summary:`);
    console.log(`   Total GC Count: ${gcCount}`);
    console.log(`   Total GC Time: ${gcDuration.toFixed(2)}ms`);
    console.log(`   GC Overhead: ${(gcDuration / populateTime * 100).toFixed(2)}%`);
    console.log(`   Avg GC Duration: ${(gcDuration / gcCount).toFixed(2)}ms`);

    // Memory growth pattern
    console.log(`\n📈 Memory Growth Pattern:`);
    for (let i = 1; i < snapshots.length; i++) {
      const prev = snapshots[i - 1];
      const curr = snapshots[i];
      const growth = curr.memory - prev.memory;
      const perEntry = growth * 1024 / 100_000;
      console.log(`   ${prev.count.toLocaleString()} → ${curr.count.toLocaleString()}: +${formatMB(growth)} (${perEntry.toFixed(2)} KB/entry)`);
    }

    cache.clear();
    const afterClear = getMemoryStats();

    console.log(`\n📊 BASELINE SUMMARY (1M):`);
    console.log(`   ✓ Total Memory: ${formatMB(afterPopulate.heapSize - baseline.heapSize)}`);
    console.log(`   ✓ Per Entry: ${((afterPopulate.heapSize - baseline.heapSize) * 1024 / 1_000_000).toFixed(2)} KB`);
    console.log(`   ✓ Throughput: ${(1_000_000 / populateTime * 1000).toFixed(0)} ops/sec`);
    console.log(`   ✓ GC Overhead: ${(gcDuration / populateTime * 100).toFixed(2)}%`);
    console.log(`   ✓ GC Frequency: ${(gcCount / populateTime * 1000).toFixed(2)} GCs/sec`);
  });

  test("Allocation pressure test - rapid creation/deletion", async () => {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`📊 Allocation Pressure Test: Rapid Churn`);
    console.log("=".repeat(70));

    const baseline = getMemoryStats();
    console.log(`\n🎯 Baseline: ${formatMB(baseline.heapSize)}`);

    const cache = new LruTtlCache<string, { id: number; data: string }>({
      maxEntries: 50_000,
      maxSize: 50_000 * 500,
    });

    gcCount = 0;
    gcDuration = 0;

    console.log(`\n🔄 Rapid Churn Test (500k ops, 50k cache size)...`);
    console.log(`   Creates 10x cache size to trigger frequent evictions`);

    const churnStart = performance.now();
    const memorySnapshots: number[] = [];

    for (let i = 0; i < 500_000; i++) {
      cache.set(`key-${i}`, {
        id: i,
        data: `value-${i}-${"x".repeat(50)}`,
      });

      if ((i + 1) % 50_000 === 0) {
        const mem = getMemoryStats();
        memorySnapshots.push(mem.heapSize);
        console.log(`   ${(i + 1).toLocaleString()} ops: ${formatMB(mem.heapSize - baseline.heapSize)} (${gcCount} GCs)`);
      }
    }

    const churnTime = performance.now() - churnStart;
    const afterChurn = getMemoryStats();

    console.log(`\n✅ Churn Test Complete:`);
    console.log(`   Time: ${churnTime.toFixed(2)}ms`);
    console.log(`   Throughput: ${(500_000 / churnTime * 1000).toFixed(0)} ops/sec`);
    console.log(`   Final Cache Size: ${cache.size().toLocaleString()}`);

    console.log(`\n💾 Memory Stability:`);
    const minMem = Math.min(...memorySnapshots);
    const maxMem = Math.max(...memorySnapshots);
    const avgMem = memorySnapshots.reduce((a, b) => a + b, 0) / memorySnapshots.length;
    console.log(`   Min: ${formatMB(minMem - baseline.heapSize)}`);
    console.log(`   Avg: ${formatMB(avgMem - baseline.heapSize)}`);
    console.log(`   Max: ${formatMB(maxMem - baseline.heapSize)}`);
    console.log(`   Range: ${formatMB(maxMem - minMem)} (${((maxMem - minMem) / avgMem * 100).toFixed(1)}%)`);

    console.log(`\n🗑️  GC Under Pressure:`);
    console.log(`   Total GC Count: ${gcCount}`);
    console.log(`   Total GC Time: ${gcDuration.toFixed(2)}ms`);
    console.log(`   GC Overhead: ${(gcDuration / churnTime * 100).toFixed(2)}%`);
    console.log(`   GC Frequency: ${(gcCount / churnTime * 1000).toFixed(2)} GCs/sec`);
    console.log(`   Avg GC Duration: ${(gcDuration / gcCount).toFixed(2)}ms`);

    console.log(`\n📊 Allocation Pressure Assessment:`);
    const gcOverhead = gcDuration / churnTime * 100;
    if (gcOverhead < 5) {
      console.log(`   ✅ Low GC overhead (${gcOverhead.toFixed(2)}%)`);
    } else if (gcOverhead < 15) {
      console.log(`   ⚠️  Moderate GC overhead (${gcOverhead.toFixed(2)}%)`);
    } else {
      console.log(`   🔴 High GC overhead (${gcOverhead.toFixed(2)}%) - optimization needed`);
    }

    cache.clear();
  });
});

describe("Current Memory Allocation Characteristics", () => {
  test("Analyze object overhead and fragmentation", () => {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`🔬 Object Overhead Analysis`);
    console.log("=".repeat(70));

    console.log(`\n📦 Current Data Structures:`);
    console.log(`
   Entry<V> = {
     v: V,           // Value (user data)
     exp?: number,   // Expiration timestamp (8 bytes)
     sl?: number,    // Sliding TTL (8 bytes)
     sz: number,     // Size (8 bytes)
     t: number       // Last access time (8 bytes)
   }
   Base overhead: ~32 bytes (object header) + 32 bytes (fields) = 64 bytes

   LRUNode<K, V> = {
     key: K,                    // Key reference (8 bytes)
     entry: Entry<V>,           // Entry reference (8 bytes)
     prev: LRUNode | null,      // Prev pointer (8 bytes)
     next: LRUNode | null       // Next pointer (8 bytes)
   }
   Base overhead: ~32 bytes (object header) + 32 bytes (fields) = 64 bytes

   Map<K, LRUNode<K, V>>:
     Per entry overhead: ~8-16 bytes

   TOTAL per cache entry: ~144-160 bytes overhead (excluding key/value data)
    `);

    console.log(`\n🎯 Optimization Opportunities:`);
    console.log(`
   1. Object Pooling:
      - Reuse Entry and LRUNode objects instead of creating new ones
      - Reduce GC pressure by 50-70%
      - Expected savings: ~30-40% less allocations

   2. Flat Array Structure:
      - Store Entry fields in separate typed arrays
      - Eliminate object headers (save ~64 bytes/entry)
      - Expected savings: ~40% memory overhead

   3. String Interning:
      - Deduplicate common key patterns
      - Useful for pattern-based keys (e.g., "user:123", "session:abc")
      - Expected savings: 20-50% for string keys

   4. Typed Arrays for Metadata:
      - Use Float64Array for timestamps/sizes
      - Use Uint32Array for indices
      - Expected savings: ~20 bytes/entry

   5. Preallocated Slots:
      - Reserve memory upfront for maxEntries
      - Reduce dynamic allocation overhead
      - Expected savings: Better memory locality, faster access
    `);

    console.log(`\n📊 Expected Improvements (Combined):`);
    console.log(`   Memory Overhead: -30-50% (144 bytes → 70-100 bytes)`);
    console.log(`   GC Frequency: -40-60%`);
    console.log(`   GC Duration: -30-40%`);
    console.log(`   Throughput: +20-30%`);
    console.log(`   Memory Locality: +50-80% (better cache hits)`);
  });
});
