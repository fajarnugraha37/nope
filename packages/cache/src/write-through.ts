import { LruTtlCache } from "./cache.ts";
import { LoadingCache, type LoaderOpts } from "./loading-cache.ts";

/* ---------- write-through helpers ---------- */
export interface ReadThrough<K, V> {
  get(k: K): Promise<V>;
  del(k: K): void;
  clear(): void;
}

export function createReadThrough<K, V>(
  loader: (k: K) => Promise<V>,
  opts: { store?: LruTtlCache<K, V> } & LoaderOpts = {}
): ReadThrough<K, V> {
  const store = opts.store ?? new LruTtlCache<K, V>();
  const lc = new LoadingCache<K, V>(store, loader);
  return {
    get: (k) =>
      lc.get(k, {
        ttlMs: opts.ttlMs,
        staleWhileRevalidateMs: opts.staleWhileRevalidateMs,
        jitter: opts.jitter,
      }),
    del: (k) => lc.del(k),
    clear: () => lc.clear(),
  };
}
