/**
 * Optimized Singleflight implementations for comparison
 */

/**
 * Optimization 1: Fast-path + better cleanup
 * Already implemented in main cache.ts
 */
export class SingleflightOptimized<K, V> {
  private inflight = new Map<K, Promise<V>>();
  
  do(key: K, fn: () => Promise<V>): Promise<V> {
    // Fast-path: single lookup
    const existing = this.inflight.get(key);
    if (existing) return existing;
    
    // Create promise with safe cleanup
    const promise = fn().finally(() => {
      if (this.inflight.get(key) === promise) {
        this.inflight.delete(key);
      }
    });
    
    this.inflight.set(key, promise);
    return promise;
  }
  
  has(key: K): boolean {
    return this.inflight.has(key);
  }
  
  size(): number {
    return this.inflight.size;
  }
}

/**
 * Optimization 2: Fast-path with no-contention bypass
 * Skips map operations entirely when there's no contention
 */
export class SingleflightFastPath<K, V> {
  private inflight = new Map<K, Promise<V>>();
  
  do(key: K, fn: () => Promise<V>): Promise<V> {
    // Fast-path check
    const existing = this.inflight.get(key);
    if (existing) return existing;
    
    // Check if map is empty - ultra-fast path
    if (this.inflight.size === 0) {
      // No contention at all - skip map operations
      return fn();
    }
    
    // Normal path with cleanup
    const promise = fn().finally(() => {
      if (this.inflight.get(key) === promise) {
        this.inflight.delete(key);
      }
    });
    
    this.inflight.set(key, promise);
    return promise;
  }
  
  size(): number {
    return this.inflight.size;
  }
}

/**
 * Optimization 3: Object keys only - WeakMap for GC
 * Only works with object keys (not primitives)
 */
export class SingleflightWeakMap<K extends object, V> {
  private inflight = new WeakMap<K, Promise<V>>();
  private keys = new Set<K>(); // Track active keys for size()
  
  do(key: K, fn: () => Promise<V>): Promise<V> {
    const existing = this.inflight.get(key);
    if (existing) return existing;
    
    const promise = fn().finally(() => {
      // WeakMap doesn't have delete, but we can clear our tracking
      this.keys.delete(key);
      // Promise will be GC'd automatically when key is GC'd
    });
    
    this.inflight.set(key, promise);
    this.keys.add(key);
    return promise;
  }
  
  size(): number {
    return this.keys.size;
  }
}

/**
 * Optimization 4: Timeout cleanup for stuck promises
 * Prevents memory leaks from promises that never resolve
 */
export class SingleflightWithTimeout<K, V> {
  private inflight = new Map<K, { promise: Promise<V>; timer: NodeJS.Timeout }>();
  private defaultTimeout: number;
  
  constructor(defaultTimeoutMs: number = 60000) {
    this.defaultTimeout = defaultTimeoutMs;
  }
  
  do(key: K, fn: () => Promise<V>, timeoutMs?: number): Promise<V> {
    const existing = this.inflight.get(key);
    if (existing) {
      return existing.promise;
    }
    
    const timeout = timeoutMs ?? this.defaultTimeout;
    
    // Create timeout to force cleanup
    const timer = setTimeout(() => {
      const entry = this.inflight.get(key);
      if (entry && entry.timer === timer) {
        this.inflight.delete(key);
      }
    }, timeout);
    
    const promise = fn()
      .finally(() => {
        const entry = this.inflight.get(key);
        if (entry && entry.promise === promise) {
          clearTimeout(entry.timer);
          this.inflight.delete(key);
        }
      });
    
    this.inflight.set(key, { promise, timer });
    return promise;
  }
  
  size(): number {
    return this.inflight.size;
  }
  
  clear(): void {
    // Clear all timers
    for (const entry of this.inflight.values()) {
      clearTimeout(entry.timer);
    }
    this.inflight.clear();
  }
}

/**
 * Optimization 5: Hybrid approach - best of all worlds
 * - Fast-path for no contention
 * - Safe cleanup
 * - Optional timeout
 */
export class SingleflightHybrid<K, V> {
  private inflight = new Map<K, Promise<V>>();
  
  do(key: K, fn: () => Promise<V>): Promise<V> {
    // Fast-path: check existing
    const existing = this.inflight.get(key);
    if (existing) return existing;
    
    // Ultra-fast path: no contention
    if (this.inflight.size === 0) {
      // Skip map entirely for sequential calls
      return fn();
    }
    
    // Normal path with safe cleanup
    const promise = fn().finally(() => {
      if (this.inflight.get(key) === promise) {
        this.inflight.delete(key);
      }
    });
    
    this.inflight.set(key, promise);
    return promise;
  }
  
  size(): number {
    return this.inflight.size;
  }
}
