import { CacheStatistics } from "./cache-stats.ts";
import { CacheEventEmitter } from "./cache-events.ts";

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

/* ---------- doubly-linked list node for LRU ---------- */
class LRUNode<K, V> {
  constructor(
    public key: K,
    public entry: Entry<V>,
    public prev: LRUNode<K, V> | null = null,
    public next: LRUNode<K, V> | null = null
  ) {}
}

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
  sweepIntervalMs?: number; // optional janitor (expire) - 0 = lazy only
  enableStats?: boolean; // track hit/miss/eviction metrics
  enableEvents?: boolean; // emit cache events
  lazyExpiration?: boolean; // if true, only check expiration on access (default: true)
};

export class LruTtlCache<K, V> implements Cache<K, V> {
  private map = new Map<K, LRUNode<K, V>>(); // O(1) lookup
  private head: LRUNode<K, V> | null = null; // Most recently used
  private tail: LRUNode<K, V> | null = null; // Least recently used
  private totalSize = 0;
  private timer?: any;
  private readonly maxEntries;
  private readonly maxSize;
  private readonly sizer: Sizer<V>;
  private readonly stats?: CacheStatistics;
  private readonly events?: CacheEventEmitter<K, V>;
  private readonly lazyExpiration: boolean;

  constructor(opts: LruTtlOpts<V> = {}) {
    this.maxEntries = opts.maxEntries ?? 1000;
    this.maxSize = opts.maxSize ?? Number.POSITIVE_INFINITY;
    this.sizer = opts.sizer ?? jsonSizer;
    this.lazyExpiration = opts.lazyExpiration ?? true; // Default to lazy
    const iv = opts.sweepIntervalMs ?? 0;
    if (iv > 0) this.timer = setInterval(() => this.sweep(), iv).unref?.();
    if (opts.enableStats) this.stats = new CacheStatistics();
    if (opts.enableEvents) this.events = new CacheEventEmitter<K, V>();
  }

  get(key: K): V | undefined {
    const node = this.map.get(key);
    if (!node) {
      this.stats?.recordMiss();
      if (this.events?.hasListeners()) {
        this.events.emit({ type: "miss", key, timestamp: now() });
      }
      return undefined;
    }
    if (this.isExpired(node.entry)) {
      this.removeNode(node);
      this.stats?.recordMiss();
      if (this.events?.hasListeners()) {
        this.events.emit({ type: "miss", key, timestamp: now(), reason: "expired" });
      }
      return undefined;
    }
    // sliding ttl => bump expiry
    if (node.entry.sl) node.entry.exp = now() + node.entry.sl;
    node.entry.t = now();
    // Move to front (most recently used) - O(1)
    this.moveToFront(node);
    this.stats?.recordHit();
    if (this.events?.hasListeners()) {
      this.events.emit({ type: "hit", key, value: node.entry.v, timestamp: now() });
    }
    return node.entry.v;
  }

  set(
    key: K,
    val: V,
    opts?: { ttlMs?: number; slidingTtlMs?: number; size?: number }
  ) {
    const sz = opts?.size ?? this.sizer(val);
    const entry: Entry<V> = {
      v: val,
      exp: opts?.ttlMs != null ? now() + opts.ttlMs : undefined,
      sl: opts?.slidingTtlMs,
      sz,
      t: now(),
    };
    
    // Check if key exists
    const existingNode = this.map.get(key);
    if (existingNode) {
      // Update existing node
      this.totalSize -= existingNode.entry.sz;
      existingNode.entry = entry;
      this.totalSize += sz;
      this.moveToFront(existingNode);
    } else {
      // Create new node and add to front
      const node = new LRUNode(key, entry);
      this.map.set(key, node);
      this.addToFront(node);
      this.totalSize += sz;
    }

    this.stats?.recordSet();
    this.stats?.updateSize(this.map.size, this.totalSize);
    if (this.events?.hasListeners()) {
      this.events.emit({ type: "set", key, value: val, size: sz, timestamp: now() });
    }

    this.evict();
  }

  has(key: K): boolean {
    const v = this.get(key);
    return v !== undefined;
  }

  del(key: K) {
    const node = this.map.get(key);
    if (!node) return;
    this.stats?.recordDelete();
    this.stats?.updateSize(this.map.size - 1, this.totalSize - node.entry.sz);
    if (this.events?.hasListeners()) {
      this.events.emit({ type: "delete", key, value: node.entry.v, size: node.entry.sz, timestamp: now() });
    }
    this.removeNode(node);
  }

