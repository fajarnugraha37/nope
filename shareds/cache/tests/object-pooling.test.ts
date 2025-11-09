/**
 * Unit tests for object pooling
 * Tests EntryPool and LRUNodePool implementations
 */

import { describe, test, expect } from "bun:test";
import { EntryPool, LRUNodePool, LRUNode } from "../src/object-pooling";
import type { Entry } from "../src/cache";

describe("EntryPool", () => {
  describe("Constructor", () => {
    test("creates pool with specified max size", () => {
      const pool = new EntryPool<number>(10);
      expect(pool).toBeDefined();
      expect(pool.getPoolSize()).toBe(0);
    });

    test("creates pool with large max size", () => {
      const pool = new EntryPool<number>(1000);
      expect(pool).toBeDefined();
    });
  });

  describe("Acquire and Release", () => {
    test("acquires entry with provided values", () => {
      const pool = new EntryPool<number>(10);
      const now = Date.now();
      
      const entry = pool.acquire(100, 8, now);
      
      expect(entry.v).toBe(100);
      expect(entry.sz).toBe(8);
      expect(entry.t).toBe(now);
      expect(entry.exp).toBeUndefined();
      expect(entry.sl).toBeUndefined();
    });

    test("acquires entry with expiration", () => {
      const pool = new EntryPool<number>(10);
      const now = Date.now();
      const expires = now + 5000;
      
      const entry = pool.acquire(100, 8, now, expires);
      
      expect(entry.v).toBe(100);
      expect(entry.exp).toBe(expires);
    });

    test("acquires entry with sliding TTL", () => {
      const pool = new EntryPool<number>(10);
      const now = Date.now();
      
      const entry = pool.acquire(100, 8, now, undefined, 3000);
      
      expect(entry.v).toBe(100);
      expect(entry.sl).toBe(3000);
    });

    test("acquires multiple entries", () => {
      const pool = new EntryPool<string>(10);
      const now = Date.now();
      
      const entry1 = pool.acquire("v1", 10, now);
      const entry2 = pool.acquire("v2", 20, now);
      const entry3 = pool.acquire("v3", 30, now);
      
      expect(entry1.v).toBe("v1");
      expect(entry2.v).toBe("v2");
      expect(entry3.v).toBe("v3");
    });

    test("releases entry back to pool", () => {
      const pool = new EntryPool<number>(10);
      const now = Date.now();
      
      const entry = pool.acquire(100, 8, now);
      
      expect(pool.getPoolSize()).toBe(0);
      pool.release(entry);
      expect(pool.getPoolSize()).toBe(1);
      
      // Entry should be cleared
      expect(entry.v).toBeUndefined();
      expect(entry.sz).toBe(0);
      expect(entry.t).toBe(0);
      expect(entry.exp).toBeUndefined();
      expect(entry.sl).toBeUndefined();
    });

    test("reuses released entries", () => {
      const pool = new EntryPool<number>(10);
      const now = Date.now();
      
      const entry1 = pool.acquire(1, 8, now);
      const entry1Ref = entry1;
      
      pool.release(entry1);
      
      const entry2 = pool.acquire(2, 8, now);
      
      // Should reuse same object
      expect(entry2).toBe(entry1Ref);
      expect(entry2.v).toBe(2);
    });

    test("respects max pool size on release", () => {
      const pool = new EntryPool<number>(2);
      const now = Date.now();
      
      const e1 = pool.acquire(1, 8, now);
      const e2 = pool.acquire(2, 8, now);
      const e3 = pool.acquire(3, 8, now);
      
      pool.release(e1);
      pool.release(e2);
      expect(pool.getPoolSize()).toBe(2);
      
      pool.release(e3); // Should not be stored (exceeds max)
      expect(pool.getPoolSize()).toBe(2); // Still 2
      
      // Acquire 3 new entries
      const n1 = pool.acquire(10, 8, now);
      const n2 = pool.acquire(20, 8, now);
      const n3 = pool.acquire(30, 8, now);
      
      // First two should be reused
      expect(n1).toBe(e2);
      expect(n2).toBe(e1);
      // Third should be new object
      expect(n3).not.toBe(e3);
    });

    test("handles LIFO (stack) order", () => {
      const pool = new EntryPool<number>(10);
      const now = Date.now();
      
      const e1 = pool.acquire(1, 8, now);
      const e2 = pool.acquire(2, 8, now);
      const e3 = pool.acquire(3, 8, now);
      
      pool.release(e1);
      pool.release(e2);
      pool.release(e3);
      
      // Should retrieve in reverse order (LIFO)
      const n1 = pool.acquire(10, 8, now);
      const n2 = pool.acquire(20, 8, now);
      const n3 = pool.acquire(30, 8, now);
      
      expect(n1).toBe(e3); // Last released
      expect(n2).toBe(e2);
      expect(n3).toBe(e1); // First released
    });
  });

  describe("Multiple Acquire/Release Cycles", () => {
    test("handles many acquire/release cycles", () => {
      const pool = new EntryPool<string>(5);
      const now = Date.now();
      const refs: Entry<string>[] = [];
      
      // First cycle
      for (let i = 0; i < 10; i++) {
        const entry = pool.acquire(`value${i}`, 10, now);
        refs.push(entry);
      }
      
      // Release all
      for (const entry of refs) {
        pool.release(entry);
      }
      
      expect(pool.getPoolSize()).toBe(5); // Max pool size
      
      // Second cycle - should reuse some
      const newRefs: Entry<string>[] = [];
      for (let i = 0; i < 10; i++) {
        const entry = pool.acquire(`new${i}`, 10, now);
        newRefs.push(entry);
      }
      
      // First 5 should be reused (pool size is 5)
      let reused = 0;
      for (const newRef of newRefs) {
        if (refs.includes(newRef)) {
          reused++;
        }
      }
      
      expect(reused).toBe(5);
    });
  });

  describe("Clear", () => {
    test("clears all pooled entries", () => {
      const pool = new EntryPool<number>(10);
      const now = Date.now();
      
      const e1 = pool.acquire(1, 8, now);
      const e2 = pool.acquire(2, 8, now);
      
      pool.release(e1);
      pool.release(e2);
      expect(pool.getPoolSize()).toBe(2);
      
      pool.clear();
      expect(pool.getPoolSize()).toBe(0);
      
      // After clear, should not reuse old entries
      const n1 = pool.acquire(10, 8, now);
      const n2 = pool.acquire(20, 8, now);
      
      expect(n1).not.toBe(e1);
      expect(n1).not.toBe(e2);
      expect(n2).not.toBe(e1);
      expect(n2).not.toBe(e2);
    });

    test("can continue using pool after clear", () => {
      const pool = new EntryPool<string>(10);
      const now = Date.now();
      
      pool.acquire("val1", 10, now);
      pool.clear();
      
      const entry = pool.acquire("val2", 10, now);
      expect(entry.v).toBe("val2");
    });
  });

  describe("Edge Cases", () => {
    test("handles pool size of 0", () => {
      const pool = new EntryPool<number>(0);
      const now = Date.now();
      
      const e1 = pool.acquire(1, 8, now);
      const e1Ref = e1;
      
      pool.release(e1);
      expect(pool.getPoolSize()).toBe(0); // Not stored
      
      const e2 = pool.acquire(2, 8, now);
      
      // Should not reuse (pool size 0)
      expect(e2).not.toBe(e1Ref);
    });

    test("handles complex value types", () => {
      const pool = new EntryPool<{ id: number; data: string[] }>(10);
      const now = Date.now();
      
      const entry = pool.acquire({ id: 1, data: ["a", "b"] }, 50, now);
      
      expect(entry.v).toEqual({ id: 1, data: ["a", "b"] });
      
      pool.release(entry);
      
      const reused = pool.acquire({ id: 2, data: ["c"] }, 30, now);
      expect(reused).toBe(entry);
      expect(reused.v).toEqual({ id: 2, data: ["c"] });
    });

    test("handles null and undefined values", () => {
      const pool = new EntryPool<any>(10);
      const now = Date.now();
      
      const e1 = pool.acquire(null, 0, now);
      const e2 = pool.acquire(undefined, 0, now);
      
      expect(e1.v).toBeNull();
      expect(e2.v).toBeUndefined();
    });

    test("handles zero size", () => {
      const pool = new EntryPool<string>(10);
      const now = Date.now();
      
      const entry = pool.acquire("value", 0, now);
      expect(entry.sz).toBe(0);
    });
  });
});

