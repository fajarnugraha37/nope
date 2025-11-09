/**
 * Flat Array Cache - Phase 2 Optimization
 * 
 * Uses FlatEntryStorage (parallel arrays) instead of Entry objects.
 * Eliminates ~64 bytes/entry object header overhead.
 * 
 * Expected Impact:
 * - Memory: -30-50% reduction
 * - Objects: -60% fewer objects
 * - GC Overhead: -40-60% reduction
 * - Performance: +20-30% throughput
 */

import { CacheStatistics } from "./cache-stats.ts";
import { CacheEventEmitter } from "./cache-events.ts";
import { FlatEntryStorage } from "./flat-storage.ts";
import type { Millis, Sizer, Cache, LruTtlOpts } from "./cache.ts";
import { now, jsonSizer } from "./cache.ts";

/**
 * Simplified LRU node that stores entry index instead of Entry object.
 * Eliminates generic complexity and reference overhead.
 */
class IndexNode<K> {
  constructor(
    public key: K,
    public entryIndex: number,
    public prev: IndexNode<K> | null = null,
    public next: IndexNode<K> | null = null
  ) {}
}

/**
 * Simple node pool for IndexNode recycling.
 */
class IndexNodePool<K> {
  private pool: IndexNode<K>[] = [];
  private readonly maxPoolSize: number;

  constructor(maxPoolSize: number = 1000) {
    this.maxPoolSize = maxPoolSize;
  }

  acquire(key: K, entryIndex: number): IndexNode<K> {
    const node = this.pool.pop();
    if (node) {
      node.key = key;
      node.entryIndex = entryIndex;
      node.prev = null;
      node.next = null;
      return node;
    }
    return new IndexNode(key, entryIndex);
  }

  release(node: IndexNode<K>): void {
    if (this.pool.length < this.maxPoolSize) {
      (node as any).key = undefined;
      node.entryIndex = -1;
      node.prev = null;
      node.next = null;
      this.pool.push(node);
    }
  }

  clear(): void {
    this.pool.length = 0;
  }
}

/**
 * Advanced optimized cache with flat array structure.
 * Uses parallel arrays instead of Entry objects to save memory.
 */
export class FlatArrayCache<K, V> implements Cache<K, V> {
  private map = new Map<K, IndexNode<K>>();
  private head: IndexNode<K> | null = null;
  private tail: IndexNode<K> | null = null;
  private totalSize = 0;
  private timer?: any;

  private readonly maxEntries: number;
  private readonly maxSize: number;
  private readonly sizer: Sizer<V>;
  private readonly stats?: CacheStatistics;
  private readonly events?: CacheEventEmitter<K, V>;
  private readonly lazyExpiration: boolean;

  // Flat storage and node pool
  private readonly storage: FlatEntryStorage<V>;
  private readonly nodePool: IndexNodePool<K>;

