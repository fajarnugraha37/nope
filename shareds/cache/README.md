# @fajarnugraha37/cache# @fajarnugraha37/cache



[![npm version](https://img.shields.io/npm/v/@fajarnugraha37/cache.svg)](https://www.npmjs.com/package/@fajarnugraha37/cache)[![npm version](https://img.shields.io/npm/v/@fajarnugraha37/cache.svg)](https://www.npmjs.com/package/@fajarnugraha37/cache)

[![Coverage](https://img.shields.io/badge/coverage-90.49%25%20functions%20%7C%2098.27%25%20lines-brightgreen)]()

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)]()> Caching primitives (LRU, TTL, stale-while-revalidate, singleflight) and memoization helpers shared by `@fajarnugraha37/validator` and `@fajarnugraha37/expression`.



> High-performance in-memory caching primitives (LRU, TTL, stale-while-revalidate, singleflight) with observability features for modern TypeScript applications.## Installation



## Table of Contents```bash

# Node.js with npm

1. [Installation](#installation)npm install @fajarnugraha37/cache

2. [Why in-memory cache?](#why-in-memory-cache)

3. [Quick start](#quick-start)# Node.js with pnpm

4. [Core concepts](#core-concepts)pnpm add @fajarnugraha37/cache

5. [Usage catalog](#usage-catalog)

6. [Advanced features](#advanced-features)# Node.js with yarn

7. [Cookbook](#cookbook)yarn add @fajarnugraha37/cache

8. [API reference](#api-reference)

9. [FAQ & troubleshooting](#faq--troubleshooting)# Bun

bun add @fajarnugraha37/cache

---

# Deno

## Installationdeno add npm:@fajarnugraha37/cache

```

```bash

# Node.js with npm## Components

npm install @fajarnugraha37/cache

### Core Cache

# Node.js with pnpm- **`LruTtlCache<K, V>`** – in-memory cache with max entries, size-based eviction, TTL + sliding TTL, background sweepers, and metrics (`size()`, `total()`). Now supports statistics tracking and event emission for observability.

pnpm add @fajarnugraha37/cache- **`jsonSizer`** – naive size estimator used by the cache or memoizer when you do not provide one.

- **`Singleflight`** – deduplicates concurrent lookups per key (fan-in/fan-out pattern).

# Node.js with yarn

yarn add @fajarnugraha37/cache### Observability & Metrics

- **`CacheStatistics`** – tracks hit/miss rates, eviction counts, set/delete operations, and size metrics

# Bun- **`CacheEventEmitter`** – event system for cache operations (hit, miss, set, delete, evict, clear, expire)

bun add @fajarnugraha37/cache- **`getStats()`** / **`resetStats()`** – access and reset cache metrics on `LruTtlCache`

- **`on()` / **`once()` / **`off()`** – event listener methods for observing cache behavior

# Deno

deno add npm:@fajarnugraha37/cache### Advanced Patterns

```- **`IdempotencyCache`** – caches promise results for the lifetime of an idempotency window.

- **`KeyedLock`** – lightweight async mutex keyed by user-defined ids.

---- **`LoadingCache`** – composes an underlying cache with an async loader; supports TTL, stale-while-revalidate, jitter, and manual invalidation.

- **`createReadThrough`** – helper that returns a `ReadThrough` wrapper around a loader + `LruTtlCache`.

## Why in-memory cache?- **`memoize`** – wraps sync or async functions with TTL, sliding TTL, max entries, stale-while-revalidate, jitter, optional error caching, and pluggable keyers.



In-memory caching dramatically improves application performance by:### Utilities

- **`withBatchOperations()`** – adds `getMany()`, `setMany()`, `deleteMany()`, `hasMany()` for bulk operations

- **Reducing latency** – Fetch data from RAM (nanoseconds) instead of disk or network (milliseconds)- **`createNamespace()`** – creates a namespaced cache with key prefixing for multi-tenant scenarios

- **Lowering database load** – Decrease expensive database queries by 70-90%- **`warmCache()`** – preloads data into cache from a loader function

- **Improving scalability** – Handle more requests with same infrastructure- **`TransformCache`** – wraps a cache with serialization/deserialization transformations

- **Cost efficiency** – Reduce cloud costs by minimizing external API calls

Utility exports (`now`, `sleep`) round out the toolkit.

### When to use this library

## Usage

✅ **Perfect for:**

- Caching API responses, database queries, computed results```ts

- Rate limiting and request deduplicationimport {

- Memoizing expensive function calls  LruTtlCache,

- Temporary session data and user preferences  LoadingCache,

- Microservices with high-frequency lookups  memoize,

  createReadThrough,

❌ **Not recommended for:**  KeyedLock,

- Data that must persist across restarts  Singleflight,

- Multi-server cache synchronization (use Redis instead)  sleep,

- Caches larger than available RAM} from "@fajarnugraha37/cache";



### Performance Characteristics// LRU + TTL cache

const cache = new LruTtlCache<string, number>({

Based on benchmarks with 10k operations (Bun 1.3.1):  maxEntries: 100,

  ttlMs: 5_000,

| Operation | Time | Throughput |  slidingTtlMs: 5_000,

|-----------|------|------------|});

| Set (basic) | ~1.4s | ~7,100 ops/sec |

| Get (hit) | ~1.1s | ~9,300 ops/sec |cache.set("answer", 42);

| Get (miss) | ~1.6ms | ~625,000 ops/sec |await sleep(10);

| Batch set 1k | ~12ms | ~83,000 ops/sec |console.log(cache.get("answer"));

| With stats | ~1.1s | ~9,400 ops/sec |

| With events | ~1.1s | ~9,000 ops/sec |// Loading cache with stale-while-revalidate

const store = new LruTtlCache<string, number>();

**Full benchmarks:** See [Performance Benchmarks](#performance-benchmarks) sectionconst loader = new LoadingCache(store, async (key) => key.length);



---console.log(await loader.get("alpha", { ttlMs: 1_000, staleWhileRevalidateMs: 5_000 }));



## Quick start// Memoize async work with jitter + SWR

const fetchUser = memoize(

### Basic caching  async (id: string) => {

    const res = await fetch(`/users/${id}`);

```ts    if (!res.ok) throw new Error("request failed");

import { LruTtlCache } from "@fajarnugraha37/cache";    return res.json();

  },

// Create a cache with 1000 entries max  { ttlMs: 30_000, swrMs: 60_000, jitter: 0.2 }

const cache = new LruTtlCache<string, any>({);

  maxEntries: 1000,

});await fetchUser("42"); // network hit

await fetchUser("42"); // cached and refreshed in the background

// Set and get values

cache.set("user:123", { name: "Alice", age: 30 });// Read-through helper

const user = cache.get("user:123");const readThrough = createReadThrough(async (sku: string) => {

  return await loadFromDatabase(sku);

// Set with TTL (expires in 5 seconds)}, { ttlMs: 2_000 });

cache.set("session:abc", { token: "xyz" }, { ttlMs: 5000 });

await readThrough.get("sku-1");

// Check existence

if (cache.has("user:123")) {// Serialize expensive jobs with Singleflight + KeyedLock

  console.log("User found in cache");const sf = new Singleflight<string, any>();

}const lock = new KeyedLock<string>();



// Remove entryasync function compute(key: string) {

cache.del("user:123");  const release = await lock.acquire(key);

  try {

// Clear all    return await sf.do(key, () => actuallyCompute(key));

cache.clear();  } finally {

```    release();

  }

### Async loading with stale-while-revalidate}

```

```ts

import { LruTtlCache, LoadingCache } from "@fajarnugraha37/cache";`@fajarnugraha37/validator` uses these primitives to memoize AJV validators, while `@fajarnugraha37/expression` caches compiled json-logic functions.



const store = new LruTtlCache<string, User>();### Advanced Features

const loader = new LoadingCache(store, async (userId: string) => {

  return await fetchUserFromDatabase(userId);#### Statistics & Metrics

});

Track cache performance with built-in statistics:

// First call: fetches from database

const user = await loader.get("123", { ```ts

  ttlMs: 30_000,                  // Cache for 30 secondsimport { LruTtlCache } from "@fajarnugraha37/cache";

  staleWhileRevalidateMs: 60_000  // Serve stale for 1 minute while refreshing

});const cache = new LruTtlCache<string, number>({

  maxEntries: 100,

// Second call within 30s: returns cached value instantly  enableStats: true, // Enable statistics tracking

const sameUser = await loader.get("123", { ttlMs: 30_000 });});



// Call after 30s but within 90s: returns stale data instantly + refreshes in backgroundcache.set("key1", 100);

const staleUser = await loader.get("123", { ttlMs: 30_000, staleWhileRevalidateMs: 60_000 });cache.get("key1"); // Hit

```cache.get("key2"); // Miss



### Function memoizationconst stats = cache.getStats();

console.log(stats);

```ts// {

import { memoize } from "@fajarnugraha37/cache";//   hits: 1,

//   misses: 1,

// Memoize expensive computation//   sets: 1,

const fibonacci = memoize((n: number): number => {//   deletes: 0,

  if (n <= 1) return n;//   evictions: 0,

  return fibonacci(n - 1) + fibonacci(n - 2);//   currentSize: 1

}, { ttlMs: 60_000 });// }



fibonacci(40); // Computedconst metrics = stats.getMetrics();

fibonacci(40); // Cached (instant)console.log(metrics);

// {

// Memoize async API calls//   hitRate: 0.5,

const fetchUser = memoize(//   missRate: 0.5,

  async (id: string) => {//   avgSizeOverTime: 1

    const res = await fetch(`/api/users/${id}`);// }

    return res.json();

  },cache.resetStats(); // Reset all statistics

  { ```

    ttlMs: 30_000,

    swrMs: 60_000,  // Stale-while-revalidate#### Event Monitoring

    jitter: 0.1     // Add 10% random jitter to TTL

  }Listen to cache events for debugging and monitoring:

);

``````ts

import { LruTtlCache } from "@fajarnugraha37/cache";

---

const cache = new LruTtlCache<string, number>({

## Core concepts  maxEntries: 100,

  enableEvents: true, // Enable event emission

### LRU (Least Recently Used)});



When cache is full, evicts the **least recently accessed** entry. Keeps hot data in memory.// Listen to specific events

cache.on("hit", ({ key, value }) => {

```ts  console.log(`Cache hit for ${key}:`, value);

const cache = new LruTtlCache<string, number>({ maxEntries: 3 });});

cache.set("a", 1);

cache.set("b", 2);cache.on("miss", ({ key }) => {

cache.set("c", 3);  console.log(`Cache miss for ${key}`);

cache.get("a"); // Access 'a' (moves to end)});

cache.set("d", 4); // 'b' is evicted (least recently used)

```cache.on("evict", ({ key, value, reason }) => {

  console.log(`Evicted ${key} due to ${reason}`);

### TTL (Time To Live)});



Entries expire after a fixed duration. Perfect for time-sensitive data.// Listen to all events with wildcard

cache.on("*", (event, data) => {

```ts  console.log(`Event: ${event}`, data);

cache.set("otp", "123456", { ttlMs: 60_000 }); // Expires in 1 minute});

```

// One-time event listener

### Sliding TTLconst unsubscribe = cache.once("set", ({ key, value }) => {

  console.log("First set operation:", key, value);

Expiry extends on each access. Keeps active data cached longer.});



```ts// Remove event listener

const cache = new LruTtlCache({cache.off("hit", listenerFn);

  maxEntries: 100,```

});

cache.set("session", userData, { slidingTtlMs: 300_000 }); // 5 minutes#### Batch Operations

cache.get("session"); // Resets TTL to 5 minutes from now

```Perform bulk operations efficiently:



### Stale-While-Revalidate (SWR)```ts

import { LruTtlCache, withBatchOperations } from "@fajarnugraha37/cache";

Serves stale data instantly while refreshing in background. Best of both worlds: speed + freshness.

const cache = new LruTtlCache<string, number>({ maxEntries: 100 });

```tsconst batchCache = withBatchOperations(cache);

const loader = new LoadingCache(store, async (key) => await fetchData(key));

await loader.get("key", { ttlMs: 10_000, staleWhileRevalidateMs: 30_000 });// Get multiple values at once

// After 10s: returns stale data + triggers refreshconst values = batchCache.getMany(["key1", "key2", "key3"]);

// After 40s: returns fresh dataconsole.log(values); // Map { 'key1' => 100, 'key2' => 200 }

```

// Set multiple values

### SingleflightbatchCache.setMany([

  { key: "a", value: 1 },

Deduplicates concurrent requests for the same key. Prevents cache stampede.  { key: "b", value: 2, ttlMs: 1000 },

]);

```ts

import { Singleflight } from "@fajarnugraha37/cache";// Check multiple keys

const exists = batchCache.hasMany(["a", "b", "c"]);

const sf = new Singleflight<string, Data>();console.log(exists); // Map { 'a' => true, 'b' => true, 'c' => false }

// 100 concurrent requests for same key → only 1 actual fetch

const results = await Promise.all(// Delete multiple keys

  Array.from({ length: 100 }, () =>const deleted = batchCache.deleteMany(["a", "b"]);

    sf.do("user:1", () => fetchExpensiveData())console.log(deleted); // 2

  )```

);

```#### Namespaced Caches



---Isolate cache entries by namespace for multi-tenant scenarios:



## Usage catalog```ts

import { LruTtlCache, createNamespace } from "@fajarnugraha37/cache";

### 1. Basic key-value caching

const cache = new LruTtlCache<string, any>({ maxEntries: 1000 });

```ts

import { LruTtlCache } from "@fajarnugraha37/cache";const tenant1 = createNamespace(cache, "tenant1");

const tenant2 = createNamespace(cache, "tenant2");

const cache = new LruTtlCache<string, any>({ maxEntries: 1000 });

cache.set("config", { theme: "dark" });tenant1.set("user:1", { name: "Alice" });

const config = cache.get("config");tenant2.set("user:1", { name: "Bob" });

```

console.log(tenant1.get("user:1")); // { name: "Alice" }

### 2. Cache with size-based evictionconsole.log(tenant2.get("user:1")); // { name: "Bob" }



```ts// Namespaces are isolated

const cache = new LruTtlCache<string, Buffer>({tenant1.clear(); // Only clears tenant1's entries

  maxSize: 10_000_000, // 10 MBconsole.log(tenant2.get("user:1")); // Still { name: "Bob" }

  sizer: (buf) => buf.length```

});

cache.set("file1", buffer1);#### Cache Warming

```

Preload frequently accessed data into cache:

### 3. Automatic expiry with background sweeper

```ts

```tsimport { LruTtlCache, warmCache } from "@fajarnugraha37/cache";

const cache = new LruTtlCache({

  maxEntries: 1000,const cache = new LruTtlCache<string, User>({ maxEntries: 100 });

  sweepIntervalMs: 10_000 // Clean expired entries every 10 seconds

});// Warm cache with frequently accessed users

```await warmCache(

  cache,

### 4. Loading cache with SWR  async () => {

    const users = await fetchFrequentUsers();

```ts    return users.map((user) => ({ key: user.id, value: user }));

import { LruTtlCache, LoadingCache } from "@fajarnugraha37/cache";  },

  { ttlMs: 3600_000 } // 1 hour TTL

const store = new LruTtlCache<string, Product>(););

const loader = new LoadingCache(store, async (sku) => {

  return await database.products.findOne({ sku });// Cache is now preloaded

});console.log(cache.size()); // 50+ entries ready

```

const product = await loader.get("SKU-123", { 

  ttlMs: 60_000,#### Transform Caches

  staleWhileRevalidateMs: 120_000

});Add serialization/deserialization for complex data types:

```

```ts

### 5. Memoize with error cachingimport { LruTtlCache, TransformCache } from "@fajarnugraha37/cache";



```tsconst cache = new LruTtlCache<string, string>({ maxEntries: 100 });

const fetchUser = memoize(

  async (id: string) => {// Create a transform cache for storing objects as JSON strings

    const res = await fetch(`/api/users/${id}`);const objectCache = new TransformCache(

    if (!res.ok) throw new Error("Not found");  cache,

    return res.json();  (obj) => JSON.stringify(obj), // serialize

  },  (str) => JSON.parse(str) // deserialize

  {);

    ttlMs: 30_000,

    cacheErrors: true, // Cache errors to prevent retry stormsobjectCache.set("user", { id: 1, name: "Alice" });

    errorTtlMs: 5_000  // Cache errors for shorter durationconsole.log(objectCache.get("user")); // { id: 1, name: "Alice" }

  }

);// Underlying cache stores JSON strings

```console.log(cache.get("user")); // '{"id":1,"name":"Alice"}'

```

### 6. Idempotency cache (request deduplication)

#### Combining Features

```ts

import { IdempotencyCache } from "@fajarnugraha37/cache";All features can be combined for powerful caching strategies:



const cache = new IdempotencyCache<string, Result>(60_000); // 1 minute window```ts

import {

// Multiple identical requests → single execution  LruTtlCache,

await cache.execute("payment:123", async () => {  withBatchOperations,

  return await processPayment(123);  createNamespace,

});  TransformCache,

```} from "@fajarnugraha37/cache";



### 7. Keyed lock (per-key mutual exclusion)// Base cache with statistics and events

const baseCache = new LruTtlCache<string, string>({

```ts  maxEntries: 1000,

import { KeyedLock } from "@fajarnugraha37/cache";  enableStats: true,

  enableEvents: true,

const lock = new KeyedLock<string>();});



async function updateUser(userId: string) {// Add batch operations

  const release = await lock.acquire(userId);const batchCache = withBatchOperations(baseCache);

  try {

    // Critical section: only one update per user at a time// Create namespaced cache for tenant isolation

    await database.users.update(userId, data);const tenantCache = createNamespace(batchCache, "tenant:123");

  } finally {

    release();// Add JSON transformation

  }const objectCache = new TransformCache(

}  tenantCache,

```  (obj) => JSON.stringify(obj),

  (str) => JSON.parse(str)

### 8. Read-through cache);



```ts// Monitor performance

import { createReadThrough } from "@fajarnugraha37/cache";baseCache.on("evict", ({ key, reason }) => {

  console.log(`Evicted ${key}: ${reason}`);

const cache = createReadThrough(});

  async (productId: string) => {

    return await database.products.findById(productId);// Use the fully-featured cache

  },objectCache.set("config", { theme: "dark", lang: "en" });

  { ttlMs: 60_000 }const config = objectCache.get("config");

);console.log(baseCache.getStats().getMetrics().hitRate);

```

const product = await cache.get("prod-123");

```## Scripts



### 9. Batch operations| Command | Description |

| --- | --- |

```ts| `bun run build` | Compile ESM/CJS bundles. |

import { LruTtlCache, withBatchOperations } from "@fajarnugraha37/cache";| `bun run test` | Run `tests/cache.test.ts`. |

| `bun run test:watch` | Watch mode. |

const cache = new LruTtlCache<string, number>({ maxEntries: 1000 });| `bun run coverage:view` | Open the coverage report. |

const batchCache = withBatchOperations(cache);

Drop-in replacements: if you already use another cache, the API is simple enough to adapt—`LruTtlCache` implements the `Cache<K, V>` interface exported from `src/cache.ts`.

// Get multiple values at once
const values = batchCache.getMany(["key1", "key2", "key3"]);

// Set multiple values
batchCache.setMany([
  ["key1", 100],
  ["key2", 200],
  ["key3", 300]
]);

// Delete multiple
batchCache.deleteMany(["key1", "key2"]);

// Check multiple
const exists = batchCache.hasMany(["key1", "key2", "key3"]);
```

### 10. Namespaced caches (multi-tenancy)

```ts
import { LruTtlCache, createNamespace } from "@fajarnugraha37/cache";

const cache = new LruTtlCache<string, any>({ maxEntries: 10_000 });

const tenant1 = createNamespace(cache, "tenant1");
const tenant2 = createNamespace(cache, "tenant2");

tenant1.set("user:1", { name: "Alice" }); // Stored as "tenant1:user:1"
tenant2.set("user:1", { name: "Bob" });   // Stored as "tenant2:user:1"

tenant1.clear(); // Only clears tenant1's data
```

---

## Advanced features

### Statistics tracking

Monitor cache performance with built-in metrics:

```ts
const cache = new LruTtlCache<string, number>({
  maxEntries: 1000,
  enableStats: true // Enable statistics
});

cache.set("key1", 100);
cache.get("key1"); // Hit
cache.get("key2"); // Miss

const stats = cache.getStats();
console.log(stats);
// {
//   hits: 1,
//   misses: 1,
//   sets: 1,
//   deletes: 0,
//   evictions: 0,
//   size: 1,
//   totalSize: 3,
//   hitRate: 0.5,
//   missRate: 0.5,
//   avgSize: 3
// }

cache.resetStats(); // Reset counters
```

### Event monitoring

Listen to cache events for debugging and observability:

```ts
const cache = new LruTtlCache<string, number>({
  maxEntries: 100,
  enableEvents: true // Enable event emission
});

// Listen to specific events
cache.on("hit", ({ key, value, timestamp }) => {
  console.log(`Cache hit: ${key} at ${timestamp}`);
});

cache.on("miss", ({ key, timestamp, reason }) => {
  console.log(`Cache miss: ${key}, reason: ${reason}`);
});

cache.on("evict", ({ key, value, reason }) => {
  console.log(`Evicted ${key} due to ${reason}`);
});

cache.on("expire", ({ key, value }) => {
  console.log(`Expired ${key}`);
});

// Wildcard listener (all events)
cache.on("*", (eventType, data) => {
  console.log(`Event: ${eventType}`, data);
});

// One-time listener
cache.once("set", ({ key, value }) => {
  console.log("First set operation");
});

// Remove listener
const unsubscribe = cache.on("hit", handler);
unsubscribe(); // or cache.off("hit", handler);
```

**Available events:**
- `hit` – Cache hit occurred
- `miss` – Cache miss occurred
- `set` – Entry was set
- `delete` – Entry was deleted
- `evict` – Entry was evicted (LRU/size limit)
- `expire` – Entry expired (TTL)
- `clear` – Cache was cleared
- `*` – Wildcard (all events)

### Cache warming

Preload frequently accessed data on startup:

```ts
import { warmCache } from "@fajarnugraha37/cache";

const cache = new LruTtlCache<string, Product>({ maxEntries: 1000 });

// Warm cache with top products
await warmCache(
  cache,
  async () => {
    const products = await database.products.findTopSellers();
    return products.map(p => [p.id, p] as [string, Product]);
  },
  { ttlMs: 3600_000 } // Cache for 1 hour
);

console.log(`Warmed cache with ${cache.size()} entries`);
```

### Transform caches (serialization)

Store complex types with automatic serialization:

```ts
import { TransformCache } from "@fajarnugraha37/cache";

const cache = new LruTtlCache<string, string>({ maxEntries: 100 });

// JSON transform cache
const objectCache = new TransformCache(
  cache,
  (obj) => JSON.stringify(obj),  // serialize
  (str) => JSON.parse(str)        // deserialize
);

objectCache.set("user", { id: 1, name: "Alice" });
const user = objectCache.get("user"); // Returns object, not string

// Custom transform (e.g., compression)
const compressedCache = new TransformCache(
  cache,
  (data) => compress(data),
  (data) => decompress(data)
);
```

### Composing features

All features can be combined:

```ts
import {
  LruTtlCache,
  withBatchOperations,
  createNamespace,
  TransformCache
} from "@fajarnugraha37/cache";

// Base cache with observability
const baseCache = new LruTtlCache<string, string>({
  maxEntries: 10_000,
  enableStats: true,
  enableEvents: true
});

// Add batch operations
const batchCache = withBatchOperations(baseCache);

// Create tenant-isolated namespace
const tenantCache = createNamespace(batchCache, "tenant:123");

// Add JSON transformation
const objectCache = new TransformCache(
  tenantCache,
  JSON.stringify,
  JSON.parse
);

// Monitor and use
baseCache.on("evict", ({ key }) => logger.warn(`Evicted: ${key}`));
objectCache.set("config", { setting: "value" });
console.log(baseCache.getStats());
```

---

## Cookbook

### Recipe 1: API Response Cache

```ts
import { LruTtlCache, LoadingCache } from "@fajarnugraha37/cache";

const cache = new LruTtlCache<string, ApiResponse>({
  maxEntries: 1000,
  enableStats: true
});

const apiCache = new LoadingCache(cache, async (endpoint: string) => {
  const res = await fetch(`https://api.example.com${endpoint}`);
  return res.json();
});

// Usage
const data = await apiCache.get("/users/123", {
  ttlMs: 60_000,
  staleWhileRevalidateMs: 120_000
});

// Monitor performance
setInterval(() => {
  const stats = cache.getStats();
  console.log(`Cache hit rate: ${(stats.hitRate * 100).toFixed(2)}%`);
}, 60_000);
```

### Recipe 2: Rate Limiting with Sliding Window

```ts
import { LruTtlCache } from "@fajarnugraha37/cache";

const rateLimits = new LruTtlCache<string, number[]>({ maxEntries: 10_000 });

function checkRateLimit(userId: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = rateLimits.get(userId) || [];
  
  // Filter out old timestamps
  const recentTimestamps = timestamps.filter(ts => now - ts < windowMs);
  
  if (recentTimestamps.length >= maxRequests) {
    return false; // Rate limit exceeded
  }
  
  recentTimestamps.push(now);
  rateLimits.set(userId, recentTimestamps, { ttlMs: windowMs });
  return true;
}

// Usage: max 100 requests per minute
if (checkRateLimit("user:123", 100, 60_000)) {
  // Process request
} else {
  throw new Error("Rate limit exceeded");
}
```

### Recipe 3: Two-Level Cache (L1/L2)

```ts
import { LruTtlCache } from "@fajarnugraha37/cache";

class TwoLevelCache<K, V> {
  private l1: LruTtlCache<K, V>; // Fast, small cache
  private l2: LruTtlCache<K, V>; // Larger, slower cache
  
  constructor() {
    this.l1 = new LruTtlCache({ maxEntries: 100 }); // Hot data
    this.l2 = new LruTtlCache({ maxEntries: 10_000 }); // Warm data
  }
  
  get(key: K): V | undefined {
    // Try L1 first
    let value = this.l1.get(key);
    if (value !== undefined) return value;
    
    // Try L2
    value = this.l2.get(key);
    if (value !== undefined) {
      this.l1.set(key, value); // Promote to L1
      return value;
    }
    
    return undefined;
  }
  
  set(key: K, value: V, opts?: any): void {
    this.l1.set(key, value, opts);
    this.l2.set(key, value, opts);
  }
}
```

### Recipe 4: Circuit Breaker with Cache

```ts
import { LruTtlCache } from "@fajarnugraha37/cache";

class CircuitBreaker {
  private failures = new LruTtlCache<string, number>({ maxEntries: 1000 });
  
  async execute<T>(
    key: string,
    fn: () => Promise<T>,
    threshold: number = 5,
    timeoutMs: number = 60_000
  ): Promise<T> {
    const failureCount = this.failures.get(key) || 0;
    
    if (failureCount >= threshold) {
      throw new Error("Circuit breaker open");
    }
    
    try {
      const result = await fn();
      this.failures.del(key); // Reset on success
      return result;
    } catch (error) {
      this.failures.set(key, failureCount + 1, { ttlMs: timeoutMs });
      throw error;
    }
  }
}

// Usage
const breaker = new CircuitBreaker();
await breaker.execute("external-api", async () => {
  return await fetch("https://flaky-api.com");
});
```

### Recipe 5: Distributed Cache Invalidation

```ts
import { LruTtlCache } from "@fajarnugraha37/cache";
import { EventEmitter } from "events";

class DistributedCache<K, V> {
  private cache: LruTtlCache<K, V>;
  private invalidationBus: EventEmitter;
  
  constructor() {
    this.cache = new LruTtlCache({ maxEntries: 1000 });
    this.invalidationBus = new EventEmitter();
    
    // Listen for invalidation events from other instances
    this.invalidationBus.on("invalidate", (key: K) => {
      this.cache.del(key);
    });
  }
  
  set(key: K, value: V, opts?: any): void {
    this.cache.set(key, value, opts);
    // Notify other instances
    this.invalidationBus.emit("invalidate", key);
  }
  
  get(key: K): V | undefined {
    return this.cache.get(key);
  }
}
```

---

## API reference

### `LruTtlCache<K, V>`

Main in-memory cache with LRU eviction and TTL support.

#### Constructor Options

```ts
new LruTtlCache<K, V>({
  maxEntries?: number;         // Max number of entries (default: 1000)
  maxSize?: number;            // Max total size in units (default: Infinity)
  sizer?: (value: V) => number; // Size calculator (default: jsonSizer)
  sweepIntervalMs?: number;    // Background expiry check interval (default: 0)
  enableStats?: boolean;       // Enable statistics tracking (default: false)
  enableEvents?: boolean;      // Enable event emission (default: false)
})
```

#### Methods

```ts
get(key: K): V | undefined
set(key: K, value: V, opts?: { ttlMs?: number; slidingTtlMs?: number; size?: number }): void
has(key: K): boolean
del(key: K): void
clear(): void
size(): number // Current entry count
total(): number // Total size in units
stop(): void // Stop background sweeper

// Statistics (if enableStats: true)
getStats(): CacheMetrics | undefined
resetStats(): void

// Events (if enableEvents: true)
on(event: string, handler: Function): () => void
once(event: string, handler: Function): () => void
off(event: string, handler: Function): void
```

### `LoadingCache<K, V>`

Async cache with automatic loading and stale-while-revalidate.

```ts
const loader = new LoadingCache(
  store: Cache<K, V>,
  load: (key: K) => Promise<V>
);

await loader.get(key: K, opts: {
  ttlMs?: number;
  staleWhileRevalidateMs?: number;
  jitterMs?: number;
}): Promise<V>

loader.invalidate(key: K): void
```

### `memoize<Fn>`

Memoize sync or async functions.

```ts
const memoized = memoize(fn: Fn, {
  ttlMs?: number;              // Cache duration
  slidingTtlMs?: number;       // Sliding window
  swrMs?: number;              // Stale-while-revalidate
  jitter?: number;             // Random jitter (0-1)
  maxEntries?: number;         // Max cached calls
  maxSize?: number;            // Max size
  keyFn?: (...args) => string; // Custom key generator
  cacheErrors?: boolean;       // Cache errors
  errorTtlMs?: number;         // Error cache duration
});
```

### Batch Operations

```ts
const batchCache = withBatchOperations(cache);

batchCache.getMany(keys: K[]): Map<K, V>
batchCache.setMany(entries: Array<[K, V]> | Map<K, V>, opts?: { ttlMs?: number }): void
batchCache.deleteMany(keys: K[]): void
batchCache.hasMany(keys: K[]): Map<K, boolean>
```

### Namespaced Cache

```ts
const nsCache = createNamespace(cache, "namespace", ":");

// Same API as base cache, keys are automatically prefixed
nsCache.get(key)
nsCache.set(key, value)
nsCache.clear() // Only clears this namespace
```

### Transform Cache

```ts
const transformCache = new TransformCache(
  cache: Cache<K, VIn>,
  serialize: (value: VOut) => VIn,
  deserialize: (value: VIn) => VOut
);

// Same API as base cache with automatic transformation
transformCache.get(key): VOut | undefined
transformCache.set(key, value: VOut, opts?): void
```

### Utilities

```ts
// Cache warming
await warmCache(
  cache: Cache<K, V>,
  loader: () => Promise<Array<[K, V]>> | Array<[K, V]>,
  opts?: { ttlMs?: number }
): Promise<number>

// Singleflight (request deduplication)
const sf = new Singleflight<K, V>();
await sf.do(key: K, fn: () => Promise<V>): Promise<V>

// Idempotency cache
const idempotency = new IdempotencyCache<K, V>(windowMs: number);
await idempotency.execute(key: K, fn: () => Promise<V>): Promise<V>

// Keyed lock
const lock = new KeyedLock<K>();
const release = await lock.acquire(key: K);
try {
  // Critical section
} finally {
  release();
}

// Read-through cache
const readThrough = createReadThrough(
  loader: (key: K) => Promise<V>,
  opts?: { ttlMs?: number; maxEntries?: number }
);
await readThrough.get(key: K): Promise<V>
```

---

## FAQ & troubleshooting

### Q: What's the difference between TTL and sliding TTL?

**TTL (Time To Live):** Fixed expiration time from when entry was set.
```ts
cache.set("key", value, { ttlMs: 60_000 }); // Expires in 60s, regardless of access
```

**Sliding TTL:** Expiration resets on each access.
```ts
cache.set("key", value, { slidingTtlMs: 60_000 }); // Expires 60s after last access
```

### Q: How do I prevent cache stampede?

Use `Singleflight` to deduplicate concurrent requests:

```ts
import { Singleflight } from "@fajarnugraha37/cache";

const sf = new Singleflight<string, Data>();

// 1000 concurrent requests → only 1 database call
const results = await Promise.all(
  Array.from({ length: 1000 }, () =>
    sf.do("user:123", () => fetchFromDatabase("user:123"))
  )
);
```

### Q: Memory usage is too high. How can I limit it?

Use `maxSize` with a custom `sizer`:

```ts
const cache = new LruTtlCache<string, Buffer>({
  maxSize: 100_000_000, // 100 MB
  sizer: (buf) => buf.length // Measure actual size
});
```

### Q: How do I monitor cache performance in production?

Enable statistics and export metrics:

```ts
const cache = new LruTtlCache({
  maxEntries: 10_000,
  enableStats: true,
  enableEvents: true
});

// Periodic metrics export
setInterval(() => {
  const stats = cache.getStats();
  if (stats) {
    metrics.gauge("cache.hit_rate", stats.hitRate);
    metrics.gauge("cache.size", stats.size);
    metrics.counter("cache.evictions", stats.evictions);
  }
}, 10_000);

// Alert on excessive evictions
cache.on("evict", ({ reason }) => {
  if (reason === "overflow") {
    logger.warn("Cache overflow - consider increasing maxEntries");
  }
});
```

### Q: Can I use this with Redis or other distributed caches?

This library is for **in-memory** caching only. For distributed caching, use Redis with similar patterns:

```ts
// In-memory for hot data (L1)
const l1Cache = new LruTtlCache({ maxEntries: 100 });

// Redis for shared data (L2)
async function get(key: string) {
  let value = l1Cache.get(key);
  if (value) return value;
  
  value = await redis.get(key);
  if (value) {
    l1Cache.set(key, value);
    return value;
  }
  
  return undefined;
}
```

### Q: How do I handle cache errors?

Use error caching with memoize:

```ts
const fetchUser = memoize(
  async (id: string) => {
    const res = await fetch(`/api/users/${id}`);
    if (!res.ok) throw new Error("Not found");
    return res.json();
  },
  {
    cacheErrors: true,     // Cache errors to prevent retry storms
    errorTtlMs: 10_000,   // Cache errors for shorter duration
    ttlMs: 300_000        // Cache success for longer
  }
);

try {
  await fetchUser("123");
} catch (error) {
  // Error is cached, subsequent calls fail fast
}
```

### Q: What's the performance overhead of stats and events?

Based on benchmarks:

| Feature | Overhead |
|---------|----------|
| No stats/events | Baseline (100%) |
| With stats | ~0-5% slower |
| With events (1 listener) | ~5-10% slower |
| With events (wildcard) | ~10-15% slower |

Enable only in development or when needed for monitoring.

### Q: Can I persist cache to disk?

No, this is an in-memory cache. For persistence, use:
- **Redis** for distributed persistence
- **LevelDB/RocksDB** for local persistence
- **SQLite** with in-memory mode for fast local persistence

### Q: How do I test code that uses the cache?

```ts
import { LruTtlCache } from "@fajarnugraha37/cache";

// Test with mock
const mockCache = {
  get: vi.fn(),
  set: vi.fn(),
  has: vi.fn(),
  del: vi.fn(),
  clear: vi.fn(),
  size: vi.fn(() => 0)
};

// Or use real cache in tests
beforeEach(() => {
  cache.clear();
});
```

### Troubleshooting: Cache size grows unbounded

**Problem:** Cache uses too much memory.

**Solutions:**
1. Set `maxEntries` limit
2. Set `maxSize` with custom `sizer`
3. Enable background sweeper: `sweepIntervalMs: 60_000`
4. Use shorter TTLs
5. Monitor with `enableStats: true`

```ts
const cache = new LruTtlCache({
  maxEntries: 10_000,
  maxSize: 100_000_000, // 100 MB
  sweepIntervalMs: 60_000,
  sizer: (v) => JSON.stringify(v).length
});
```

### Troubleshooting: High cache miss rate

**Problem:** Most requests miss cache (low hit rate).

**Diagnosis:**
```ts
const cache = new LruTtlCache({ enableStats: true });
// ... use cache ...
const stats = cache.getStats();
console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(2)}%`);
```

**Solutions:**
1. Increase `maxEntries`
2. Increase TTL duration
3. Use `slidingTtlMs` for frequently accessed data
4. Pre-warm cache with `warmCache()`
5. Use stale-while-revalidate for better hit rates

### Troubleshooting: Memory leaks

**Problem:** Memory grows over time.

**Check:**
1. Call `cache.stop()` to stop background sweeper
2. Remove event listeners: `cache.off(event, handler)`
3. Clear cache periodically: `cache.clear()`
4. Check for retained references in event handlers

```ts
// Proper cleanup
const unsubscribe = cache.on("set", handler);
// Later...
unsubscribe();
cache.stop();
cache.clear();
```

---

## Performance Benchmarks

Benchmarks run on Bun 1.3.1 (10k operations unless specified):

### Core Operations
| Operation | Time | Ops/sec |
|-----------|------|---------|
| Set (basic) | 1,368ms | ~7,300 |
| Set (with stats) | 1,062ms | ~9,400 |
| Set (with events) | 1,111ms | ~9,000 |
| Get (cache hits) | 1,071ms | ~9,300 |
| Get (cache misses) | 1.6ms | ~625,000 |
| Set with TTL | 1,365ms | ~7,300 |
| LRU eviction (1k) | 3.4ms | ~294,000 |
| Delete (1k) | 11.6ms | ~86,000 |
| Clear (10k entries) | 1,076ms | - |

### Batch Operations (1k entries)
| Operation | Time | Ops/sec |
|-----------|------|---------|
| setMany | 11.8ms | ~85,000 |
| getMany | 12.4ms | ~81,000 |
| deleteMany | 13.6ms | ~74,000 |
| hasMany | 15.0ms | ~67,000 |

### Advanced Features
| Feature | Time | Ops/sec |
|---------|------|---------|
| LoadingCache (1k loads) | 26.3ms | ~38,000 |
| LoadingCache (cached) | 18.8ms | ~53,000 |
| Memoize sync (1k, 100 unique) | 2.6ms | ~385,000 |
| Memoize async (1k, 100 unique) | 2.7ms | ~370,000 |
| Namespaced set (1k, 10 ns) | 30.0ms | ~33,000 |
| Transform JSON set (1k) | 14.7ms | ~68,000 |
| Cache warming (1k) | 14.2ms | ~70,000 |

### Memory Efficiency
| Scenario | Time |
|----------|------|
| 100k small entries | 98.6s |
| 10k large objects | 667.7ms |

**Run benchmarks:** `bun run tests/cache.bench.ts`

---

## Test Coverage

**Unit Tests:** 47 tests passing
- **Function Coverage:** 90.49%
- **Line Coverage:** 98.27%

| File | Functions | Lines | Uncovered |
|------|-----------|-------|-----------|
| cache.ts | 96.15% | 100% | - |
| cache-stats.ts | 80.00% | 97.73% | - |
| cache-events.ts | 66.67% | 90.38% | Error handlers |
| cache-utils.ts | 75.86% | 95.28% | Edge cases |
| loading-cache.ts | 100% | 100% | - |
| memoize.ts | 84.62% | 96.67% | - |
| idempotency.ts | 100% | 100% | - |
| keyed-lock.ts | 85.71% | 100% | - |

**Run tests:** `bun test --coverage`

---

## License

MIT © fajarnugraha37

## Contributing

Contributions welcome! Please open an issue or PR.

---

**Built for** `@fajarnugraha37/validator` and `@fajarnugraha37/expression` – high-performance validation and expression evaluation libraries.
