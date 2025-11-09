/**
 * Optimized LRU+TTL Cache with Object Pooling
 * 
 * Optimization #10: Memory Allocation
 * - Object pooling for Entry and LRUNode objects
 * - Reduced allocation pressure
 * - Lower GC overhead
 * 
 * API-compatible with LruTtlCache - drop-in replacement.
 */

import { CacheStatistics } from "./cache-stats.ts";
import { CacheEventEmitter } from "./cache-events.ts";
import { EntryPool, LRUNodePool, LRUNode } from "./object-pooling.ts";
import type { Entry, Millis, Sizer, Cache, LruTtlOpts } from "./cache.ts";
import { now, jsonSizer } from "./cache.ts";

export class OptimizedLruTtlCache<K, V> implements Cache<K, V> {
  private map = new Map<K, LRUNode<K, V>>();
  private head: LRUNode<K, V> | null = null;
  private tail: LRUNode<K, V> | null = null;
  private totalSize = 0;
  private timer?: any;
  
  private readonly maxEntries: number;
  private readonly maxSize: number;
  private readonly sizer: Sizer<V>;
  private readonly stats?: CacheStatistics;
  private readonly events?: CacheEventEmitter<K, V>;
  private readonly lazyExpiration: boolean;
  
  // Object pools
  private readonly entryPool: EntryPool<V>;
  private readonly nodePool: LRUNodePool<K, V>;

  constructor(opts: LruTtlOpts<V> = {}) {
    this.maxEntries = opts.maxEntries ?? 1000;
    this.maxSize = opts.maxSize ?? Number.POSITIVE_INFINITY;
    this.sizer = opts.sizer ?? jsonSizer;
    this.lazyExpiration = opts.lazyExpiration ?? true;
    
    const iv = opts.sweepIntervalMs ?? 0;
    if (iv > 0) this.timer = setInterval(() => this.sweep(), iv).unref?.();
    if (opts.enableStats) this.stats = new CacheStatistics();
    if (opts.enableEvents) this.events = new CacheEventEmitter<K, V>();
    
    // Initialize object pools with reasonable sizes
    const poolSize = Math.min(this.maxEntries, 1000);
    this.entryPool = new EntryPool<V>(poolSize);
    this.nodePool = new LRUNodePool<K, V>(poolSize);
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

    // Update sliding TTL timestamp
    node.entry.t = now();

    // Move to head (most recently used)
    this.moveToHead(node);

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
  ): void {
    const t = now();
    const sz = opts?.size ?? this.sizer(val);
    const exp = opts?.ttlMs ? t + opts.ttlMs : undefined;
    const sl = opts?.slidingTtlMs;

    const existing = this.map.get(key);
    if (existing) {
      // Update existing entry - reuse the same Entry object
      const oldSize = existing.entry.sz;
      existing.entry.v = val;
      existing.entry.sz = sz;
      existing.entry.t = t;
      existing.entry.exp = exp;
      existing.entry.sl = sl;

      this.totalSize = this.totalSize - oldSize + sz;
      this.moveToHead(existing);

      this.stats?.recordSet();
      if (this.events?.hasListeners()) {
        this.events.emit({ type: "set", key, value: val, timestamp: t });
      }
      return;
    }

    // Evict if at capacity
    if (this.map.size >= this.maxEntries || this.totalSize + sz > this.maxSize) {
      if (this.map.size >= this.maxEntries) {
        this.evictLRU();
      }
      while (this.totalSize + sz > this.maxSize && this.tail) {
        this.evictLRU();
      }
    }

    // Create new entry using pool
    const entry = this.entryPool.acquire(val, sz, t, exp, sl);
    const node = this.nodePool.acquire(key, entry);

    this.map.set(key, node);
    this.totalSize += sz;
    this.addToHead(node);

    this.stats?.recordSet();
    if (this.events?.hasListeners()) {
      this.events.emit({ type: "set", key, value: val, timestamp: t });
    }
  }

  has(key: K): boolean {
    const node = this.map.get(key);
    if (!node) return false;
    if (this.isExpired(node.entry)) {
      this.removeNode(node);
      return false;
    }
    return true;
  }

