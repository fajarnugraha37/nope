# Optimization #10: Memory Allocation - Baseline Measurements

## Overview
Baseline measurements of current memory allocation patterns using Bun's official `bun:jsc` heapStats API.

**Date:** November 9, 2025  
**Measurement Method:** `heapStats()` from `bun:jsc` + `Bun.gc(true)` for forced GC  
**Test Environment:** Bun v1.3.1

---

## Test Results

### Test 1: 500k Entries - Object Creation Overhead

**Configuration:**
- Cache size: 500,000 entries
- Entry size: ~120 bytes (id + 50-char string)
- Test operations: populate, access (50k), update (50k)

**Memory Metrics:**
```
Baseline Memory:
  Heap Size: 0.47 MB
  Object Count: 4,984

After Population (500k entries):
  Heap Size: 166.41 MB (+165.94 MB)
  Object Count: 2,505,161 (+2,500,177 objects)
  Memory per Entry: 0.34 KB
  
Memory Changes:
  After 50k Access: +0.04 MB
  After 50k Update: +0.09 MB
  After Clear: -165.87 MB (99.9% recovery)
```

**Performance Metrics:**
```
Throughput:
  Populate: 837,316 ops/sec
  Access: 914,363 ops/sec
  Update: 554,002 ops/sec
```

**GC Metrics:**
```
GC Count: 8 cycles
GC Duration: 305.65ms total
Avg GC Time: 42.80ms per cycle
GC Overhead: ~43% (estimated based on total time)
```

**Object Structure Analysis:**
```
Entry<V>: ~64 bytes overhead (object header + fields)
LRUNode<K, V>: ~64 bytes overhead (object header + fields)
Map overhead: ~8-16 bytes per entry
Total overhead: ~144-160 bytes per cache entry
```

---

### Test 2: 1M Entries - Memory Allocation Patterns

**Configuration:**
- Cache size: 1,000,000 entries
- Snapshots taken every 200k entries

**Memory Growth Pattern:**
```
Baseline: 0.66 MB

Progress:
  200k entries: 69.43 MB (2 GCs, 45ms)
  400k entries: 139.03 MB (4 GCs, 115ms)
  600k entries: 192.63 MB (6 GCs, 198ms)
  800k entries: 278.22 MB (8 GCs, 311ms)
  1M entries: 331.82 MB (10 GCs, 439ms)

Memory per 200k increment:
  0 → 200k: 69.43 MB (0.71 KB/entry)
  200k → 400k: +69.60 MB (0.71 KB/entry)
  400k → 600k: +53.60 MB (0.55 KB/entry)
  600k → 800k: +85.60 MB (0.88 KB/entry)
  800k → 1M: +53.60 MB (0.55 KB/entry)
```

**Final Metrics:**
```
Total Memory: 331.82 MB
Memory per Entry: 0.34 KB
Throughput: 519,901 ops/sec
```

**GC Metrics:**
```
Total GC Count: 12 cycles
Total GC Time: 547.68ms
GC Overhead: 34.39% 🔴
GC Frequency: 7.28 GCs/sec
Avg GC Duration: 45.64ms
```

---

### Test 3: Rapid Churn - Allocation Pressure

**Configuration:**
- Cache size: 50,000 entries (fixed)
- Operations: 500,000 (10x cache size)
- Pattern: Continuous eviction due to LRU

**Memory Stability:**
```
Baseline: 0.71 MB

Progress (every 50k ops):
  50k: 17.33 MB (2 GCs)
  100k: 21.37 MB (4 GCs)
  150k: 21.47 MB (6 GCs)
  200k-500k: 21.47 MB stable (8-20 GCs)

Memory Range:
  Min: 17.33 MB
  Avg: 21.05 MB
  Max: 21.47 MB
  Range: 4.14 MB (19.0% variation)
```

**Performance:**
```
Throughput: 573,954 ops/sec
Final Cache Size: 50,000 (as expected)
```

**GC Under Pressure:**
```
Total GC Count: 22 cycles
Total GC Time: 228.84ms
GC Overhead: 26.27% 🔴 HIGH
GC Frequency: 25.25 GCs/sec
Avg GC Duration: 10.40ms
```

**Assessment:** 🔴 **High GC overhead - optimization needed**

---

## Summary of Issues

### 1. High GC Overhead
- **26-34% of execution time** spent in garbage collection
- GC frequency ranges from 7.28 to 25.25 GCs/sec
- Every GC cycle takes 10-46ms on average

### 2. Object Allocation Overhead
- **2.5M objects created** for 500k cache entries (~5 objects per entry)
- **144-160 bytes overhead** per cache entry (excluding key/value data)
- Nested object structure (Entry + LRUNode) adds object headers

### 3. Memory Growth Patterns
- Non-linear memory growth (0.55-0.88 KB/entry variation)
- Indicates memory fragmentation and inefficient allocation
- High allocation pressure triggers frequent GC cycles

### 4. Allocation Churn
- Under rapid churn (10x cache size), GC overhead reaches **26.27%**
- 22 GC cycles in 871ms = extremely high GC frequency
- Memory stabilizes but with high GC cost

---

## Optimization Targets

Based on baseline measurements, targeting:

| Metric | Baseline | Target | Expected Improvement |
|--------|----------|--------|---------------------|
| Memory/Entry | 0.34 KB | 0.17-0.24 KB | -30-50% |
| GC Overhead | 26-34% | 10-15% | -40-60% |
| GC Frequency | 7-25 GCs/sec | 3-10 GCs/sec | -40-60% |
| GC Duration | 10-46ms | 5-20ms | -30-40% |
| Object Count | 5 per entry | 2-3 per entry | -40-60% |
| Throughput | 520-837k ops/sec | 650-1050k ops/sec | +20-30% |

---

## Proposed Solutions

### 1. Object Pooling
- Reuse Entry and LRUNode objects instead of creating new ones
- Expected: -50-70% allocation rate, -30-40% GC pressure

### 2. Flat Array Structure
- Store Entry fields in separate arrays instead of nested objects
- Expected: Save ~32 bytes/entry (object header), better memory locality

### 3. Typed Arrays for Metadata
- Use Float64Array for timestamps (exp, sl, t) and size (sz)
- Expected: ~20 bytes savings/entry, improved cache performance

### 4. String Interning
- Deduplicate common key patterns using WeakMap
- Expected: 20-50% savings for pattern-based keys

### 5. Preallocated Slots
- Reserve memory upfront for maxEntries capacity
- Expected: Reduced allocation overhead, better memory locality

---

## Next Steps

1. ✅ Establish baseline measurements
2. ⏳ Implement object pooling (EntryPool, LRUNodePool)
3. ⏳ Add flat array structure for Entry fields
4. ⏳ Implement typed arrays for numeric metadata
5. ⏳ Add string interning for keys
6. ⏳ Implement preallocated slots
7. ⏳ Run comparison benchmarks
8. ⏳ Document improvements and create migration guide
