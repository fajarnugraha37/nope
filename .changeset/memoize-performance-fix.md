---
"@fajarnugraha37/cache": patch
---

Performance: Optimized memoize to eliminate redundant Map lookups (1.7-2.8x faster)

Fixed performance regression in memoize functions caused by redundant Map lookups after the linked list LRU implementation. 

**Key improvements:**
- Sync memoize: 3.11ms → 1.8ms (1.7x faster)
- Async memoize: 6.39ms → 2.3ms (2.8x faster)
- Cache overhead: 0.86ms → 0.26ms (3.3x faster)
- 73-179% throughput increase

**What was fixed:**
The memoize hot path was calling `peekEntry()` to check expiration, then unnecessarily calling `get()` again, resulting in 2-3 Map lookups per cache hit. Simplified logic to use single lookup when possible.

**Impact:**
Memoization is now faster than before the linked list optimization, with minimal overhead on top of direct function calls.

No breaking changes. All 47 tests passing. For details, see OPTIMIZATION_RESULTS_3.md
