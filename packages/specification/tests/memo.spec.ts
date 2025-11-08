import { describe, expect, it } from "bun:test";
import { SpecMemoizer } from "../src/core/memo";

describe("SpecMemoizer", () => {
  it("returns undefined when cache is empty", () => {
    const memoizer = new SpecMemoizer<number>();
    expect(memoizer.get(42)).toBeUndefined();
  });

  it("caches and retrieves verdict for same value", () => {
    const memoizer = new SpecMemoizer<number>();
    memoizer.set(42, true);
    expect(memoizer.get(42)).toBe(true);
  });

  it("caches false verdict", () => {
    const memoizer = new SpecMemoizer<number>();
    memoizer.set(100, false);
    expect(memoizer.get(100)).toBe(false);
  });

  it("returns undefined for different value", () => {
    const memoizer = new SpecMemoizer<number>();
    memoizer.set(42, true);
    expect(memoizer.get(43)).toBeUndefined();
  });

  it("updates cache with new value", () => {
    const memoizer = new SpecMemoizer<string>();
    memoizer.set("first", true);
    expect(memoizer.get("first")).toBe(true);
    
    memoizer.set("second", false);
    expect(memoizer.get("second")).toBe(false);
    expect(memoizer.get("first")).toBeUndefined(); // Cache only keeps one entry
  });

  it("works with object values using default hasher", () => {
    const memoizer = new SpecMemoizer<{ name: string; age: number }>();
    const obj1 = { name: "Alice", age: 30 };
    const obj2 = { age: 30, name: "Alice" }; // Same content, different key order
    
    memoizer.set(obj1, true);
    expect(memoizer.get(obj2)).toBe(true); // Should match due to stable hashing
  });

  it("uses custom hasher", () => {
    const customHasher = (value: string) => value.toLowerCase();
    const memoizer = new SpecMemoizer<string>(customHasher);
    
    memoizer.set("Hello", true);
    expect(memoizer.get("HELLO")).toBe(true); // Case-insensitive due to custom hasher
    expect(memoizer.get("hello")).toBe(true);
  });

  it("distinguishes between different objects", () => {
    const memoizer = new SpecMemoizer<{ id: number }>();
    memoizer.set({ id: 1 }, true);
    expect(memoizer.get({ id: 2 })).toBeUndefined();
  });

  it("handles array values", () => {
    const memoizer = new SpecMemoizer<number[]>();
    memoizer.set([1, 2, 3], true);
    expect(memoizer.get([1, 2, 3])).toBe(true);
    expect(memoizer.get([1, 2, 4])).toBeUndefined();
  });

  it("overwrites previous cache entry", () => {
    const memoizer = new SpecMemoizer<number>();
    memoizer.set(10, true);
    expect(memoizer.get(10)).toBe(true);
    
    memoizer.set(10, false); // Overwrite with same key
    expect(memoizer.get(10)).toBe(false);
  });
});
