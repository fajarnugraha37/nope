---
"@fajarnugraha37/cache": minor
---

Major performance optimization: Implement doubly-linked list for O(1) LRU operations

**Performance Improvements:**
- 5-13x faster core operations (set/get/delete)
- True O(1) complexity regardless of cache size
- 4.5x faster memory management for large caches (100k+ entries)

**What Changed:**
- Replaced Map-based LRU reordering with doubly-linked list implementation
- Added separate head/tail pointers for efficient MRU/LRU tracking
- Optimized eviction to use direct tail access (O(1) instead of O(n))

**Benchmark Highlights:**
- Set 10k entries: 1,368ms → 113ms (12x faster)
- Get 10k entries: 1,071ms → 112ms (9.5x faster)  
- LRU eviction: 3.4ms → 1.14ms (3x faster)
- Batch operations: 2-7x faster
- Memory efficiency: 4-4.5x faster

**Breaking Changes:** None - fully backward compatible

**Migration:** No changes required. Drop-in replacement with same API.

For detailed analysis, see OPTIMIZATION_RESULTS.md
