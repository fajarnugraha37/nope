# Optimization #2: Lazy Expiration Strategy

## Overview
Implemented lazy expiration with batched sweep to avoid O(n) full cache scans on every eviction.

## Problem
The previous implementation used active expiration, which would scan **all entries** in the cache whenever eviction was triggered:
- **100k entries with 80% expired**: 8,077ms to evict
- **10k entries with 50% expired**: 81ms to evict

This made eviction extremely slow when caches had many expired entries.

## Solution
Changed eviction strategy to be lazy + batched:
1. **Lazy Expiration**: Check expiration on `get()` access, return `undefined` if expired
2. **Batched Sweep**: When eviction needed, check up to 10 entries from tail (LRU end)
3. **Background Sweep**: Optional interval-based full sweep (disabled by default for eviction)

This changes eviction from O(n) to O(1) amortized complexity.

## Implementation
```typescript
interface LruTtlOpts<K = any, V = any> {
  // ... existing options
  lazyExpiration?: boolean; // default: true
}

// In evict():
if (this.opts.lazyExpiration) {
  // Check up to 10 entries from tail for expired items
  this.batchedSweep(10);
} else {
  // Old behavior: scan entire cache
  this.sweep();
}

// New helper method:
private batchedSweep(maxChecks: number = 10): number {
  let checked = 0;
  let removed = 0;
  let node = this.tail;
  
  while (node && checked < maxChecks) {
    const next = node.prev;
    if (node.entry.exp != null && node.entry.exp <= now()) {
      this.delete(node.entry.key);
      removed++;
    }
    node = next;
    checked++;
  }
  
  return removed;
}
```

## Performance Results

### Benchmark: Eviction with Expired Entries

| Scenario | BEFORE (Active) | AFTER (Lazy) | Improvement |
|----------|----------------|--------------|-------------|
| 10k entries, 50% expired | 81.30ms | 16.03ms | **5.1x faster** |
| 100k entries, 80% expired | 8,076.99ms | 98.83ms | **81.7x faster** |
| **Average** | **4,079.15ms** | **57.43ms** | **🚀 71.0x faster** |

### Overall Improvement
- **98.6% reduction** in eviction time
- **71x speedup** on average
- Worst case (100k, 80% expired): **8,077ms → 99ms** (81.7x)

### Get Performance
- Get 1k keys with 50% expired: **15.33ms** (checks expiration lazily on access)

## Test Coverage
- ✅ All 47 tests passing
- ✅ Sliding TTL behavior preserved
- ✅ LRU eviction still works correctly
- ✅ Expiration events still fire

## Trade-offs
- **Pro**: Eviction is now O(1) amortized instead of O(n)
- **Pro**: No performance penalty when cache has few expired entries
- **Pro**: Memory gradually freed as expired entries accessed or evicted
- **Con**: Expired entries may stay in memory longer (but removed on access)
- **Con**: Background sweep still needed for completely idle caches (optional)

## Conclusion
This optimization makes the cache **dramatically faster** when dealing with expired entries, especially at scale. The 71x average improvement (81.7x worst case) is achieved by avoiding unnecessary full cache scans and checking expiration only when needed.

Next optimization: #3 Size Estimation (JSON.stringify bottleneck)
