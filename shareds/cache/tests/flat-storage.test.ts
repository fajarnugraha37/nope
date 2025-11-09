/**
 * Unit tests for FlatEntryStorage
 * Tests flat array storage implementation
 */

import { describe, test, expect } from "bun:test";
import { FlatEntryStorage } from "../src/flat-storage";

describe("FlatEntryStorage", () => {
  describe("Constructor and Initialization", () => {
    test("creates storage with specified capacity", () => {
      const storage = new FlatEntryStorage<string>(100);
      const stats = storage.getStats();
      
      expect(stats.capacity).toBe(100);
      expect(stats.allocated).toBe(0);
      expect(stats.free).toBe(0);
      expect(stats.utilizationPercent).toBe(0);
    });

    test("creates storage with large capacity", () => {
      const storage = new FlatEntryStorage<number>(10_000);
      const stats = storage.getStats();
      
      expect(stats.capacity).toBe(10_000);
    });
  });

  describe("Allocate and Free", () => {
    test("allocates first entry at index 0", () => {
      const storage = new FlatEntryStorage<string>(10);
      const now = Date.now();
      
      const index = storage.allocate("value1", 10, now);
      
      expect(index).toBe(0);
      expect(storage.getValue(index)).toBe("value1");
      expect(storage.getSize(index)).toBe(10);
      expect(storage.getLastAccess(index)).toBe(now);
    });

    test("allocates multiple entries sequentially", () => {
      const storage = new FlatEntryStorage<number>(10);
      const now = Date.now();
      
      const idx0 = storage.allocate(100, 8, now);
      const idx1 = storage.allocate(200, 8, now);
      const idx2 = storage.allocate(300, 8, now);
      
      expect(idx0).toBe(0);
      expect(idx1).toBe(1);
      expect(idx2).toBe(2);
      
      expect(storage.getValue(idx0)).toBe(100);
      expect(storage.getValue(idx1)).toBe(200);
      expect(storage.getValue(idx2)).toBe(300);
    });

    test("allocates with expiration time", () => {
      const storage = new FlatEntryStorage<string>(10);
      const now = Date.now();
      const expires = now + 5000;
      
      const index = storage.allocate("value", 10, now, expires);
      
      expect(storage.getExpires(index)).toBe(expires);
    });

    test("allocates with sliding TTL", () => {
      const storage = new FlatEntryStorage<string>(10);
      const now = Date.now();
      const slidingTtl = 3000;
      
      const index = storage.allocate("value", 10, now, undefined, slidingTtl);
      
      expect(storage.getSliding(index)).toBe(slidingTtl);
    });

    test("frees entry and adds to free list", () => {
      const storage = new FlatEntryStorage<string>(10);
      const now = Date.now();
      
      const index = storage.allocate("value", 10, now);
      const statsBefore = storage.getStats();
      
      storage.free(index);
      const statsAfter = storage.getStats();
      
      expect(statsBefore.allocated).toBe(1);
      expect(statsBefore.free).toBe(0);
      expect(statsAfter.allocated).toBe(0);
      expect(statsAfter.free).toBe(1);
      
      // Check cleared
      expect(storage.getValue(index)).toBeUndefined();
      expect(storage.getSize(index)).toBe(0);
      expect(storage.getLastAccess(index)).toBe(0);
    });

    test("reuses freed slots on next allocation", () => {
      const storage = new FlatEntryStorage<string>(10);
      const now = Date.now();
      
      // Allocate 3 entries
      const idx0 = storage.allocate("val0", 10, now);
      const idx1 = storage.allocate("val1", 10, now);
      const idx2 = storage.allocate("val2", 10, now);
      
      expect(idx0).toBe(0);
      expect(idx1).toBe(1);
      expect(idx2).toBe(2);
      
      // Free middle entry
      storage.free(idx1);
      
      // Next allocation should reuse freed slot
      const idx3 = storage.allocate("val3", 10, now);
      expect(idx3).toBe(1); // Reused!
      expect(storage.getValue(idx3)).toBe("val3");
    });

    test("throws error when capacity exceeded", () => {
      const storage = new FlatEntryStorage<number>(2);
      const now = Date.now();
      
      storage.allocate(1, 8, now);
      storage.allocate(2, 8, now);
      
      expect(() => {
        storage.allocate(3, 8, now);
      }).toThrow("FlatEntryStorage capacity exceeded: 2");
    });
  });

  describe("Value Operations", () => {
    test("getValue retrieves stored value", () => {
      const storage = new FlatEntryStorage<{ id: number; name: string }>(10);
      const value = { id: 1, name: "Alice" };
      const index = storage.allocate(value, 50, Date.now());
      
      expect(storage.getValue(index)).toEqual(value);
    });

    test("setValue updates stored value", () => {
      const storage = new FlatEntryStorage<string>(10);
      const index = storage.allocate("initial", 10, Date.now());
      
      storage.setValue(index, "updated");
      
      expect(storage.getValue(index)).toBe("updated");
    });

    test("handles different value types", () => {
      const storage = new FlatEntryStorage<any>(10);
      const now = Date.now();
      
      const idx1 = storage.allocate(123, 8, now);
      const idx2 = storage.allocate("string", 10, now);
      const idx3 = storage.allocate({ key: "value" }, 20, now);
      const idx4 = storage.allocate([1, 2, 3], 15, now);
      
      expect(storage.getValue(idx1)).toBe(123);
      expect(storage.getValue(idx2)).toBe("string");
      expect(storage.getValue(idx3)).toEqual({ key: "value" });
      expect(storage.getValue(idx4)).toEqual([1, 2, 3]);
    });
  });

  describe("Size Operations", () => {
    test("getSize returns stored size", () => {
      const storage = new FlatEntryStorage<string>(10);
      const index = storage.allocate("value", 42, Date.now());
      
      expect(storage.getSize(index)).toBe(42);
    });

    test("setSize updates stored size", () => {
      const storage = new FlatEntryStorage<string>(10);
      const index = storage.allocate("value", 10, Date.now());
      
      storage.setSize(index, 99);
      
      expect(storage.getSize(index)).toBe(99);
    });

    test("getSize returns 0 for unallocated index", () => {
      const storage = new FlatEntryStorage<string>(10);
      
      expect(storage.getSize(5)).toBe(0);
    });
  });

  describe("Time Operations", () => {
    test("getLastAccess returns last access time", () => {
      const storage = new FlatEntryStorage<string>(10);
      const now = Date.now();
      const index = storage.allocate("value", 10, now);
      
      expect(storage.getLastAccess(index)).toBe(now);
    });

    test("setLastAccess updates last access time", () => {
      const storage = new FlatEntryStorage<string>(10);
      const index = storage.allocate("value", 10, 1000);
      
      storage.setLastAccess(index, 2000);
      
      expect(storage.getLastAccess(index)).toBe(2000);
    });

    test("getExpires returns expiration time", () => {
      const storage = new FlatEntryStorage<string>(10);
      const now = Date.now();
      const expires = now + 5000;
      const index = storage.allocate("value", 10, now, expires);
      
      expect(storage.getExpires(index)).toBe(expires);
    });

    test("getExpires returns undefined when no expiration", () => {
      const storage = new FlatEntryStorage<string>(10);
      const index = storage.allocate("value", 10, Date.now());
      
      expect(storage.getExpires(index)).toBeUndefined();
    });

    test("setExpires updates expiration time", () => {
      const storage = new FlatEntryStorage<string>(10);
      const index = storage.allocate("value", 10, Date.now());
      
      const newExpires = Date.now() + 10000;
      storage.setExpires(index, newExpires);
      
      expect(storage.getExpires(index)).toBe(newExpires);
    });

    test("getSliding returns sliding TTL", () => {
      const storage = new FlatEntryStorage<string>(10);
      const index = storage.allocate("value", 10, Date.now(), undefined, 3000);
      
      expect(storage.getSliding(index)).toBe(3000);
    });

    test("setSliding updates sliding TTL", () => {
      const storage = new FlatEntryStorage<string>(10);
      const index = storage.allocate("value", 10, Date.now());
      
      storage.setSliding(index, 5000);
      
      expect(storage.getSliding(index)).toBe(5000);
    });
  });

  describe("Expiration Check", () => {
    test("isExpired returns false for non-expired entry", () => {
      const storage = new FlatEntryStorage<string>(10);
      const now = Date.now();
      const expires = now + 5000;
      const index = storage.allocate("value", 10, now, expires);
      
      expect(storage.isExpired(index, now)).toBe(false);
      expect(storage.isExpired(index, now + 1000)).toBe(false);
      expect(storage.isExpired(index, now + 4999)).toBe(false);
    });

    test("isExpired returns true when absolute expiration reached", () => {
      const storage = new FlatEntryStorage<string>(10);
      const now = Date.now();
      const expires = now + 5000;
      const index = storage.allocate("value", 10, now, expires);
      
      expect(storage.isExpired(index, expires)).toBe(true);
      expect(storage.isExpired(index, expires + 1000)).toBe(true);
    });

    test("isExpired returns false when no expiration set", () => {
      const storage = new FlatEntryStorage<string>(10);
      const now = Date.now();
      const index = storage.allocate("value", 10, now);
      
      expect(storage.isExpired(index, now + 1000000)).toBe(false);
    });

    test("isExpired checks sliding TTL", () => {
      const storage = new FlatEntryStorage<string>(10);
      const now = 1000;
      const slidingTtl = 500;
      const index = storage.allocate("value", 10, now, undefined, slidingTtl);
      
      // Not expired within sliding window
      expect(storage.isExpired(index, now + 400)).toBe(false);
      
      // Expired after sliding TTL
      expect(storage.isExpired(index, now + 500)).toBe(true);
      expect(storage.isExpired(index, now + 600)).toBe(true);
    });

    test("isExpired with both absolute and sliding TTL", () => {
      const storage = new FlatEntryStorage<string>(10);
      const now = 1000;
      const expires = now + 1000;
      const slidingTtl = 500;
      const index = storage.allocate("value", 10, now, expires, slidingTtl);
      
      // Not expired
      expect(storage.isExpired(index, now + 400)).toBe(false);
      
      // Expired by sliding TTL
      expect(storage.isExpired(index, now + 500)).toBe(true);
      
      // Expired by absolute expiration
      expect(storage.isExpired(index, now + 1000)).toBe(true);
    });

    test("sliding TTL resets with setLastAccess", () => {
      const storage = new FlatEntryStorage<string>(10);
      const now = 1000;
      const slidingTtl = 500;
      const index = storage.allocate("value", 10, now, undefined, slidingTtl);
      
      // Update last access
      storage.setLastAccess(index, 1400);
      
      // Not expired because sliding window reset
      expect(storage.isExpired(index, 1500)).toBe(false);
      
      // Expired after new sliding window
      expect(storage.isExpired(index, 1900)).toBe(true);
    });
  });

  describe("Clear", () => {
    test("clear resets all state", () => {
      const storage = new FlatEntryStorage<string>(10);
      const now = Date.now();
      
      // Allocate some entries
      const idx0 = storage.allocate("val0", 10, now);
      const idx1 = storage.allocate("val1", 10, now);
      const idx2 = storage.allocate("val2", 10, now);
      
      // Free one
      storage.free(idx1);
      
      const statsBefore = storage.getStats();
      expect(statsBefore.allocated).toBe(2);
      expect(statsBefore.free).toBe(1);
      
      // Clear
      storage.clear();
      
      const statsAfter = storage.getStats();
      expect(statsAfter.allocated).toBe(0);
      expect(statsAfter.free).toBe(0);
      expect(statsAfter.utilizationPercent).toBe(0);
      
      // Verify arrays cleared
      expect(storage.getValue(idx0)).toBeUndefined();
      expect(storage.getSize(idx0)).toBe(0);
      expect(storage.getLastAccess(idx0)).toBe(0);
    });

    test("can allocate after clear", () => {
      const storage = new FlatEntryStorage<string>(10);
      const now = Date.now();
      
      storage.allocate("val0", 10, now);
      storage.allocate("val1", 10, now);
      storage.clear();
      
      const index = storage.allocate("new", 10, now);
      expect(index).toBe(0); // Starts from 0 again
      expect(storage.getValue(index)).toBe("new");
    });
  });

  describe("Statistics", () => {
    test("getStats tracks allocated entries", () => {
      const storage = new FlatEntryStorage<string>(100);
      const now = Date.now();
      
      expect(storage.getStats().allocated).toBe(0);
      
      storage.allocate("val1", 10, now);
      expect(storage.getStats().allocated).toBe(1);
      
      storage.allocate("val2", 10, now);
      storage.allocate("val3", 10, now);
      expect(storage.getStats().allocated).toBe(3);
    });

    test("getStats tracks free slots", () => {
      const storage = new FlatEntryStorage<string>(100);
      const now = Date.now();
      
      const idx0 = storage.allocate("val0", 10, now);
      const idx1 = storage.allocate("val1", 10, now);
      
      storage.free(idx0);
      
      const stats = storage.getStats();
      expect(stats.allocated).toBe(1);
      expect(stats.free).toBe(1);
    });

    test("getStats calculates utilization percent", () => {
      const storage = new FlatEntryStorage<string>(10);
      const now = Date.now();
      
      expect(storage.getStats().utilizationPercent).toBe(0);
      
      storage.allocate("val1", 10, now);
      expect(storage.getStats().utilizationPercent).toBe(10);
      
      storage.allocate("val2", 10, now);
      storage.allocate("val3", 10, now);
      expect(storage.getStats().utilizationPercent).toBe(30);
      
      // Fill to capacity
      for (let i = 3; i < 10; i++) {
        storage.allocate(`val${i}`, 10, now);
      }
      expect(storage.getStats().utilizationPercent).toBe(100);
    });

    test("getStats reflects free and reallocation", () => {
      const storage = new FlatEntryStorage<string>(10);
      const now = Date.now();
      
      const idx0 = storage.allocate("val0", 10, now);
      const idx1 = storage.allocate("val1", 10, now);
      const idx2 = storage.allocate("val2", 10, now);
      
      expect(storage.getStats().allocated).toBe(3);
      expect(storage.getStats().free).toBe(0);
      
      storage.free(idx1);
      expect(storage.getStats().allocated).toBe(2);
      expect(storage.getStats().free).toBe(1);
      
      // Reuse freed slot
      storage.allocate("val3", 10, now);
      expect(storage.getStats().allocated).toBe(3);
      expect(storage.getStats().free).toBe(0);
    });
  });

  describe("Edge Cases", () => {
    test("handles capacity of 1", () => {
      const storage = new FlatEntryStorage<number>(1);
      const index = storage.allocate(42, 8, Date.now());
      
      expect(index).toBe(0);
      expect(storage.getValue(index)).toBe(42);
      
      expect(() => {
        storage.allocate(99, 8, Date.now());
      }).toThrow();
    });

    test("handles multiple free/reuse cycles", () => {
      const storage = new FlatEntryStorage<number>(3);
      const now = Date.now();
      
      const idx0 = storage.allocate(1, 8, now);
      const idx1 = storage.allocate(2, 8, now);
      const idx2 = storage.allocate(3, 8, now);
      
      // Free all
      storage.free(idx0);
      storage.free(idx1);
      storage.free(idx2);
      
      expect(storage.getStats().allocated).toBe(0);
      expect(storage.getStats().free).toBe(3);
      
      // Reallocate (should reuse in LIFO order)
      const new0 = storage.allocate(10, 8, now);
      const new1 = storage.allocate(20, 8, now);
      const new2 = storage.allocate(30, 8, now);
      
      expect(storage.getStats().allocated).toBe(3);
      expect(storage.getStats().free).toBe(0);
    });

    test("handles undefined values correctly", () => {
      const storage = new FlatEntryStorage<string | undefined>(10);
      const index = storage.allocate(undefined, 0, Date.now());
      
      expect(storage.getValue(index)).toBeUndefined();
    });

    test("handles zero size", () => {
      const storage = new FlatEntryStorage<string>(10);
      const index = storage.allocate("value", 0, Date.now());
      
      expect(storage.getSize(index)).toBe(0);
    });

    test("handles very large timestamps", () => {
      const storage = new FlatEntryStorage<string>(10);
      const largeTime = Number.MAX_SAFE_INTEGER - 1000;
      const index = storage.allocate("value", 10, largeTime);
      
      expect(storage.getLastAccess(index)).toBe(largeTime);
    });
  });
});
