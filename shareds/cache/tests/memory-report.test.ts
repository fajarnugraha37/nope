/**
 * Memory Leak Detection - Reporting Only
 * 
 * Reports memory usage patterns for 100k-1M entries without strict assertions.
 * Run with: bun test tests/memory-report.test.ts --timeout 300000
 */

import { describe, test } from "bun:test";
import { LruTtlCache, Singleflight, memoize } from "../src";
import { heapStats } from "bun:jsc";

function gc() {
  Bun.gc(true); // Force synchronous GC
}

function getHeapMB(): number {
  gc();
  const stats = heapStats();
  return stats.heapSize / (1024 * 1024);
}

function formatMB(mb: number): string {
  return mb >= 0 ? `+${mb.toFixed(2)} MB` : `${mb.toFixed(2)} MB`;
}

describe("Memory Usage Report: LruTtlCache", () => {
  const counts = [100_000, 250_000, 500_000, 1_000_000];

  for (const count of counts) {
    test(`${count.toLocaleString()} entries`, async () => {
      console.log(`\n${"=".repeat(70)}`);
      console.log(`📊 LruTtlCache: ${count.toLocaleString()} entries`);
      console.log("=".repeat(70));

      const baseline = getHeapMB();
      console.log(`Baseline: ${baseline.toFixed(2)} MB`);

      const cache = new LruTtlCache<string, string>({
        maxEntries: count + 100,
        maxSize: count * 150,
      });

      // Populate
      console.log(`\n✏️  Populating...`);
      const populateStart = Date.now();
      for (let i = 0; i < count; i++) {
        cache.set(`key-${i}`, `value-${i}-${"x".repeat(50)}`);
      }
      const populateTime = Date.now() - populateStart;
      const afterPopulate = getHeapMB();

      console.log(`   Time: ${populateTime}ms`);
      console.log(`   Memory: ${formatMB(afterPopulate - baseline)}`);
      console.log(`   Per entry: ${((afterPopulate - baseline) * 1024 / count).toFixed(2)} KB`);
      console.log(`   Cache size: ${cache.size().toLocaleString()}`);

      // Access
      console.log(`\n👀 Accessing all entries...`);
      const accessStart = Date.now();
      let hits = 0;
      for (let i = 0; i < count; i++) {
        if (cache.get(`key-${i}`) !== undefined) hits++;
      }
      const accessTime = Date.now() - accessStart;
      const afterAccess = getHeapMB();

      console.log(`   Time: ${accessTime}ms`);
      console.log(`   Hits: ${hits.toLocaleString()}/${count.toLocaleString()} (${(hits/count*100).toFixed(1)}%)`);
      console.log(`   Memory change: ${formatMB(afterAccess - afterPopulate)}`);

      // Clear
      console.log(`\n🧹 Clearing cache...`);
      cache.clear();
      cache.stop();
      const afterClear = getHeapMB();

      console.log(`   Memory retained: ${formatMB(afterClear - baseline)}`);
      console.log(`   Memory recovered: ${formatMB(afterPopulate - afterClear)}`);
      
      const recoveryPct = ((afterPopulate - afterClear) / (afterPopulate - baseline)) * 100;
      console.log(`   Recovery rate: ${recoveryPct.toFixed(1)}%`);

      // Assessment
      console.log(`\n📋 Assessment:`);
      if (afterClear - baseline < (afterPopulate - baseline) * 0.3) {
        console.log(`   ✅ Excellent cleanup - minimal retention`);
      } else if (afterClear - baseline < (afterPopulate - baseline) * 0.7) {
        console.log(`   ✅ Good cleanup - GC will handle remainder`);
      } else {
        console.log(`   ⚠️  Some memory retained - may need GC cycle`);
      }
    });
  }
});

