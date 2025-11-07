# @nope/cache

> Caching primitives (LRU, TTL, stale-while-revalidate, singleflight) and memoization helpers shared by `@nope/validator` and `@nope/expression`.

## Components

- **`LruTtlCache<K, V>`** – in-memory cache with max entries, size-based eviction, TTL + sliding TTL, background sweepers, and metrics (`size()`, `total()`).
- **`jsonSizer`** – naive size estimator used by the cache or memoizer when you do not provide one.
- **`Singleflight`** – deduplicates concurrent lookups per key (fan-in/fan-out pattern).
- **`IdempotencyCache`** – caches promise results for the lifetime of an idempotency window.
- **`KeyedLock`** – lightweight async mutex keyed by user-defined ids.
- **`LoadingCache`** – composes an underlying cache with an async loader; supports TTL, stale-while-revalidate, jitter, and manual invalidation.
- **`createReadThrough`** – helper that returns a `ReadThrough` wrapper around a loader + `LruTtlCache`.
- **`memoize`** – wraps sync or async functions with TTL, sliding TTL, max entries, stale-while-revalidate, jitter, optional error caching, and pluggable keyers.

Utility exports (`now`, `sleep`) round out the toolkit.

## Usage

```ts
import {
  LruTtlCache,
  LoadingCache,
  memoize,
  createReadThrough,
  KeyedLock,
  Singleflight,
  sleep,
} from "@nope/cache";

// LRU + TTL cache
const cache = new LruTtlCache<string, number>({
  maxEntries: 100,
  ttlMs: 5_000,
  slidingTtlMs: 5_000,
});

cache.set("answer", 42);
await sleep(10);
console.log(cache.get("answer"));

// Loading cache with stale-while-revalidate
const store = new LruTtlCache<string, number>();
const loader = new LoadingCache(store, async (key) => key.length);

console.log(await loader.get("alpha", { ttlMs: 1_000, staleWhileRevalidateMs: 5_000 }));

// Memoize async work with jitter + SWR
const fetchUser = memoize(
  async (id: string) => {
    const res = await fetch(`/users/${id}`);
    if (!res.ok) throw new Error("request failed");
    return res.json();
  },
  { ttlMs: 30_000, swrMs: 60_000, jitter: 0.2 }
);

await fetchUser("42"); // network hit
await fetchUser("42"); // cached and refreshed in the background

// Read-through helper
const readThrough = createReadThrough(async (sku: string) => {
  return await loadFromDatabase(sku);
}, { ttlMs: 2_000 });

await readThrough.get("sku-1");

// Serialize expensive jobs with Singleflight + KeyedLock
const sf = new Singleflight<string, any>();
const lock = new KeyedLock<string>();

async function compute(key: string) {
  const release = await lock.acquire(key);
  try {
    return await sf.do(key, () => actuallyCompute(key));
  } finally {
    release();
  }
}
```

`@nope/validator` uses these primitives to memoize AJV validators, while `@nope/expression` caches compiled json-logic functions.

## Scripts

| Command | Description |
| --- | --- |
| `bun run build` | Compile ESM/CJS bundles. |
| `bun run test` | Run `tests/cache.test.ts`. |
| `bun run test:watch` | Watch mode. |
| `bun run coverage:view` | Open the coverage report. |

Drop-in replacements: if you already use another cache, the API is simple enough to adapt—`LruTtlCache` implements the `Cache<K, V>` interface exported from `src/cache.ts`.
