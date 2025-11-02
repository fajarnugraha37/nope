import {
  LruTtlCache,
  now,
  Singleflight,
  type Entry,
  type Sizer,
} from "./cache.js";

const defer =
  typeof queueMicrotask === "function"
    ? queueMicrotask
    : (fn: () => void) => {
        void Promise.resolve().then(fn);
      };

/* ---------- memoize (sync/async) ---------- */
export type MemoKeyer<A extends any[]> = (...args: A) => string;
const defaultKeyer = (args: any[]) => {
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

    // check store & swr behavior
    const raw = (store as any).map?.get?.(key) as Entry<V> | undefined;
    if (raw) {
      if (!raw.exp || raw.exp > now()) return store.get(key)!; // fresh
      if (opts.swrMs && now() <= raw.exp + opts.swrMs) {
        defer(() => {
          void load();
        }); // kick bg refresh asynchronously
        return raw.v; // return stale
      }
    }
    return load();
  };

  const memo = (...args: A): Promise<V> | V => {
    const k = keyer(...args);
    const raw = (store as any).map?.get?.(k) as Entry<V> | undefined;
    if (raw) {
      const nowMs = now();
      const fresh = raw.exp == null || raw.exp > nowMs;
      if (fresh) {
        const cached = store.get(k);
        if (cached !== undefined) return cached;
      } else if (
        opts.swrMs &&
        raw.exp != null &&
        nowMs <= raw.exp + opts.swrMs
      ) {
        defer(() => {
          void getOrLoad(k, args);
        });
        return raw.v;
      }
    }
    const cached = store.get(k);
    if (cached !== undefined) return cached;
    // possibly async path
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