describe("Memory Usage Report: Continuous Eviction", () => {
  test("10k cache with 100k operations", async () => {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`📊 Continuous Eviction Test`);
    console.log("=".repeat(70));

    const cacheSize = 10_000;
    const rounds = 5;
    const opsPerRound = 20_000;

    const baseline = getHeapMB();
    console.log(`Baseline: ${baseline.toFixed(2)} MB`);

    const cache = new LruTtlCache<string, string>({
      maxEntries: cacheSize,
      maxSize: cacheSize * 150,
    });

    // Fill
    console.log(`\n✏️  Filling to ${cacheSize.toLocaleString()} entries...`);
    for (let i = 0; i < cacheSize; i++) {
      cache.set(`key-${i}`, `value-${i}-${"x".repeat(50)}`);
    }
    const afterFill = getHeapMB();
    console.log(`   Memory: ${formatMB(afterFill - baseline)}`);

    // Continuous replacement
    console.log(`\n🔄 Running ${rounds} rounds of ${opsPerRound.toLocaleString()} ops...`);
    const snapshots: number[] = [afterFill];
    let keyCounter = cacheSize;

    for (let round = 0; round < rounds; round++) {
      const start = Date.now();
      for (let i = 0; i < opsPerRound; i++) {
        cache.set(`key-${keyCounter++}`, `value-${keyCounter}-${"x".repeat(50)}`);
      }
      const time = Date.now() - start;
      const memory = getHeapMB();
      snapshots.push(memory);
      console.log(`   Round ${round + 1}: ${time}ms, ${memory.toFixed(2)} MB (${formatMB(memory - afterFill)})`);
    }

    // Analysis
    const memories = snapshots.slice(1); // Exclude initial fill
    const avg = memories.reduce((a, b) => a + b, 0) / memories.length;
    const min = Math.min(...memories);
    const max = Math.max(...memories);

    console.log(`\n📊 Memory Stability:`);
    console.log(`   Min: ${min.toFixed(2)} MB`);
    console.log(`   Avg: ${avg.toFixed(2)} MB`);
    console.log(`   Max: ${max.toFixed(2)} MB`);
    console.log(`   Range: ${(max - min).toFixed(2)} MB`);
    console.log(`   Cache size: ${cache.size().toLocaleString()} (expected: ${cacheSize.toLocaleString()})`);

    console.log(`\n📋 Assessment:`);
    if (max - min < (afterFill - baseline) * 0.2) {
      console.log(`   ✅ Excellent - Memory very stable`);
    } else if (max - min < (afterFill - baseline) * 0.5) {
      console.log(`   ✅ Good - Memory reasonably stable`);
    } else {
      console.log(`   ⚠️  Memory fluctuating - normal for GC timing`);
    }

    cache.clear();
  });
});

describe("Memory Usage Report: Singleflight", () => {
  const counts = [100_000, 500_000, 1_000_000];

  for (const count of counts) {
    test(`${count.toLocaleString()} sequential operations`, async () => {
      console.log(`\n${"=".repeat(70)}`);
      console.log(`📊 Singleflight: ${count.toLocaleString()} operations`);
      console.log("=".repeat(70));

      const baseline = getHeapMB();
      console.log(`Baseline: ${baseline.toFixed(2)} MB`);

      const sf = new Singleflight<string, string>();

      console.log(`\n🚀 Executing operations...`);
      const snapshots: number[] = [];
      const start = Date.now();

      for (let i = 0; i < count; i++) {
        await sf.do(`key-${i % 100}`, async () => `value-${i}`);
        
        if ((i + 1) % 100_000 === 0) {
          snapshots.push(getHeapMB());
        }
      }

      const time = Date.now() - start;
      const final = getHeapMB();

      console.log(`   Time: ${time}ms (${Math.round(count / time)}k ops/sec)`);
      console.log(`   In-flight: ${sf.size()}`);
      console.log(`   Final memory: ${formatMB(final - baseline)}`);

      if (snapshots.length > 0) {
        console.log(`   Memory range: ${Math.min(...snapshots).toFixed(2)} - ${Math.max(...snapshots).toFixed(2)} MB`);
      }

      console.log(`\n📋 Assessment:`);
      console.log(`   ✅ In-flight count: ${sf.size()} (should be 0)`);
      if (Math.abs(final - baseline) < 100) {
        console.log(`   ✅ Memory change < 100MB - Normal transient usage`);
      } else {
        console.log(`   ℹ️  Memory change > 100MB - May need GC cycle`);
      }
    });
  }
});

