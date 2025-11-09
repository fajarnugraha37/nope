# Cache Package Enhancements

## Overview
This document describes the new features added to `@fajarnugraha37/cache` to improve developer experience, extensibility, flexibility, and ease of use.

## New Features

### 1. Statistics Tracking (`CacheStatistics`)
**File:** `src/cache-stats.ts`

Provides comprehensive metrics for cache performance analysis:
- **Hit/Miss Tracking:** Monitor cache effectiveness
- **Operation Counters:** Track sets, deletes, and evictions
- **Size Metrics:** Current size and average size over time
- **Calculated Metrics:** Hit rate, miss rate automatically computed

**Usage:**
```ts
const cache = new LruTtlCache({ maxEntries: 100, enableStats: true });
const stats = cache.getStats();
console.log(stats.getMetrics()); // { hitRate, missRate, avgSizeOverTime }
cache.resetStats(); // Reset all counters
```

### 2. Event System (`CacheEventEmitter`)
**File:** `src/cache-events.ts`

Observable cache operations for monitoring and debugging:
- **Event Types:** `hit`, `miss`, `set`, `delete`, `evict`, `expire`, `clear`
- **Wildcard Support:** Listen to all events with `*`
- **Listener Management:** `on()`, `once()`, `off()` methods
- **Unsubscribe Functions:** All listeners return cleanup functions

**Usage:**
```ts
const cache = new LruTtlCache({ maxEntries: 100, enableEvents: true });
cache.on('evict', ({ key, value, reason }) => {
  console.log(`Evicted ${key} due to ${reason}`);
});
cache.on('*', (event, data) => console.log(event, data));
```

### 3. Batch Operations (`withBatchOperations`)
**File:** `src/cache-utils.ts`

Efficient bulk operations for performance optimization:
- **`getMany(keys[])`** – Retrieve multiple values at once
- **`setMany(entries[])`** – Set multiple key-value pairs
- **`deleteMany(keys[])`** – Delete multiple keys, returns count
- **`hasMany(keys[])`** – Check existence of multiple keys

**Usage:**
```ts
const batchCache = withBatchOperations(cache);
const values = batchCache.getMany(['key1', 'key2']);
batchCache.setMany([
  { key: 'a', value: 1 },
  { key: 'b', value: 2, ttlMs: 1000 }
]);
```

### 4. Namespaced Caches (`createNamespace`)
**File:** `src/cache-utils.ts`

Key isolation for multi-tenant applications:
- **Key Prefixing:** Automatic namespace:key format
- **Custom Separators:** Configurable delimiter
- **Independent Operations:** Each namespace operates in isolation
- **Shared Storage:** All namespaces use the same underlying cache

**Usage:**
```ts
const tenant1 = createNamespace(cache, 'tenant1');
const tenant2 = createNamespace(cache, 'tenant2');
tenant1.set('user', { name: 'Alice' }); // Stored as 'tenant1:user'
tenant2.set('user', { name: 'Bob' });   // Stored as 'tenant2:user'
```

### 5. Cache Warming (`warmCache`)
**File:** `src/cache-utils.ts`

Preload frequently accessed data:
- **Async/Sync Loaders:** Support both function types
- **Batch Loading:** Load multiple entries at once
- **TTL Support:** Apply TTL to all warmed entries
- **Entry Format:** `{ key, value }` array structure

**Usage:**
```ts
await warmCache(cache, async () => {
  const users = await fetchFrequentUsers();
  return users.map(user => ({ key: user.id, value: user }));
}, { ttlMs: 3600_000 });
```

### 6. Transform Caches (`TransformCache`)
**File:** `src/cache-utils.ts`

Type transformation and serialization:
- **Bidirectional Transforms:** Serialize on set, deserialize on get
- **Type Safety:** Generic type parameters for input/output types
- **Flexible Use Cases:** JSON serialization, compression, encryption
- **Transparent Operations:** Works with all cache methods

**Usage:**
```ts
const objectCache = new TransformCache(
  cache,
  (obj) => JSON.stringify(obj),  // serialize
  (str) => JSON.parse(str)        // deserialize
);
objectCache.set('config', { theme: 'dark' });
```

## Integration & Composition

All features are designed to work together:

```ts
// Base cache with observability
const baseCache = new LruTtlCache({
  maxEntries: 1000,
  enableStats: true,
  enableEvents: true
});

// Add batch operations
const batchCache = withBatchOperations(baseCache);

// Create isolated namespace
const tenantCache = createNamespace(batchCache, 'tenant:123');

// Add JSON transformation
const objectCache = new TransformCache(
  tenantCache,
  JSON.stringify,
  JSON.parse
);

// Monitor and use
baseCache.on('evict', ({ key }) => console.log('Evicted:', key));
objectCache.set('data', { value: 42 });
console.log(baseCache.getStats().getMetrics().hitRate);
```

## Test Coverage

**47 tests total** (30 new tests for enhancements)
- **Statistics:** 4 tests
- **Events:** 9 tests
- **Batch Operations:** 6 tests
- **Namespacing:** 3 tests
- **Cache Warming:** 3 tests
- **Transform Caches:** 3 tests
- **Integration:** 2 tests

**Coverage:**
- 90.49% function coverage
- 98.27% line coverage

## Design Principles

1. **Opt-in Features:** Statistics and events must be explicitly enabled (`enableStats`, `enableEvents`)
2. **Composition Over Inheritance:** Use wrapper functions for extending functionality
3. **Type Safety:** Full TypeScript generics throughout
4. **Zero Breaking Changes:** All existing code continues to work unchanged
5. **Performance:** Minimal overhead when features are disabled
6. **Developer Experience:** Clear APIs with intuitive method names

## Files Modified/Created

**New Files:**
- `src/cache-stats.ts` – Statistics tracking implementation
- `src/cache-events.ts` – Event emission system
- `src/cache-utils.ts` – Batch operations, namespacing, warming, transformation
- `tests/cache-enhancements.test.ts` – Comprehensive test suite

**Modified Files:**
- `src/cache.ts` – Added statistics and event emission to LruTtlCache
- `src/index.ts` – Exported new modules
- `README.md` – Added documentation for all new features

## Future Enhancements

Potential additions for future:
- Cache compression strategies
- Distributed cache synchronization
- Persistence adapters (Redis, file system)
- Query-based invalidation
- Cache hierarchies (L1/L2)
- Metrics export to monitoring systems