describe("LRUNodePool", () => {
  describe("Constructor", () => {
    test("creates node pool with specified max size", () => {
      const pool = new LRUNodePool<string, number>(10);
      expect(pool).toBeDefined();
      expect(pool.getPoolSize()).toBe(0);
    });

    test("creates node pool with large max size", () => {
      const pool = new LRUNodePool<string, number>(1000);
      expect(pool).toBeDefined();
    });
  });

  describe("Acquire and Release", () => {
    test("acquires node with provided key and entry", () => {
      const pool = new LRUNodePool<string, number>(10);
      const entry: Entry<number> = { v: 100, sz: 8, t: Date.now() };
      
      const node = pool.acquire("key1", entry);
      
      expect(node.key).toBe("key1");
      expect(node.entry).toBe(entry);
      expect(node.next).toBeNull();
      expect(node.prev).toBeNull();
    });

    test("acquires multiple nodes", () => {
      const pool = new LRUNodePool<string, number>(10);
      const now = Date.now();
      
      const node1 = pool.acquire("k1", { v: 1, sz: 8, t: now });
      const node2 = pool.acquire("k2", { v: 2, sz: 8, t: now });
      const node3 = pool.acquire("k3", { v: 3, sz: 8, t: now });
      
      expect(node1.key).toBe("k1");
      expect(node2.key).toBe("k2");
      expect(node3.key).toBe("k3");
    });

    test("releases node back to pool", () => {
      const pool = new LRUNodePool<string, number>(10);
      const entry: Entry<number> = { v: 100, sz: 8, t: Date.now() };
      
      const node = pool.acquire("key", entry);
      
      expect(pool.getPoolSize()).toBe(0);
      pool.release(node);
      expect(pool.getPoolSize()).toBe(1);
      
      // Node should be cleared
      expect(node.key).toBeUndefined();
      expect(node.entry).toBeUndefined();
      expect(node.next).toBeNull();
      expect(node.prev).toBeNull();
    });

    test("reuses released nodes", () => {
      const pool = new LRUNodePool<string, number>(10);
      const now = Date.now();
      
      const node1 = pool.acquire("k1", { v: 1, sz: 8, t: now });
      const node1Ref = node1;
      
      pool.release(node1);
      
      const node2 = pool.acquire("k2", { v: 2, sz: 8, t: now });
      
      // Should reuse same object
      expect(node2).toBe(node1Ref);
      expect(node2.key).toBe("k2");
    });

    test("respects max pool size on release", () => {
      const pool = new LRUNodePool<string, number>(2);
      const now = Date.now();
      
      const n1 = pool.acquire("k1", { v: 1, sz: 8, t: now });
      const n2 = pool.acquire("k2", { v: 2, sz: 8, t: now });
      const n3 = pool.acquire("k3", { v: 3, sz: 8, t: now });
      
      pool.release(n1);
      pool.release(n2);
      expect(pool.getPoolSize()).toBe(2);
      
      pool.release(n3); // Should not be stored (exceeds max)
      expect(pool.getPoolSize()).toBe(2); // Still 2
      
      // Acquire 3 new nodes
      const a1 = pool.acquire("n1", { v: 10, sz: 8, t: now });
      const a2 = pool.acquire("n2", { v: 20, sz: 8, t: now });
      const a3 = pool.acquire("n3", { v: 30, sz: 8, t: now });
      
      // First two should be reused
      expect(a1).toBe(n2);
      expect(a2).toBe(n1);
      // Third should be new object
      expect(a3).not.toBe(n3);
    });

    test("handles LIFO (stack) order", () => {
      const pool = new LRUNodePool<string, number>(10);
      const now = Date.now();
      
      const n1 = pool.acquire("k1", { v: 1, sz: 8, t: now });
      const n2 = pool.acquire("k2", { v: 2, sz: 8, t: now });
      const n3 = pool.acquire("k3", { v: 3, sz: 8, t: now });
      
      pool.release(n1);
      pool.release(n2);
      pool.release(n3);
      
      // Should retrieve in reverse order (LIFO)
      const a1 = pool.acquire("a1", { v: 10, sz: 8, t: now });
      const a2 = pool.acquire("a2", { v: 20, sz: 8, t: now });
      const a3 = pool.acquire("a3", { v: 30, sz: 8, t: now });
      
      expect(a1).toBe(n3); // Last released
      expect(a2).toBe(n2);
      expect(a3).toBe(n1); // First released
    });

    test("clears linked list pointers on release", () => {
      const pool = new LRUNodePool<string, number>(10);
      const now = Date.now();
      
      const n1 = pool.acquire("k1", { v: 1, sz: 8, t: now });
      const n2 = pool.acquire("k2", { v: 2, sz: 8, t: now });
      
      // Simulate linked list
      n1.next = n2;
      n2.prev = n1;
      
      pool.release(n1);
      pool.release(n2);
      
      expect(n1.next).toBeNull();
      expect(n1.prev).toBeNull();
      expect(n2.next).toBeNull();
      expect(n2.prev).toBeNull();
    });
  });

  describe("Multiple Acquire/Release Cycles", () => {
    test("handles many acquire/release cycles", () => {
      const pool = new LRUNodePool<number, string>(5);
      const now = Date.now();
      const refs: LRUNode<number, string>[] = [];
      
      // First cycle
      for (let i = 0; i < 10; i++) {
        const node = pool.acquire(i, { v: `value${i}`, sz: 10, t: now });
        refs.push(node);
      }
      
      // Release all
      for (const node of refs) {
        pool.release(node);
      }
      
      expect(pool.getPoolSize()).toBe(5); // Max pool size
      
      // Second cycle - should reuse some
      const newRefs: LRUNode<number, string>[] = [];
      for (let i = 0; i < 10; i++) {
        const node = pool.acquire(i + 100, { v: `new${i}`, sz: 10, t: now });
        newRefs.push(node);
      }
      
      // First 5 should be reused (pool size is 5)
      let reused = 0;
      for (const newRef of newRefs) {
        if (refs.includes(newRef)) {
          reused++;
        }
      }
      
      expect(reused).toBe(5);
    });
  });

  describe("Clear", () => {
    test("clears all pooled nodes", () => {
      const pool = new LRUNodePool<string, number>(10);
      const now = Date.now();
      
      const n1 = pool.acquire("k1", { v: 1, sz: 8, t: now });
      const n2 = pool.acquire("k2", { v: 2, sz: 8, t: now });
      
      pool.release(n1);
      pool.release(n2);
      expect(pool.getPoolSize()).toBe(2);
      
      pool.clear();
      expect(pool.getPoolSize()).toBe(0);
      
      // After clear, should not reuse old nodes
      const a1 = pool.acquire("a1", { v: 10, sz: 8, t: now });
      const a2 = pool.acquire("a2", { v: 20, sz: 8, t: now });
      
      expect(a1).not.toBe(n1);
      expect(a1).not.toBe(n2);
      expect(a2).not.toBe(n1);
      expect(a2).not.toBe(n2);
    });

    test("can continue using pool after clear", () => {
      const pool = new LRUNodePool<string, number>(10);
      const now = Date.now();
      
      pool.acquire("k1", { v: 1, sz: 8, t: now });
      pool.clear();
      
      const node = pool.acquire("k2", { v: 2, sz: 8, t: now });
      expect(node.key).toBe("k2");
    });
  });

  describe("Edge Cases", () => {
    test("handles pool size of 0", () => {
      const pool = new LRUNodePool<string, number>(0);
      const now = Date.now();
      
      const n1 = pool.acquire("k1", { v: 1, sz: 8, t: now });
      const n1Ref = n1;
      
      pool.release(n1);
      expect(pool.getPoolSize()).toBe(0); // Not stored
      
      const n2 = pool.acquire("k2", { v: 2, sz: 8, t: now });
      
      // Should not reuse (pool size 0)
      expect(n2).not.toBe(n1Ref);
    });

    test("handles complex key types", () => {
      const pool = new LRUNodePool<{ id: number }, string>(10);
      const now = Date.now();
      
      const key1 = { id: 1 };
      const node = pool.acquire(key1, { v: "value", sz: 10, t: now });
      
      expect(node.key).toBe(key1);
    });

    test("handles null and undefined keys", () => {
      const pool = new LRUNodePool<any, string>(10);
      const now = Date.now();
      
      const n1 = pool.acquire(null, { v: "val1", sz: 10, t: now });
      const n2 = pool.acquire(undefined, { v: "val2", sz: 10, t: now });
      
      expect(n1.key).toBeNull();
      expect(n2.key).toBeUndefined();
    });
  });

  describe("Integration with EntryPool", () => {
    test("EntryPool and LRUNodePool work together", () => {
      const entryPool = new EntryPool<number>(5);
      const nodePool = new LRUNodePool<string, number>(5);
      const now = Date.now();
      
      // Acquire entry from entry pool
      const entry = entryPool.acquire(100, 8, now);
      
      // Acquire node from node pool with that entry
      const node = nodePool.acquire("key", entry);
      
      expect(node.key).toBe("key");
      expect(node.entry).toBe(entry);
      expect(entry.v).toBe(100);
      
      // Release both
      nodePool.release(node);
      entryPool.release(entry);
      
      // Reuse both
      const newEntry = entryPool.acquire(200, 8, now);
      const newNode = nodePool.acquire("newKey", newEntry);
      
      expect(newEntry).toBe(entry); // Reused
      expect(newNode).toBe(node); // Reused
      expect(newEntry.v).toBe(200);
      expect(newNode.key).toBe("newKey");
    });
  });
});

