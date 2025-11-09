import type { Cache } from "./cache.ts";

/**
 * Batch operations for caches
 */

export interface BatchCache<K, V> extends Cache<K, V> {
  getMany(keys: K[]): Map<K, V>;
  setMany(entries: Array<[K, V]> | Map<K, V>, opts?: { ttlMs?: number; slidingTtlMs?: number }): void;
  deleteMany(keys: K[]): void;
  hasMany(keys: K[]): Map<K, boolean>;
}

export function withBatchOperations<K, V>(
  cache: Cache<K, V>
): BatchCache<K, V> {
  const batchCache: BatchCache<K, V> = {
    // Forward base cache methods
    get: (key) => cache.get(key),
    set: (key, val, opts) => cache.set(key, val, opts),
    has: (key) => cache.has(key),
    del: (key) => cache.del(key),
    clear: () => cache.clear(),
    size: () => cache.size(),

    // Batch operations
    getMany(keys: K[]): Map<K, V> {
      const results = new Map<K, V>();
      for (const key of keys) {
        const value = cache.get(key);
        if (value !== undefined) {
          results.set(key, value);
        }
      }
      return results;
    },

    setMany(
      entries: Array<[K, V]> | Map<K, V>,
      opts?: { ttlMs?: number; slidingTtlMs?: number }
    ): void {
      const pairs = entries instanceof Map ? Array.from(entries) : entries;
      for (const [key, value] of pairs) {
        cache.set(key, value, opts);
      }
    },

    deleteMany(keys: K[]): void {
      for (const key of keys) {
        cache.del(key);
      }
    },

    hasMany(keys: K[]): Map<K, boolean> {
      const results = new Map<K, boolean>();
      for (const key of keys) {
        results.set(key, cache.has(key));
      }
      return results;
    },
  };

  return batchCache;
}

/**
 * Namespace wrapper for cache keys
 */
export class NamespacedCache<K, V> implements Cache<K, V> {
  constructor(
    private cache: Cache<string, V>,
    private namespace: string,
    private separator: string = ":"
  ) {}

  private prefixKey(key: K): string {
    return `${this.namespace}${this.separator}${String(key)}`;
  }

  get(key: K): V | undefined {
    return this.cache.get(this.prefixKey(key));
  }

  set(
    key: K,
    val: V,
    opts?: { ttlMs?: number; slidingTtlMs?: number; size?: number }
  ): void {
    this.cache.set(this.prefixKey(key), val, opts);
  }

  has(key: K): boolean {
    return this.cache.has(this.prefixKey(key));
  }

  del(key: K): void {
    this.cache.del(this.prefixKey(key));
  }

  clear(): void {
    // Note: This clears the entire underlying cache, not just this namespace
    // For namespace-specific clearing, you'd need to track keys
    this.cache.clear();
  }

  size(): number {
    // Note: Returns size of entire underlying cache
    return this.cache.size();
  }
}

/**
 * Create a namespaced cache from an existing cache
 */
export function createNamespace<K, V>(
  cache: Cache<string, V>,
  namespace: string,
  separator: string = ":"
): Cache<K, V> {
  return new NamespacedCache<K, V>(cache, namespace, separator);
}

/**
 * Cache warming - preload data into cache
 */
export async function warmCache<K, V>(
  cache: Cache<K, V>,
  loader: () => Promise<Array<[K, V]>> | Array<[K, V]>,
  opts?: { ttlMs?: number; slidingTtlMs?: number }
): Promise<number> {
  const entries = await loader();
  for (const [key, value] of entries) {
    cache.set(key, value, opts);
  }
  return entries.length;
}

/**
 * Typed cache wrapper with transformation
 */
export class TransformCache<K, VIn, VOut> implements Cache<K, VOut> {
  constructor(
    private cache: Cache<K, VIn>,
    private serialize: (val: VOut) => VIn,
    private deserialize: (val: VIn) => VOut
  ) {}

  get(key: K): VOut | undefined {
    const val = this.cache.get(key);
    return val !== undefined ? this.deserialize(val) : undefined;
  }

  set(
    key: K,
    val: VOut,
    opts?: { ttlMs?: number; slidingTtlMs?: number; size?: number }
  ): void {
    this.cache.set(key, this.serialize(val), opts);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  del(key: K): void {
    this.cache.del(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size();
  }
}
