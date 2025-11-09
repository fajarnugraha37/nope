# @fajarnugraha37/cache

[![npm version](https://img.shields.io/npm/v/@fajarnugraha37/cache.svg)](https://www.npmjs.com/package/@fajarnugraha37/cache)
[![Tests](https://img.shields.io/badge/tests-47%20passing-success)](./tests)
[![Coverage](https://img.shields.io/badge/coverage-98.27%25%20lines-brightgreen)](./coverage)

> Production-ready caching primitives: LRU, TTL, stale-while-revalidate, singleflight loading, and flexible memoization for TypeScript/JavaScript applications.

## Table of Contents

1. [Installation](#installation)
2. [Why this lib?](#why-this-lib)
3. [Quick start](#quick-start)
4. [Core concepts](#core-concepts)
5. [Usage catalog](#usage-catalog)
6. [Advanced features](#advanced-features)
7. [Cookbook](#cookbook)
8. [Performance benchmarks](#performance-benchmarks)
9. [API reference](#api-reference)

## Installation

```bash
# Node.js with npm
npm install @fajarnugraha37/cache

# Node.js with pnpm
pnpm add @fajarnugraha37/cache

# Node.js with yarn
yarn add @fajarnugraha37/cache

# Bun
bun add @fajarnugraha37/cache

# Deno
deno add npm:@fajarnugraha37/cache
```

---

## Why this lib?

Modern applications need efficient caching to reduce latency, minimize expensive operations, and improve user experience. This library provides:

- **💾 LRU Cache**: Least-Recently-Used eviction with size limits and TTL support
- **⏱️ TTL Management**: Automatic expiration with lazy and active cleanup strategies
- **🔄 Stale-While-Revalidate**: Serve stale data while refreshing in the background
- **🔐 Singleflight Loading**: Deduplicate concurrent cache misses to prevent thundering herd
- **📊 Statistics & Events**: Track hit/miss rates, evictions, and cache health metrics
- **🎯 Memoization**: Function result caching with flexible key generation
- **🔑 Idempotency**: Request deduplication with expiring keys
- **🔒 Keyed Locks**: Per-key mutual exclusion for coordinated cache updates
- **🎨 Flexible Design**: Namespaced caches, custom transformers, and batch operations
- **✅ Production-Ready**: 47 tests, 98% coverage, battle-tested patterns

Whether you're caching API responses, expensive computations, or database queries, this library provides the tools.

---

## Quick start

```ts
import { 
  Cache, 
  LoadingCache, 
  memoize,
  createIdempotencyCache
} from "@fajarnugraha37/cache";

// Basic LRU cache with TTL
const cache = new Cache<string, User>({ maxSize: 1000, ttlMs: 60000 });
cache.set("user:123", { id: "123", name: "Alice" });
const user = cache.get("user:123");

// Loading cache with automatic population
const userCache = new LoadingCache({
  maxSize: 500,
  ttlMs: 30000,
  loader: async (userId: string) => {
    return await db.users.findById(userId);
  }
});
const alice = await userCache.get("123"); // Loads if missing

// Memoize expensive functions
const fibonacci = memoize((n: number): number => {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}, { maxSize: 100 });

// Idempotency for API requests
const idempotency = createIdempotencyCache<OrderResponse>({
  ttlMs: 3600000 // 1 hour
});
await idempotency.execute("order-123", async () => {
  return await createOrder(orderData);
});
```

---

## Core concepts

### LRU Cache with TTL

Least-Recently-Used cache automatically evicts old entries:

```ts
const cache = new Cache<string, Data>({
  maxSize: 1000,      // Max 1000 entries
  ttlMs: 60000,       // Entries expire after 1 minute
  staleMs: 5000,      // Consider stale after 5 seconds
  allowStale: true,   // Serve stale data while revalidating
  checkPeriod: 30000  // Clean up expired entries every 30s
});

cache.set("key", data);
const result = cache.get("key");

if (cache.has("key")) {
  console.log("Cache hit!");
}
```

**Key features:**
- Automatic LRU eviction when maxSize reached
- Optional TTL with expiration
- Stale-while-revalidate support
- Lazy and active cleanup strategies

### Loading Cache

Automatically populate cache on miss with singleflight protection:

```ts
const cache = new LoadingCache({
  maxSize: 500,
  ttlMs: 60000,
  loader: async (key: string) => {
    // Expensive operation (database, API, computation)
    return await fetchFromDatabase(key);
  }
});

// First call loads from loader
const data1 = await cache.get("user:123");

// Second call returns cached value
const data2 = await cache.get("user:123");

// Multiple concurrent calls deduplicated (singleflight)
const [a, b, c] = await Promise.all([
  cache.get("user:456"),
  cache.get("user:456"),
  cache.get("user:456")
]); // Only ONE loader call!
```

### Memoization

Cache function results automatically:

```ts
// Simple memoization
const expensive = memoize(
  (n: number) => {
    // Expensive computation
    return fibonacci(n);
  },
  { maxSize: 100, ttlMs: 60000 }
);

// Async memoization
const fetchUser = memoizeAsync(
  async (id: string) => {
    return await api.getUser(id);
  },
  { maxSize: 500, ttlMs: 30000 }
);

// Custom key generation
const search = memoize(
  (query: string, filters: Filter[]) => {
    return performSearch(query, filters);
  },
  {
    keyFn: (query, filters) => `${query}:${JSON.stringify(filters)}`,
    maxSize: 200
  }
);
```

### Statistics & Events

Monitor cache performance:

```ts
const cache = new Cache({
  maxSize: 1000,
  enableStats: true,
  enableEvents: true
});

// Get statistics
const stats = cache.stats();
console.log(`Hit rate: ${stats.hitRate.toFixed(2)}%`);
console.log(`Evictions: ${stats.evictions}`);

// Listen to events
cache.on("hit", ({ key }) => console.log(`Cache hit: ${key}`));
cache.on("miss", ({ key }) => console.log(`Cache miss: ${key}`));
cache.on("evict", ({ key, reason }) => console.log(`Evicted ${key}: ${reason}`));
cache.on("expire", ({ key }) => console.log(`Expired: ${key}`));
```

---

## Usage catalog

### Basic Cache Operations

```ts
import { Cache } from "@fajarnugraha37/cache";

const cache = new Cache<string, number>({ maxSize: 100 });

// Set value
cache.set("key1", 42);

// Set with custom TTL
cache.set("key2", 100, 5000); // Expires in 5 seconds

// Get value
const value = cache.get("key1"); // 42 or undefined

// Check existence
if (cache.has("key1")) {
  console.log("Key exists");
}

// Delete
cache.delete("key1");

// Clear all
cache.clear();

// Size
console.log(cache.size);
```

### Batch Operations

```ts
// Set multiple
cache.setMany([
  ["user:1", { id: 1, name: "Alice" }],
  ["user:2", { id: 2, name: "Bob" }]
]);

// Get multiple
const users = cache.getMany(["user:1", "user:2"]);
// Returns: Map<string, User | undefined>

// Delete multiple
cache.deleteMany(["user:1", "user:2"]);

// Check multiple
const existence = cache.hasMany(["user:1", "user:2"]);
// Returns: Map<string, boolean>
```

### TTL & Expiration

```ts
const cache = new Cache({
  maxSize: 1000,
  ttlMs: 60000,       // Global TTL: 1 minute
  checkPeriod: 30000  // Cleanup every 30 seconds
});

// Per-entry TTL
cache.set("short-lived", data, 5000); // 5 seconds

// Get remaining TTL
const ttl = cache.ttl("key"); // milliseconds or undefined

// Update TTL
cache.touch("key", 120000); // Extend to 2 minutes

// Check if expired (without removing)
if (cache.isExpired("key")) {
  cache.delete("key");
}
```

### Stale-While-Revalidate

```ts
const cache = new Cache({
  maxSize: 500,
  ttlMs: 60000,
  staleMs: 5000,      // Fresh for 5s, then stale
  allowStale: true
});

// Returns stale data immediately if available
const data = cache.get("key");

// Manual revalidation
if (cache.isStale("key")) {
  // Serve stale data while refreshing in background
  fetchFreshData().then(fresh => cache.set("key", fresh));
}
```

### Namespaced Caches

```ts
import { createNamespacedCache } from "@fajarnugraha37/cache";

const cache = new Cache({ maxSize: 1000 });

// Create namespaced views
const userCache = createNamespacedCache(cache, "users:");
const postCache = createNamespacedCache(cache, "posts:");

// Set in namespace
userCache.set("123", userData);   // Actually: "users:123"
postCache.set("456", postData);   // Actually: "posts:456"

// Get from namespace
const user = userCache.get("123"); // Gets "users:123"

// Clear namespace
userCache.clear(); // Only clears "users:*"
```

### Transform Caches

```ts
import { createTransformCache } from "@fajarnugraha37/cache";

const cache = new Cache<string, string>({ maxSize: 100 });

// JSON transform
const jsonCache = createTransformCache(
  cache,
  (obj) => JSON.stringify(obj),
  (str) => JSON.parse(str)
);

jsonCache.set("user", { id: 123, name: "Alice" });
const user = jsonCache.get("user"); // Automatically deserialized

// Compression transform (hypothetical)
const compressedCache = createTransformCache(
  cache,
  (data) => compress(data),
  (compressed) => decompress(compressed)
);
```

### Cache Warming

```ts
import { warmCache } from "@fajarnugraha37/cache";

const cache = new Cache({ maxSize: 1000 });

// Pre-populate cache
await warmCache(cache, async () => {
  const users = await db.users.findAll();
  return users.map(u => [`user:${u.id}`, u]);
});

// Now cache is pre-warmed with data
const alice = cache.get("user:123");
```

---

## Advanced features

### LoadingCache with Custom Loaders

```ts
const cache = new LoadingCache({
  maxSize: 500,
  ttlMs: 60000,
  loader: async (key: string, context?: RequestContext) => {
    // Access context in loader
    const headers = context?.headers;
    return await fetchWithAuth(key, headers);
  },
  onError: (err, key) => {
    console.error(`Failed to load ${key}:`, err);
    // Return fallback value or re-throw
    return defaultValue;
  }
});

// Pass context to loader
const data = await cache.get("resource", { headers: authHeaders });
```

### Idempotency Cache

Prevent duplicate operations:

```ts
import { createIdempotencyCache, IdempotencyCache } from "@fajarnugraha37/cache";

const idempotency: IdempotencyCache<PaymentResult> = createIdempotencyCache({
  ttlMs: 3600000 // 1 hour
});

// First call executes
const result1 = await idempotency.execute("payment-123", async () => {
  return await processPayment(paymentData);
});

// Second call returns cached result
const result2 = await idempotency.execute("payment-123", async () => {
  return await processPayment(paymentData); // NOT called
});

// Clean up after completion
idempotency.resolve("payment-123");
```

### Keyed Locks

Per-key mutual exclusion:

```ts
import { KeyedLock } from "@fajarnugraha37/cache";

const lock = new KeyedLock();

// Only one operation per key at a time
await lock.withLock("user:123", async () => {
  const user = await cache.get("user:123");
  user.balance += 100;
  await cache.set("user:123", user);
});

// Different keys can run concurrently
await Promise.all([
  lock.withLock("user:123", async () => updateUser("123")),
  lock.withLock("user:456", async () => updateUser("456")) // Runs in parallel
]);
```

### Custom Eviction Policies

```ts
// Priority-based eviction
class PriorityCache<K, V> extends Cache<K, V> {
  private priorities = new Map<K, number>();

  set(key: K, value: V, priority: number = 0) {
    this.priorities.set(key, priority);
    return super.set(key, value);
  }

  protected evict(): void {
    // Evict lowest priority first
    let lowestKey: K | undefined;
    let lowestPriority = Infinity;
    
    for (const [key, priority] of this.priorities) {
      if (priority < lowestPriority) {
        lowestPriority = priority;
        lowestKey = key;
      }
    }
    
    if (lowestKey) {
      this.delete(lowestKey);
    }
  }
}
```

---

## Cookbook

### Pattern 1: Multi-Level Cache

Combine local and remote caches:

```ts
class MultiLevelCache<K, V> {
  constructor(
    private l1: Cache<K, V>,
    private l2: LoadingCache<K, V>
  ) {}

  async get(key: K): Promise<V | undefined> {
    // Try L1 (fast local cache)
    let value = this.l1.get(key);
    if (value) return value;

    // Try L2 (slower remote/loading cache)
    value = await this.l2.get(key);
    if (value) {
      this.l1.set(key, value); // Backfill L1
      return value;
    }

    return undefined;
  }
}

const l1 = new Cache({ maxSize: 100, ttlMs: 5000 });
const l2 = new LoadingCache({
  maxSize: 1000,
  ttlMs: 60000,
  loader: fetchFromDb
});

const cache = new MultiLevelCache(l1, l2);
```

### Pattern 2: Cache-Aside

Manual cache population:

```ts
async function getUser(id: string): Promise<User> {
  const cached = cache.get(`user:${id}`);
  if (cached) return cached;

  const user = await db.users.findById(id);
  cache.set(`user:${id}`, user, 60000);
  return user;
}

async function updateUser(id: string, data: Partial<User>): Promise<User> {
  const user = await db.users.update(id, data);
  cache.set(`user:${id}`, user, 60000); // Write-through
  return user;
}

async function deleteUser(id: string): Promise<void> {
  await db.users.delete(id);
  cache.delete(`user:${id}`); // Invalidate
}
```

### Pattern 3: Read-Through Cache

```ts
const cache = new LoadingCache({
  maxSize: 500,
  ttlMs: 60000,
  loader: async (key: string) => {
    return await db.get(key);
  }
});

// Always use get - loads automatically on miss
const data = await cache.get("key");
```

### Pattern 4: Write-Through Cache

```ts
class WriteThroughCache<K, V> extends Cache<K, V> {
  constructor(
    opts: CacheOptions,
    private persist: (key: K, value: V) => Promise<void>
  ) {
    super(opts);
  }

  async set(key: K, value: V, ttl?: number): Promise<this> {
    await this.persist(key, value);
    return super.set(key, value, ttl);
  }
}

const cache = new WriteThroughCache(
  { maxSize: 1000 },
  async (key, value) => {
    await db.set(key, value);
  }
);
```

### Pattern 5: Cache Invalidation Strategies

```ts
// Time-based invalidation
cache.set("key", value, 60000); // Auto-expire after 1 min

// Event-based invalidation
eventBus.on("user:updated", ({ userId }) => {
  cache.delete(`user:${userId}`);
});

// Tag-based invalidation
const taggedCache = new Map<string, Set<string>>();

function setWithTags(key: string, value: any, tags: string[]) {
  cache.set(key, value);
  for (const tag of tags) {
    if (!taggedCache.has(tag)) taggedCache.set(tag, new Set());
    taggedCache.get(tag)!.add(key);
  }
}

function invalidateTag(tag: string) {
  const keys = taggedCache.get(tag);
  if (keys) {
    for (const key of keys) cache.delete(key);
    taggedCache.delete(tag);
  }
}

// Usage
setWithTags("user:123", userData, ["users", "team:A"]);
invalidateTag("team:A"); // Invalidates all team A entries
```

---

## Performance benchmarks

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

## API reference

### Cache<K, V>

Core LRU cache with TTL support.

```ts
interface CacheOptions {
  maxSize?: number;          // Max entries (default: 1000)
  ttlMs?: number;            // Time-to-live in ms
  staleMs?: number;          // Stale-while-revalidate window
  allowStale?: boolean;      // Serve stale data (default: false)
  checkPeriod?: number;      // Cleanup interval (default: 60000)
  enableStats?: boolean;     // Track hit/miss stats
  enableEvents?: boolean;    // Emit cache events
}

class Cache<K, V> {
  constructor(options?: CacheOptions);
  
  // Basic operations
  set(key: K, value: V, ttl?: number): this;
  get(key: K): V | undefined;
  has(key: K): boolean;
  delete(key: K): boolean;
  clear(): void;
  
  // Batch operations
  setMany(entries: Iterable<[K, V]>): this;
  getMany(keys: Iterable<K>): Map<K, V | undefined>;
  deleteMany(keys: Iterable<K>): number;
  hasMany(keys: Iterable<K>): Map<K, boolean>;
  
  // TTL management
  ttl(key: K): number | undefined;
  touch(key: K, ttl?: number): boolean;
  isExpired(key: K): boolean;
  isStale(key: K): boolean;
  
  // Iteration
  keys(): IterableIterator<K>;
  values(): IterableIterator<V>;
  entries(): IterableIterator<[K, V]>;
  [Symbol.iterator](): IterableIterator<[K, V]>;
  
  // Stats & events
  stats(): CacheStats;
  resetStats(): void;
  on(event: CacheEvent, handler: Function): () => void;
  off(event: CacheEvent, handler: Function): void;
  
  // Properties
  size: number;
}
```

### LoadingCache<K, V>

Auto-loading cache with singleflight protection.

```ts
interface LoadingCacheOptions<K, V> extends CacheOptions {
  loader: (key: K, context?: any) => Promise<V>;
  onError?: (error: Error, key: K) => V | Promise<V>;
}

class LoadingCache<K, V> extends Cache<K, V> {
  constructor(options: LoadingCacheOptions<K, V>);
  get(key: K, context?: any): Promise<V>;
  refresh(key: K, context?: any): Promise<V>;
}
```

### Memoization

```ts
interface MemoizeOptions {
  maxSize?: number;
  ttlMs?: number;
  keyFn?: (...args: any[]) => string;
}

function memoize<A extends any[], R>(
  fn: (...args: A) => R,
  options?: MemoizeOptions
): (...args: A) => R;

function memoizeAsync<A extends any[], R>(
  fn: (...args: A) => Promise<R>,
  options?: MemoizeOptions
): (...args: A) => Promise<R>;
```

### Idempotency Cache

```ts
interface IdempotencyOptions {
  ttlMs?: number;
  maxSize?: number;
}

interface IdempotencyCache<T> {
  execute(key: string, fn: () => Promise<T>): Promise<T>;
  resolve(key: string): void;
  reject(key: string, error: Error): void;
  clear(): void;
}

function createIdempotencyCache<T>(
  options?: IdempotencyOptions
): IdempotencyCache<T>;
```

### Utilities

```ts
function createNamespacedCache<K, V>(
  cache: Cache<K, V>,
  namespace: string
): Cache<K, V>;

function createTransformCache<K, V, S>(
  cache: Cache<K, S>,
  serialize: (value: V) => S,
  deserialize: (stored: S) => V
): Cache<K, V>;

function warmCache<K, V>(
  cache: Cache<K, V>,
  loader: () => Promise<Iterable<[K, V]>>
): Promise<void>;

class KeyedLock {
  withLock<T>(key: string, fn: () => Promise<T>): Promise<T>;
  acquire(key: string): Promise<() => void>;
  release(key: string): void;
}
```

---

## Test coverage

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

## Scripts

| Command | Description |
|---------|-------------|
| `bun run build` | Bundle sources via `tsup`. |
| `bun run test` | Run test suite. |
| `bun run test:watch` | Watch mode. |
| `bun run test:coverage` | Generate coverage report. |
| `bun run benchmark` | Run performance benchmarks. |
| `bun run coverage:view` | View coverage in browser. |

---

## License

MIT © fajarnugraha37