  clear() {
    const size = this.map.size;
    this.map.clear();
    this.head = null;
    this.tail = null;
    this.totalSize = 0;
    this.stats?.updateSize(0, 0);
    if (size > 0 && this.events?.hasListeners()) {
      this.events.emit({ type: "clear", key: null as any, timestamp: now() });
    }
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

  // Doubly-linked list operations (O(1))
  private addToFront(node: LRUNode<K, V>) {
    node.next = this.head;
    node.prev = null;
    
    if (this.head) {
      this.head.prev = node;
    }
    this.head = node;
    
    if (!this.tail) {
      this.tail = node;
    }
  }

  private removeNode(node: LRUNode<K, V>) {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }
    
    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
    
    this.map.delete(node.key);
    this.totalSize -= node.entry.sz;
    
    // Emit event if needed
    if (this.events?.hasListeners() && node.entry.exp && node.entry.exp <= now()) {
      this.events.emit({ 
        type: "expire", 
        key: node.key, 
        value: node.entry.v, 
        size: node.entry.sz, 
        timestamp: now(),
        reason: "expired"
      });
    }
  }

  private moveToFront(node: LRUNode<K, V>) {
    if (node === this.head) return; // Already at front
    
    // Remove from current position
    if (node.prev) {
      node.prev.next = node.next;
    }
    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
    
    // Add to front
    node.next = this.head;
    node.prev = null;
    if (this.head) {
      this.head.prev = node;
    }
    this.head = node;
  }

  private evict() {
    if (this.lazyExpiration) {
      // Lazy strategy: check expired entries opportunistically during eviction
      // Only sweep if we need space and check tail region first
      const needsSpace = this.totalSize > this.maxSize || this.map.size > this.maxEntries;
      if (needsSpace) {
        this.batchedSweep(10); // Check up to 10 entries from tail
      }
    } else {
      // Active strategy: full sweep (old behavior)
      this.sweep();
    }
    
    // then size > maxSize
    while (this.totalSize > this.maxSize && this.tail) {
      // remove least recently used = tail
      this.stats?.recordEviction();
      const node = this.tail;
      if (this.events?.hasListeners()) {
        this.events.emit({ 
          type: "evict", 
          key: node.key, 
          value: node.entry.v, 
          size: node.entry.sz, 
          timestamp: now(),
          reason: "size-limit"
        });
      }
      this.removeNode(node);
    }
    
    // then count > maxEntries
    while (this.map.size > this.maxEntries && this.tail) {
      this.stats?.recordEviction();
      const node = this.tail;
      if (this.events?.hasListeners()) {
        this.events.emit({ 
          type: "evict", 
          key: node.key, 
          value: node.entry.v, 
          size: node.entry.sz, 
          timestamp: now(),
          reason: "count-limit"
        });
      }
      this.removeNode(this.tail);
    }
    this.stats?.updateSize(this.map.size, this.totalSize);
  }

  private batchedSweep(maxChecks: number) {
    // Check up to maxChecks entries from tail (LRU)
    // This is more efficient than full sweep as LRU entries are more likely expired
    const n = now();
    let node = this.tail;
    let checked = 0;
    
    while (node && checked < maxChecks) {
      const prev = node.prev; // Save before potential removal
      if (node.entry.exp != null && node.entry.exp <= n) {
        this.removeNode(node);
      }
      node = prev;
      checked++;
    }
  }

  private sweep() {
    const n = now();
    let node = this.head;
    while (node) {
      const next = node.next;
      if (node.entry.exp != null && node.entry.exp <= n) {
        this.removeNode(node);
      }
      node = next;
    }
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  getStats() {
    return this.stats?.getMetrics();
  }

  resetStats() {
    this.stats?.reset();
  }

  on(...args: Parameters<CacheEventEmitter<K, V>["on"]>) {
    return this.events?.on(...args);
  }

  once(...args: Parameters<CacheEventEmitter<K, V>["once"]>) {
    return this.events?.once(...args);
  }

  off(...args: Parameters<CacheEventEmitter<K, V>["off"]>) {
    this.events?.off(...args);
  }

  /** Internal method for LoadingCache to peek at entry metadata */
  peekEntry(key: K): Entry<V> | undefined {
    const node = this.map.get(key);
    return node?.entry;
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
