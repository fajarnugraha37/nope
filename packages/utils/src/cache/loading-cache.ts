import {
  LruTtlCache,
  now,
  Singleflight,
  type Entry,
} from "./cache.js";

/* ---------- read-through loader with SWR ---------- */
export type LoaderOpts = {
  /** hard ttl: beyond this we treat as miss and block to refresh */
  ttlMs?: number;
  /** allow returning stale for this period while triggering background refresh */
  staleWhileRevalidateMs?: number;
  /** jitter to spread refresh (0..1) */
  jitter?: number;
};

export class LoadingCache<K, V> {
  constructor(
    private store: LruTtlCache<K, V>,
    private loadFn: (k: K) => Promise<V>,
    private keyToStr?: (k: K) => string
  ) {}
  private sf = new Singleflight<string, V>();

  /** get with loader + swr */
  async get(k: K, opts: LoaderOpts = {}): Promise<V> {
    const key = this.keyToStr ? this.keyToStr(k) : (k as any as string);
    const nowMs = now();

    // peek raw entry (we need metadata)
    const e = (this as any).store.map?.get?.(k) as Entry<V> | undefined; // internal access; ok for our class
    if (e) {
      const hardExp = e.exp ?? Number.POSITIVE_INFINITY;
      const swrUntil =
        e.exp != null && opts.staleWhileRevalidateMs != null
          ? e.exp + opts.staleWhileRevalidateMs
          : undefined;

      // fresh
      if (hardExp > nowMs) return this.store.get(k)!;

      // stale but within SWR window → return stale & kick background refresh
      if (swrUntil != null && nowMs <= swrUntil) {
        void this.refresh(k, key, opts);
        return e.v;
      }
      // else fully expired → block and refresh
      return this.refresh(k, key, opts);
    }

    // miss → load
    return this.refresh(k, key, opts);
  }

  private async refresh(k: K, skey: string, opts: LoaderOpts): Promise<V> {
    const v = await this.sf.do(skey, async () => {
      const val = await this.loadFn(k);
      const baseTtl = opts.ttlMs ?? 0;
      const jitter = opts.jitter ?? 0;
      const jitterMs = baseTtl
        ? Math.floor((Math.random() * 2 - 1) * baseTtl * jitter)
        : 0;
      this.store.set(k, val, { ttlMs: baseTtl + jitterMs });
      return val;
    });
    return v;
  }

  del(k: K) {
    this.store.del(k);
  }
  clear() {
    this.store.clear();
  }
}