describe("PoolingStats", () => {
  const { PoolingStats } = require("../src/object-pooling");
  
  test("tracks acquire from pool", () => {
    const stats = new PoolingStats();
    
    stats.recordAcquire(true); // From pool
    
    const result = stats.getStats();
    expect(result.acquired).toBe(1);
    expect(result.reused).toBe(1);
    expect(result.created).toBe(0);
  });

  test("tracks acquire by creating new", () => {
    const stats = new PoolingStats();
    
    stats.recordAcquire(false); // New creation
    
    const result = stats.getStats();
    expect(result.acquired).toBe(1);
    expect(result.reused).toBe(0);
    expect(result.created).toBe(1);
  });

  test("tracks release", () => {
    const stats = new PoolingStats();
    
    stats.recordRelease();
    stats.recordRelease();
    
    const result = stats.getStats();
    expect(result.released).toBe(2);
  });

  test("calculates reuse rate", () => {
    const stats = new PoolingStats();
    
    stats.recordAcquire(false); // Created
    stats.recordAcquire(true);  // Reused
    stats.recordAcquire(true);  // Reused
    stats.recordAcquire(false); // Created
    
    const result = stats.getStats();
    expect(result.acquired).toBe(4);
    expect(result.reused).toBe(2);
    expect(result.created).toBe(2);
    expect(result.reuseRate).toBe(0.5); // 2/4 = 50%
  });

  test("getReuseRate returns 0 when no acquires", () => {
    const stats = new PoolingStats();
    
    expect(stats.getReuseRate()).toBe(0);
  });

  test("reset clears all counters", () => {
    const stats = new PoolingStats();
    
    stats.recordAcquire(true);
    stats.recordAcquire(false);
    stats.recordRelease();
    
    const beforeReset = stats.getStats();
    expect(beforeReset.acquired).toBe(2);
    expect(beforeReset.released).toBe(1);
    
    stats.reset();
    
    const afterReset = stats.getStats();
    expect(afterReset.acquired).toBe(0);
    expect(afterReset.reused).toBe(0);
    expect(afterReset.created).toBe(0);
    expect(afterReset.released).toBe(0);
    expect(afterReset.reuseRate).toBe(0);
  });

  test("tracks complex usage pattern", () => {
    const stats = new PoolingStats();
    
    // Create 5 objects
    for (let i = 0; i < 5; i++) {
      stats.recordAcquire(false);
    }
    
    // Release all
    for (let i = 0; i < 5; i++) {
      stats.recordRelease();
    }
    
    // Reuse 3, create 2 new
    for (let i = 0; i < 3; i++) {
      stats.recordAcquire(true);
    }
    for (let i = 0; i < 2; i++) {
      stats.recordAcquire(false);
    }
    
    const result = stats.getStats();
    expect(result.acquired).toBe(10); // 5 + 5
    expect(result.created).toBe(7);   // 5 + 2
    expect(result.reused).toBe(3);
    expect(result.released).toBe(5);
    expect(result.reuseRate).toBe(0.3); // 3/10
  });
});