  del(key: K): void {
    const node = this.map.get(key);
    if (!node) return;
    this.removeNode(node);
    
    this.stats?.recordDelete();
    if (this.events?.hasListeners()) {
      this.events.emit({ type: "delete", key, timestamp: now() });
    }
  }

  clear(): void {
    // Release all nodes and entries back to pools
    for (const node of this.map.values()) {
      this.entryPool.release(node.entry);
      this.nodePool.release(node);
    }
    
    this.map.clear();
    this.head = null;
    this.tail = null;
    this.totalSize = 0;
  }

  size(): number {
    return this.map.size;
  }

  /* ---------- Optimized Batch Operations ---------- */

  /**
   * Get multiple values in a single operation
   * Optimized: Single Map iteration, batch event emission
   */
  getMany(keys: K[]): Map<K, V> {
    const results = new Map<K, V>();
    const t = now();
    
    // Fast path: check if we need stats/events
    const needsStats = this.stats !== undefined;
    const needsEvents = this.events?.hasListeners() ?? false;
    
    let hits = 0;
    let misses = 0;

    // Single iteration through keys
    for (const key of keys) {
      const node = this.map.get(key);
      if (!node || this.isExpired(node.entry)) {
        if (needsStats || needsEvents) misses++;
        if (node && this.isExpired(node.entry)) {
          this.removeNode(node);
        }
        continue;
      }

      // Update sliding TTL
      node.entry.t = t;
      
      // Move to head (LRU)
      this.moveToHead(node);
      
      results.set(key, node.entry.v);
      if (needsStats || needsEvents) hits++;
    }

    // Batch statistics update
    if (needsStats) {
      for (let i = 0; i < hits; i++) this.stats!.recordHit();
      for (let i = 0; i < misses; i++) this.stats!.recordMiss();
    }

    // Batch event emission (single event for all operations)
    if (needsEvents) {
      this.events!.emit({
        type: "batch-get",
        keys,
        results,
        hits,
        misses,
        timestamp: t,
      } as any);
    }

    return results;
  }

  /**
   * Set multiple values in a single operation
   * Optimized: Bulk operations, single event emission, batch stats
   */
  setMany(
    entries: Array<[K, V]> | Map<K, V>,
    opts?: { ttlMs?: number; slidingTtlMs?: number }
  ): void {
    const pairs = entries instanceof Map ? Array.from(entries) : entries;
    const t = now();
    const exp = opts?.ttlMs ? t + opts.ttlMs : undefined;
    const sl = opts?.slidingTtlMs;
    
    let updates = 0;
    let inserts = 0;
    
    // Fast path: check if we need stats/events
    const needsStats = this.stats !== undefined;
    const needsEvents = this.events?.hasListeners() ?? false;

    // Process all entries
    for (const [key, val] of pairs) {
      const sz = this.sizer(val);
      const existing = this.map.get(key);

      if (existing) {
        // Update existing entry
        const oldSize = existing.entry.sz;
        existing.entry.v = val;
        existing.entry.sz = sz;
        existing.entry.t = t;
        existing.entry.exp = exp;
        existing.entry.sl = sl;

        this.totalSize = this.totalSize - oldSize + sz;
        this.moveToHead(existing);
        if (needsStats || needsEvents) updates++;
      } else {
        // Check capacity before inserting
        if (this.map.size >= this.maxEntries || this.totalSize + sz > this.maxSize) {
          if (this.map.size >= this.maxEntries) {
            this.evictLRU();
          }
          while (this.totalSize + sz > this.maxSize && this.tail) {
            this.evictLRU();
          }
        }

        // Create new entry
        const entry = this.entryPool.acquire(val, sz, t, exp, sl);
        const node = this.nodePool.acquire(key, entry);

        this.map.set(key, node);
        this.totalSize += sz;
        this.addToHead(node);
        if (needsStats || needsEvents) inserts++;
      }
    }

    // Batch statistics update
    if (needsStats) {
      const totalOps = updates + inserts;
      for (let i = 0; i < totalOps; i++) {
        this.stats!.recordSet();
      }
    }

    // Batch event emission (single event for all operations)
    if (needsEvents) {
      this.events!.emit({
        type: "batch-set",
        count: pairs.length,
        updates,
        inserts,
        timestamp: t,
      } as any);
    }
  }

