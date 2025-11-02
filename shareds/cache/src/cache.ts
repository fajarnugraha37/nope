export type Millis = number;
export const now = () => Date.now();
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/* ---------- size estimator (rough) ---------- */
export type Sizer<T> = (v: T) => number;
export const jsonSizer: Sizer<any> = (v) => {
  try {
    return JSON.stringify(v).length;
  } catch {
    return 64;
  }
};

/* ---------- core entry ---------- */
export type Entry<V> = {
  v: V;
  exp?: Millis; // absolute expiry (epoch ms)
  sl?: Millis; // sliding ttl (ms)
  sz: number; // size units
  t: Millis; // last access (for LRU + sliding)
};

/* ---------- Cache interface ---------- */
export interface Cache<K, V> {
  get(key: K): V | undefined;
  set(
    key: K,
    val: V,
    opts?: { ttlMs?: number; slidingTtlMs?: number; size?: number }
  ): void;
  has(key: K): boolean;
  del(key: K): void;
  clear(): void;
  size(): number; // entries count
}

/* ---------- LRU + TTL in one (in-memory) ---------- */
export type LruTtlOpts<V> = {
  maxEntries?: number; // cap by count
  maxSize?: number; // cap by size units (uses sizer)
  sizer?: Sizer<V>;
  sweepIntervalMs?: number; // optional janitor (expire)
};

export class LruTtlCache<K, V> implements Cache<K, V> {
  private map = new Map<K, Entry<V>>(); // maintains recency via reinsertion
  private totalSize = 0;
  private timer?: any;
  private readonly maxEntries;
  private readonly maxSize;
  private readonly sizer: Sizer<V>;

  constructor(opts: LruTtlOpts<V> = {}) {
    this.maxEntries = opts.maxEntries ?? 1000;
    this.maxSize = opts.maxSize ?? Number.POSITIVE_INFINITY;
    this.sizer = opts.sizer ?? jsonSizer;
    const iv = opts.sweepIntervalMs ?? 0;
    if (iv > 0) this.timer = setInterval(() => this.sweep(), iv).unref?.();
  }

  get(key: K): V | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (this.isExpired(e)) {
      this.drop(key, e);
      return undefined;
    }
    // sliding ttl => bump expiry
    if (e.sl) e.exp = now() + e.sl;
    e.t = now();
    // lru bump: delete+set to move to end
    this.map.delete(key);
    this.map.set(key, e);
    return e.v;
  }

  set(
    key: K,
    val: V,
    opts?: { ttlMs?: number; slidingTtlMs?: number; size?: number }
  ) {
    const sz = opts?.size ?? this.sizer(val);
    const e: Entry<V> = {
      v: val,
      exp: opts?.ttlMs != null ? now() + opts.ttlMs : undefined,
      sl: opts?.slidingTtlMs,
      sz,
      t: now(),
    };
    // replace
    const prev = this.map.get(key);
    if (prev) this.totalSize -= prev.sz;
    this.map.set(key, e);
    this.totalSize += sz;

    this.evict();
  }

  has(key: K): boolean {
    const v = this.get(key);
    return v !== undefined;
  }

  del(key: K) {
    const e = this.map.get(key);
    if (!e) return;
    this.drop(key, e);
  }

  clear() {
    this.map.clear();
    this.totalSize = 0;
  }

  size(): number {
    return this.map.size;
  }
  total(): number {
    return this.totalSize;
  }

  private isExpired(e: Entry<V>) {
    return e.exp != null && e.exp <= now();
  }

  private drop(key: K, e: Entry<V>) {
    this.map.delete(key);
    this.totalSize -= e.sz;
  }

  private evict() {
    // evict expired first
    this.sweep();
    // then size > maxSize
    while (this.totalSize > this.maxSize && this.map.size > 0) {
      // remove least recently used = first item in Map
      const [k, e] = this.map.entries().next().value as [K, Entry<V>];
      this.drop(k, e);
    }
    // then count > maxEntries
    while (this.map.size > this.maxEntries) {
      const [k, e] = this.map.entries().next().value as [K, Entry<V>];
      this.drop(k, e);
    }
  }

  private sweep() {
    const n = now();
    for (const [k, e] of this.map) {
      if (e.exp != null && e.exp <= n) this.drop(k, e);
    }
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }
}

/* ---------- singleflight (dedupe in-flight by key) ---------- */
export class Singleflight<K, V> {
  private inflight = new Map<K, Promise<V>>();
  do(key: K, fn: () => Promise<V>): Promise<V> {
    const p = this.inflight.get(key);
    if (p) return p;
    const run = fn().finally(() => this.inflight.delete(key));
    this.inflight.set(key, run);
    return run;
  }
}