  constructor(opts: LruTtlOpts<V> = {}) {
    this.maxEntries = opts.maxEntries ?? 1000;
    this.maxSize = opts.maxSize ?? Number.POSITIVE_INFINITY;
    this.sizer = opts.sizer ?? jsonSizer;
    this.lazyExpiration = opts.lazyExpiration ?? true;

    const iv = opts.sweepIntervalMs ?? 0;
    if (iv > 0) this.timer = setInterval(() => this.sweep(), iv).unref?.();
    if (opts.enableStats) this.stats = new CacheStatistics();
    if (opts.enableEvents) this.events = new CacheEventEmitter<K, V>();

    // Initialize flat storage and node pool
    this.storage = new FlatEntryStorage<V>(this.maxEntries);
    this.nodePool = new IndexNodePool<K>(Math.min(this.maxEntries, 1000));
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

    const entryIndex = node.entryIndex;
    const t = now();

    if (this.storage.isExpired(entryIndex, t)) {
      this.removeNode(node);
      this.stats?.recordMiss();
      if (this.events?.hasListeners()) {
        this.events.emit({ type: "miss", key, timestamp: t, reason: "expired" });
      }
      return undefined;
    }

    // Update last access time
    this.storage.setLastAccess(entryIndex, t);

    // Move to head (most recently used)
    this.moveToHead(node);

    this.stats?.recordHit();
    const value = this.storage.getValue(entryIndex);
    if (this.events?.hasListeners()) {
      this.events.emit({ type: "hit", key, value, timestamp: t });
    }

    return value;
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
      // Update existing entry
      const entryIndex = existing.entryIndex;
      const oldSize = this.storage.getSize(entryIndex);

      this.storage.setValue(entryIndex, val);
      this.storage.setSize(entryIndex, sz);
      this.storage.setLastAccess(entryIndex, t);
      this.storage.setExpires(entryIndex, exp);
      this.storage.setSliding(entryIndex, sl);

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

    // Allocate new entry in flat storage
    const entryIndex = this.storage.allocate(val, sz, t, exp, sl);
    const node = this.nodePool.acquire(key, entryIndex);

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

    const t = now();
    if (this.storage.isExpired(node.entryIndex, t)) {
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
    // Release all nodes back to pool
    for (const node of this.map.values()) {
      this.storage.free(node.entryIndex);
      this.nodePool.release(node);
    }

    this.map.clear();
    this.head = null;
    this.tail = null;
    this.totalSize = 0;
    this.storage.clear();
  }

  size(): number {
    return this.map.size;
  }

  /* ---------- Batch Operations ---------- */

  getMany(keys: K[]): Map<K, V> {
    const results = new Map<K, V>();
    const t = now();

    for (const key of keys) {
      const node = this.map.get(key);
      if (!node || this.storage.isExpired(node.entryIndex, t)) {
        if (node && this.storage.isExpired(node.entryIndex, t)) {
          this.removeNode(node);
        }
        continue;
      }

      // Update sliding TTL
      this.storage.setLastAccess(node.entryIndex, t);

      // Move to head (LRU)
      this.moveToHead(node);

      results.set(key, this.storage.getValue(node.entryIndex));
    }

    return results;
  }

  setMany(
    entries: Array<[K, V]> | Map<K, V>,
    opts?: { ttlMs?: number; slidingTtlMs?: number }
  ): void {
    const pairs = entries instanceof Map ? Array.from(entries) : entries;
    for (const [key, value] of pairs) {
      this.set(key, value, opts);
    }
  }

  deleteMany(keys: K[]): number {
    let deleted = 0;
    for (const key of keys) {
      const node = this.map.get(key);
      if (node) {
        this.removeNode(node);
        deleted++;
      }
    }
    return deleted;
  }

  hasMany(keys: K[]): Map<K, boolean> {
    const results = new Map<K, boolean>();
    const t = now();

    for (const key of keys) {
      const node = this.map.get(key);
      if (!node) {
        results.set(key, false);
        continue;
      }

      if (this.storage.isExpired(node.entryIndex, t)) {
        this.removeNode(node);
        results.set(key, false);
      } else {
        results.set(key, true);
      }
    }

    return results;
  }

  /* ---------- Expiration helpers ---------- */

  private sweep(): void {
    const toRemove: K[] = [];
    const t = now();

    for (const [key, node] of this.map) {
      if (this.storage.isExpired(node.entryIndex, t)) {
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
            timestamp: t,
          });
        }
      }
    }
  }

  /* ---------- LRU list operations ---------- */

  private addToHead(node: IndexNode<K>): void {
    node.prev = null;
    node.next = this.head;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
  }

  private removeNode(node: IndexNode<K>): void {
    if (node.prev) node.prev.next = node.next;
    else this.head = node.next;

    if (node.next) node.next.prev = node.prev;
    else this.tail = node.prev;

    this.map.delete(node.key);
    this.totalSize -= this.storage.getSize(node.entryIndex);

    // Return to pools
    this.storage.free(node.entryIndex);
    this.nodePool.release(node);
  }

  private moveToHead(node: IndexNode<K>): void {
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
        timestamp: now(),
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

  /**
   * Get storage statistics for monitoring.
   */
  getStorageStats() {
    return this.storage.getStats();
  }

  /* ---------- Cleanup ---------- */

  dispose(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.clear();
    this.nodePool.clear();
  }
}
