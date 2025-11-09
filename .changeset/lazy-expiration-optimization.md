---
"@fajarnugraha37/cache": patch
---

Performance: Lazy expiration strategy (71x faster eviction)

Implemented lazy expiration with batched sweep to avoid O(n) full cache scans on every eviction. This optimization delivers dramatic performance improvements when caches have expired entries:

**Key improvements:**
- 71x average speedup on eviction with expired entries (98.6% reduction)
- 100k entries with 80% expired: 8,077ms → 99ms (81.7x faster)
- 10k entries with 50% expired: 81ms → 16ms (5.1x faster)

**How it works:**
- Lazy expiration: Check expiration on `get()` access
- Batched sweep: Check up to 10 entries from tail on eviction
- O(1) amortized complexity instead of O(n)

**Configuration:**
```ts
new LruTtlCache({
  lazyExpiration: true // default, enables batched sweep
})
```

No breaking changes. All 47 tests passing. For details, see OPTIMIZATION_RESULTS_2.md
