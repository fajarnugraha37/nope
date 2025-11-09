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

  on(event: CacheEventType | "*", listener: CacheEventListener<K, V>): () => void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener);
    this.listeners.set(event, set);
    
    // Return unsubscribe function
    return () => {
      set.delete(listener);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
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
    }
  }

  emit(event: CacheEvent<K, V>) {
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
  }

  listenerCount(event: CacheEventType | "*"): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}
