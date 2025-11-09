# Benchmark Methodology & Findings

## Overview

This document explains the comprehensive benchmark approach, key findings, and important lessons learned during performance testing.

---

## Key Findings

### 1. GET Operations Are Faster Than SET (Corrected)

**Initial Problem:** Benchmarks showed GET (507k ops/sec) slower than SET (1,083k ops/sec), which was counterintuitive.

**Root Cause:** The benchmark was measuring **SET + GET time combined**, not just GET time:

```typescript
// WRONG - Measures both operations
const getTime = benchmark(() => {
  for (let i = 0; i < 1_000_000; i++) cache.set(`key${i}`, i);  // ← 832ms
  for (let i = 0; i < 1_000_000; i++) cache.get(`key${i}`);     // ← 680ms
}); // Total: 1,512ms (reported as "get time")
```

**Solution:** Separate setup from measurement:

```typescript
// CORRECT - Measures only GET
let cache: LruTtlCache<string, number>;
benchmark(() => {
  cache = new LruTtlCache({ maxEntries: 1_000_000 });
  for (let i = 0; i < 1_000_000; i++) cache.set(`key${i}`, i);
}, 1); // Setup phase

const getTime = benchmark(() => {
  for (let i = 0; i < 1_000_000; i++) cache.get(`key${i}`);  // Only GET
}); // Pure GET time: 680ms
```

**Corrected Results:**
- **1M small entries:**
  - SET: 832ms (1,202,352 ops/sec)
  - GET: 680ms (1,471,029 ops/sec) ✅ **1.22x faster**
  
- **100k large objects:**
  - SET: 2,402ms (41,639 ops/sec)
  - GET: 78ms (1,274,407 ops/sec) ✅ **30x faster!**

**Why GET is faster:**
- **SET operations:**
  1. Create new linked list node
  2. Insert into Map
  3. Update head/tail pointers
  4. Check size limit
  5. Potentially trigger eviction
  6. Update statistics (if enabled)
  7. Emit events (if enabled)

- **GET operations:**
  1. Map lookup (O(1))
  2. Check TTL expiration
  3. Move node to head (pointer updates)
  4. Return value

GET has fewer steps and no size management overhead!

---

### 2. Memory Measurement Challenges

**Problem:** `performance.memory` (Chrome-specific API) is undefined in Bun.

**Attempted Solutions:**

#### Option A: `process.memoryUsage()` (Failed)
```typescript
const memBefore = process.memoryUsage().heapUsed;
// ... add entries ...
const memAfter = process.memoryUsage().heapUsed;
const perEntry = (memAfter - memBefore) / count;
// Result: Unreliable due to GC interference
```

**Issues:**
- Bun's GC runs unpredictably
- Memory allocations are batched
- Other process activity interferes
- Results vary wildly between runs

#### Option B: Theoretical Calculation (Used) ✅
```typescript
// Each cache entry consists of:
const avgKeySize = "key_1234".length * 2 + 24;  // UTF-16 + overhead = 40B
const avgValueSize = 48;                        // Small object
const mapEntryOverhead = 32;                    // Map.Entry<K,V>
const nodeOverhead = 48;                        // DoublyLinkedListNode
const total = 168 bytes per entry
```

**Breakdown:**
- **Key (40 bytes):** String "key_1234" (8 chars × 2 bytes) + 24 bytes object overhead
- **Value (48 bytes):** Small object `{ data: "value_1234" }`
- **Map Entry (32 bytes):** Key reference + value reference + hash
- **List Node (48 bytes):** prev pointer + next pointer + key + value + metadata

**Total: ~168 bytes per entry** (for small string keys/values)

---

## Benchmark Methodology

### Statistical Approach

```typescript
function benchmark(name: string, fn: () => void, runs: number = 10): number {
  // 1. Warmup phase (2 runs)
  for (let i = 0; i < 2; i++) fn();
  
  // 2. Measurement phase
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    fn();
    const end = performance.now();
    times.push(end - start);
  }
  
  // 3. Remove outliers (trim top/bottom 10%)
  times.sort((a, b) => a - b);
  const trimmed = times.slice(
    Math.floor(runs * 0.1), 
    Math.floor(runs * 0.9)
  );
  
  // 4. Calculate trimmed mean
  const avg = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
  return avg;
}
```

**Why This Works:**
- **Warmup:** JIT compilation, cache priming
- **Multiple runs:** Reduce variance
- **Outlier removal:** Eliminate GC pauses, OS interrupts
- **Trimmed mean:** More robust than simple average

---

## Performance Insights

### Small vs Large Objects

| Metric | Small (1M) | Large (100k) | Ratio |
|--------|------------|--------------|-------|
| Set throughput | 1,202,352/s | 41,639/s | **29x slower** |
| Get throughput | 1,471,029/s | 1,274,407/s | **1.15x slower** |

**Analysis:**
- **SET:** Large objects have significant serialization/copying overhead
- **GET:** Mostly pointer lookups, less affected by object size
- **Takeaway:** Cache is extremely efficient for reads, even with large objects!

### Event System Overhead

| Configuration | Overhead |
|---------------|----------|
| No events | 0% (baseline) |
| Events enabled, no listeners | **~0%** ⚡ |
| Events enabled, 1 listener | ~37% |

**Optimization Impact:**
- Fast-path check: `if (!this._hasListeners) return;`
- Eliminates event object creation when no listeners
- Zero overhead when events enabled but unused! ✅

### LRU Eviction Performance

- **500k evictions:** 1,458ms
- **Throughput:** 343,008 evictions/sec
- **Cost per eviction:** ~2.9µs

**Why It's Fast:**
1. Doubly-linked list: O(1) tail removal
2. Map deletion: O(1)
3. No array shifting or reordering

---

## Running Benchmarks

```bash
# Comprehensive benchmark (1M operations)
bun run tests/comprehensive.bench.ts

# Core operations (10k operations)
bun run tests/cache.bench.ts

# Expiration strategy comparison
bun run tests/expiration.bench.ts

# Event system micro-benchmark
bun run tests/event-microbench.bench.ts
```

---

## Lessons Learned

1. **Always separate setup from measurement** - Pre-populate caches before timing GET operations
2. **Use statistical methods** - Multiple runs with outlier removal for reliability
3. **Measure what you think you're measuring** - Verify benchmark correctness
4. **Platform-specific APIs** - Don't assume browser APIs work in Bun/Node
5. **Theoretical vs measured memory** - Sometimes calculation is more reliable than measurement
6. **GET should be faster than SET** - If not, your benchmark is probably wrong!

---

## Future Improvements

### Potential Additions
- [ ] Benchmark with concurrent access (multi-threaded)
- [ ] Memory profiling with external tools (valgrind, heaptrack)
- [ ] Comparison with other cache libraries
- [ ] Cache coherency benchmarks
- [ ] Batch operation performance

### Measurement Enhancements
- [ ] Use `Bun.peek.heap()` for Bun-specific memory tracking
- [ ] Flame graphs for hotspot analysis
- [ ] CPU profiling integration
- [ ] Automated regression detection

---

## References

- [Bun Performance API](https://bun.sh/docs/api/performance)
- [V8 Memory Model](https://v8.dev/blog/trash-talk)
- [Statistical Benchmarking Best Practices](https://github.com/nodejs/benchmarking)

---

**Last Updated:** November 9, 2025  
**Bun Version:** 1.3.1
