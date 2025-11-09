/**
 * Cache event system for observability
 */

export type CacheEventType =
  | "hit"
  | "miss"
  | "set"
  | "delete"
  | "evict"
  | "clear"
  | "expire";

export interface CacheEvent<K, V> {
  type: CacheEventType;
  key: K;
  value?: V;
  size?: number;
  timestamp: number;
  reason?: string;
}

export type CacheEventListener<K, V> = (event: CacheEvent<K, V>) => void;

export class CacheEventEmitter<K, V> {
  private listeners = new Map<
    CacheEventType | "*",
    Set<CacheEventListener<K, V>>
  >();
  private _hasListeners = false; // Fast check to skip event creation

  on(event: CacheEventType | "*", listener: CacheEventListener<K, V>): () => void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener);
    this.listeners.set(event, set);
    this._hasListeners = true; // Mark that we have listeners
    
    // Return unsubscribe function
    return () => {
      set.delete(listener);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
      // Update flag - check if any listeners remain
      this._hasListeners = this.listeners.size > 0;
    };
  }

  once(event: CacheEventType | "*", listener: CacheEventListener<K, V>): () => void {
    const wrapper: CacheEventListener<K, V> = (evt) => {
      listener(evt);
      unsubscribe();
    };
    const unsubscribe = this.on(event, wrapper);
    return unsubscribe;
  }

  off(event: CacheEventType | "*", listener: CacheEventListener<K, V>) {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(listener);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
      // Update flag - check if any listeners remain
      this._hasListeners = this.listeners.size > 0;
    }
  }

  emit(event: CacheEvent<K, V>) {
    // Fast path: skip if no listeners at all
    if (!this._hasListeners) return;

    // Emit to specific listeners
    const specificListeners = this.listeners.get(event.type);
    if (specificListeners) {
      for (const listener of specificListeners) {
        try {
          listener(event);
        } catch (err) {
          console.error("Cache event listener error:", err);
        }
      }
    }

    // Emit to wildcard listeners
    const wildcardListeners = this.listeners.get("*");
    if (wildcardListeners) {
      for (const listener of wildcardListeners) {
        try {
          listener(event);
        } catch (err) {
          console.error("Cache event listener error:", err);
        }
      }
    }
  }

  removeAllListeners(event?: CacheEventType | "*") {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
    // Update flag
    this._hasListeners = this.listeners.size > 0;
  }

  hasListeners(): boolean {
    return this._hasListeners;
  }

  listenerCount(event: CacheEventType | "*"): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}
