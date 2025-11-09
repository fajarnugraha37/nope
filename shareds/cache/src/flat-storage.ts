/**
 * Flat Entry Storage - Phase 2 Optimization
 * 
 * Stores entry fields in parallel arrays instead of creating Entry objects.
 * Eliminates ~64 bytes/entry object header overhead.
 * 
 * Expected Impact:
 * - Memory: -30-50% (0.34 KB → 0.20-0.24 KB per entry)
 * - Objects: -60% (2.5M → 1.0M for 500k entries)
 * - GC Overhead: -40-60%
 */

import type { Millis } from "./cache.ts";

/**
 * Flat array-based entry storage.
 * Instead of Entry<V> objects, we store fields in parallel arrays.
 */
export class FlatEntryStorage<V> {
  // Parallel arrays for entry fields (preallocated)
  private readonly values: (V | undefined)[];
  private readonly expires: (Millis | undefined)[];
  private readonly sliding: (Millis | undefined)[];
  private readonly sizes: Float64Array;
  private readonly lastAccess: Float64Array;
  
  // Free list for recycling indices
  private readonly freeSlots: number[] = [];
  private nextIndex = 0;
  private readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    
    // Preallocate all arrays
    this.values = new Array(capacity);
    this.expires = new Array(capacity);
    this.sliding = new Array(capacity);
    this.sizes = new Float64Array(capacity);
    this.lastAccess = new Float64Array(capacity);
  }

  /**
   * Allocate a new entry slot or reuse a freed one.
   * Returns the index where the entry is stored.
   */
  allocate(
    v: V,
    sz: number,
    t: Millis,
    exp?: Millis,
    sl?: Millis
  ): number {
    // Reuse freed slot if available, otherwise allocate new
    const index = this.freeSlots.length > 0
      ? this.freeSlots.pop()!
      : this.nextIndex++;

    if (index >= this.capacity) {
      throw new Error(`FlatEntryStorage capacity exceeded: ${this.capacity}`);
    }

    // Store fields in parallel arrays
    this.values[index] = v;
    this.expires[index] = exp;
    this.sliding[index] = sl;
    this.sizes[index] = sz;
    this.lastAccess[index] = t;

    return index;
  }

  /**
   * Free an entry slot for reuse.
   */
  free(index: number): void {
    // Clear references to help GC
    this.values[index] = undefined;
    this.expires[index] = undefined;
    this.sliding[index] = undefined;
    this.sizes[index] = 0;
    this.lastAccess[index] = 0;

    // Add to free list
    this.freeSlots.push(index);
  }

  /**
   * Get entry value by index.
   */
  getValue(index: number): V {
    return this.values[index]!;
  }

  /**
   * Update entry value.
   */
  setValue(index: number, v: V): void {
    this.values[index] = v;
  }

  /**
   * Get entry size.
   */
  getSize(index: number): number {
    return this.sizes[index] || 0;
  }

  /**
   * Update entry size.
   */
  setSize(index: number, sz: number): void {
    this.sizes[index] = sz;
  }

  /**
   * Get last access time.
   */
  getLastAccess(index: number): Millis {
    return this.lastAccess[index] || 0;
  }

  /**
   * Update last access time.
   */
  setLastAccess(index: number, t: Millis): void {
    this.lastAccess[index] = t;
  }

  /**
   * Get expiration time.
   */
  getExpires(index: number): Millis | undefined {
    return this.expires[index];
  }

  /**
   * Update expiration time.
   */
  setExpires(index: number, exp?: Millis): void {
    this.expires[index] = exp;
  }

  /**
   * Get sliding TTL.
   */
  getSliding(index: number): Millis | undefined {
    return this.sliding[index];
  }

  /**
   * Update sliding TTL.
   */
  setSliding(index: number, sl?: Millis): void {
    this.sliding[index] = sl;
  }

  /**
   * Check if entry is expired.
   */
  isExpired(index: number, currentTime: Millis): boolean {
    const exp = this.expires[index];
    if (exp !== undefined && currentTime >= exp) {
      return true;
    }

    const sl = this.sliding[index];
    const lastAcc = this.lastAccess[index];
    if (sl !== undefined && lastAcc !== undefined && currentTime - lastAcc >= sl) {
      return true;
    }

    return false;
  }

  /**
   * Clear all entries and reset storage.
   */
  clear(): void {
    this.freeSlots.length = 0;
    this.nextIndex = 0;
    
    // Clear arrays
    this.values.fill(undefined);
    this.expires.fill(undefined);
    this.sliding.fill(undefined);
    this.sizes.fill(0);
    this.lastAccess.fill(0);
  }

  /**
   * Get storage statistics (for monitoring).
   */
  getStats() {
    return {
      capacity: this.capacity,
      allocated: this.nextIndex - this.freeSlots.length,
      free: this.freeSlots.length,
      utilizationPercent: ((this.nextIndex - this.freeSlots.length) / this.capacity * 100),
    };
  }
}