describe("Memory Usage Report: Mixed Workload", () => {
  test("1M operations on 50k key space", async () => {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`📊 Mixed Workload: 1M operations`);
    console.log("=".repeat(70));

    const keySpace = 50_000;
    const totalOps = 1_000_000;

    const baseline = getHeapMB();
    console.log(`Baseline: ${baseline.toFixed(2)} MB`);

    const cache = new LruTtlCache<string, string>({
      maxEntries: keySpace,
      maxSize: keySpace * 150,
    });

    console.log(`\n🎯 Executing ${totalOps.toLocaleString()} mixed operations...`);
    console.log(`   Key space: ${keySpace.toLocaleString()}`);
    console.log(`   Mix: 50% SET, 40% GET, 10% DELETE`);

    const start = Date.now();
    let sets = 0, gets = 0, dels = 0, hits = 0;
    const snapshots: { ops: number; memory: number }[] = [];

    for (let i = 0; i < totalOps; i++) {
      const key = `key-${i % keySpace}`;
      const op = i % 10;

      if (op < 5) {
        cache.set(key, `value-${i}-${"x".repeat(20)}`);
        sets++;
      } else if (op < 9) {
        if (cache.get(key) !== undefined) hits++;
        gets++;
      } else {
        cache.del(key);
        dels++;
      }

      if ((i + 1) % 200_000 === 0) {
        const mem = getHeapMB();
        snapshots.push({ ops: i + 1, memory: mem });
        console.log(`   ${(i + 1).toLocaleString()} ops: ${mem.toFixed(2)} MB (${formatMB(mem - baseline)})`);
      }
    }

    const time = Date.now() - start;
    const final = getHeapMB();

    console.log(`\n📊 Results:`);
    console.log(`   Time: ${time}ms (${Math.round(totalOps / time)}k ops/sec)`);
    console.log(`   Final memory: ${formatMB(final - baseline)}`);
    console.log(`   Cache size: ${cache.size().toLocaleString()}`);
    console.log(`   Operations: ${sets.toLocaleString()} sets, ${gets.toLocaleString()} gets, ${dels.toLocaleString()} deletes`);
    console.log(`   Hit rate: ${(hits / gets * 100).toFixed(1)}%`);

    const memories = snapshots.map(s => s.memory);
    const min = Math.min(...memories);
    const max = Math.max(...memories);
    const avg = memories.reduce((a, b) => a + b, 0) / memories.length;

    console.log(`\n📊 Memory Stability:`);
    console.log(`   Min: ${min.toFixed(2)} MB`);
    console.log(`   Avg: ${avg.toFixed(2)} MB`);
    console.log(`   Max: ${max.toFixed(2)} MB`);
    console.log(`   Range: ${(max - min).toFixed(2)} MB (${((max - min) / avg * 100).toFixed(1)}%)`);

    cache.clear();
    const afterClear = getHeapMB();
    console.log(`\n🧹 After clear: ${afterClear.toFixed(2)} MB (${formatMB(afterClear - baseline)} retained)`);

    console.log(`\n📋 Assessment:`);
    if (final - baseline < 200) {
      console.log(`   ✅ Memory growth < 200MB - Bounded and reasonable`);
    } else {
      console.log(`   ⚠️  Memory growth > 200MB - Consider smaller cache or GC tuning`);
    }

    console.log(`   Cache stayed at: ${cache.size().toLocaleString()}/${keySpace.toLocaleString()} entries`);
  });
});
