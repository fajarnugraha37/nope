import {
  LruTtlCache,
  now,
  Singleflight,
  type Entry,
  type Sizer,
} from "./cache.ts";

const defer =
  typeof queueMicrotask === "function"
    ? queueMicrotask
    : (fn: () => void) => {
        void Promise.resolve().then(fn);
      };

/* ---------- memoize (sync/async) ---------- */
export type MemoKeyer<A extends any[]> = (...args: A) => string;

// Optimized key generation with fast-paths
const defaultKeyer = (...args: any[]) => {
  const len = args.length;
  
  // Fast-path: No arguments
  if (len === 0) return "()";
  
  // Fast-path: Single argument
  if (len === 1) {
    const arg = args[0];
    const type = typeof arg;
    
    // Single primitive - direct string conversion
    if (type !== "object" && type !== "function") {
      if (arg === null) return "null";
      if (arg === undefined) return "undefined";
      return String(arg);
    }
    
    // Single null
    if (arg === null) return "null";
    
    // Single array - fast hash for large arrays
    if (Array.isArray(arg)) {
      // For large arrays (>= 50), use sampling to avoid O(n) serialization
      if (arg.length >= 50) {
        const first = String(arg[0]);
        const last = String(arg[arg.length - 1]);
        const mid = String(arg[Math.floor(arg.length / 2)]);
        return `[${arg.length}:${first}|${mid}|${last}]`;
      }
    }
    
    // Single object or small array - use JSON.stringify
    try {
      return JSON.stringify(arg);
    } catch {
      return String(arg);
    }
  }
  
  // Multiple arguments - use JSON.stringify (it's fast enough for small arrays)
  try {
    return JSON.stringify(args);
  } catch {
    return String(args[0]);
  }
};

export type MemoOpts<V, A extends any[]> = {
  ttlMs?: number;
  slidingTtlMs?: number;
  maxEntries?: number;
  maxSize?: number;
  sizer?: Sizer<V>;
  keyer?: MemoKeyer<A>;
  cacheErrors?: boolean; // default false
  swrMs?: number; // stale-while-revalidate window
  jitter?: number; // 0..1
};

const defaultOpts = {
  ttlMs: 5 * 60 * 1000, // 5 minutes
  maxEntries: 1000,
  maxSize: 5 * 1024 * 1024, // 5 megabytes
  slidingTtlMs: 0, // disabled
  swrMs: 0, // disabled
  jitter: 0.1, // 10%
}

export function memoize<A extends any[], V>(
  fn: (...args: A) => V | Promise<V>,
  opts: MemoOpts<V, A> = defaultOpts,
) {
  const store = new LruTtlCache<string, V>({
    maxEntries: opts.maxEntries ?? 1000,
    maxSize: opts.maxSize ?? Number.POSITIVE_INFINITY,
    sweepIntervalMs: 60000,
    sizer: opts.sizer,
  });
  const keyer = (opts.keyer as MemoKeyer<A>) ?? (defaultKeyer as any);
  const sf = new Singleflight<string, V>();

  const getOrLoad = async (key: string, args: A): Promise<V> => {
    const load = () =>
      sf.do(key, async () => {
        try {
          const val = await fn(...args);
          const base = opts.ttlMs ?? 0;
          const jitterMs = base
            ? Math.floor((Math.random() * 2 - 1) * base * (opts.jitter ?? 0))
            : 0;
          store.set(key, val, {
            ttlMs: base + jitterMs,
            slidingTtlMs: opts.slidingTtlMs,
          });
          return val as V;
        } catch (e) {
          if (opts.cacheErrors) {
            // @ts-ignore
            store.set(key, e, { ttlMs: opts.ttlMs ?? 0 });
            // @ts-ignore
            return e as V;
          }
          throw e;
        }
      });

    // Check if entry exists and handle SWR
    const raw = store.peekEntry(key);
    if (raw) {
      const nowMs = now();
      if (!raw.exp || raw.exp > nowMs) {
        // Fresh - trigger LRU bump with get() and return
        return store.get(key)!;
      }
      if (opts.swrMs && nowMs <= raw.exp + opts.swrMs) {
        // Stale but within SWR window - return stale and refresh in background
        defer(() => {
          void load();
        });
        return raw.v;
      }
    }
    // Not cached or expired - load fresh
    return load();
  };

  const memo = (...args: A): Promise<V> | V => {
    const k = keyer(...args);
    const raw = store.peekEntry(k);
    if (raw) {
      const nowMs = now();
      const fresh = raw.exp == null || raw.exp > nowMs;
      if (fresh) {
        // Use get() to trigger LRU bump and return value
        const cached = store.get(k);
        if (cached !== undefined) return cached;
      } else if (
        opts.swrMs &&
        raw.exp != null &&
        nowMs <= raw.exp + opts.swrMs
      ) {
        // Stale but within SWR window - return stale and refresh in background
        defer(() => {
          void getOrLoad(k, args);
        });
        return raw.v;
      }
      // Entry exists but expired (and no SWR) - fall through to load
    }
    // Not in cache or expired - load fresh
    return getOrLoad(k, args);
  };

  (memo as any).cache = store;
  (memo as any).clear = () => store.clear();
  (memo as any).delete = (k: string) => store.del(k);
  return memo as ((...args: A) => Promise<V> | V) & {
    cache: LruTtlCache<string, V>;
    clear(): void;
    delete(k: string): void;
  };
}