  /**
   * Delete multiple values in a single operation
   * Optimized: Bulk deletion, single event emission, batch stats
   */
  deleteMany(keys: K[]): number {
    let deleted = 0;

    // Process all deletions - fast path without timestamp
    for (const key of keys) {
      const node = this.map.get(key);
      if (node) {
        // Direct removal without per-item overhead
        if (node.prev) node.prev.next = node.next;
        else this.head = node.next;

        if (node.next) node.next.prev = node.prev;
        else this.tail = node.prev;

        this.map.delete(node.key);
        this.totalSize -= node.entry.sz;
        
        // Return objects to pools
        this.entryPool.release(node.entry);
        this.nodePool.release(node);
        
        deleted++;
      }
    }

    // Batch statistics update
    if (this.stats) {
      for (let i = 0; i < deleted; i++) {
        this.stats.recordDelete();
      }
    }

    // Batch event emission (single event for all operations)
    if (this.events?.hasListeners()) {
      this.events.emit({
        type: "batch-delete",
        keys,
        deleted,
        timestamp: now(),
      } as any);
    }

    return deleted;
  }

  /**
   * Check existence of multiple keys in a single operation
   * Optimized: Single Map iteration, no event emission needed
   */
  hasMany(keys: K[]): Map<K, boolean> {
    const results = new Map<K, boolean>();

    // Single iteration through keys
    for (const key of keys) {
      const node = this.map.get(key);
      if (!node) {
        results.set(key, false);
        continue;
      }

      if (this.isExpired(node.entry)) {
        this.removeNode(node);
        results.set(key, false);
      } else {
        results.set(key, true);
      }
    }

    return results;
  }

  /* ---------- Expiration helpers ---------- */

  private isExpired(entry: Entry<V>): boolean {
    const t = now();
    if (entry.exp && t >= entry.exp) return true;
    if (entry.sl && t - entry.t >= entry.sl) return true;
    return false;
  }

  private sweep(): void {
    const toRemove: K[] = [];
    for (const [key, node] of this.map) {
      if (this.isExpired(node.entry)) {
        toRemove.push(key);
      }
    }
    for (const key of toRemove) {
      const node = this.map.get(key);
      if (node) {
        this.removeNode(node);
        this.stats?.recordEviction();
        if (this.events?.hasListeners()) {
          this.events.emit({ 
            type: "evict", 
            key, 
            reason: "expired", 
            timestamp: now() 
          });
        }
      }
    }
  }

  /* ---------- LRU list operations ---------- */

  private addToHead(node: LRUNode<K, V>): void {
    node.prev = null;
    node.next = this.head;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
  }

  private removeNode(node: LRUNode<K, V>): void {
    if (node.prev) node.prev.next = node.next;
    else this.head = node.next;

    if (node.next) node.next.prev = node.prev;
    else this.tail = node.prev;

    this.map.delete(node.key);
    this.totalSize -= node.entry.sz;
    
    // Return objects to pools
    this.entryPool.release(node.entry);
    this.nodePool.release(node);
  }

  private moveToHead(node: LRUNode<K, V>): void {
    if (node === this.head) return;

    // Unlink from current position
    if (node.prev) node.prev.next = node.next;
    if (node.next) node.next.prev = node.prev;
    else this.tail = node.prev;

    // Move to head
    node.prev = null;
    node.next = this.head;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
  }

  private evictLRU(): void {
    if (!this.tail) return;
    const key = this.tail.key;
    
    this.stats?.recordEviction();
    if (this.events?.hasListeners()) {
      this.events.emit({ 
        type: "evict", 
        key, 
        reason: "lru", 
        timestamp: now() 
      });
    }
    
    this.removeNode(this.tail);
  }

  /* ---------- Stats & Events ---------- */

  getStatistics(): CacheStatistics | undefined {
    return this.stats;
  }

  getEvents(): CacheEventEmitter<K, V> | undefined {
    return this.events;
  }

  /* ---------- Cleanup ---------- */

  dispose(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.clear();
    this.entryPool.clear();
    this.nodePool.clear();
  }
}
