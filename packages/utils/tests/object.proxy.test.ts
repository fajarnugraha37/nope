import { describe, expect, test } from "bun:test";

import {
  observeProxy,
  readonlyProxy,
  defaultsProxy,
  validateProxy,
  lazyProxy,
  virtualRecord,
  chainProxy,
  trackPaths,
} from "../src/object/proxy";

describe("object proxy helpers", () => {
  test("observeProxy hooks fire for nested operations", () => {
    const gets: string[] = [];
    const sets: string[] = [];
    const dels: string[] = [];
    const target = { nested: { value: 1 } };
    const proxy = observeProxy(target, {
      onGet(path) {
        gets.push(path.join("."));
      },
      onSet(path, value, oldValue) {
        sets.push(`${path.join(".")}:${oldValue}->${value}`);
      },
      onDelete(path, existed) {
        dels.push(`${path.join(".")}:${existed}`);
      },
    }, { deep: true });

    void proxy.nested.value;
    proxy.nested.value = 2;
    delete proxy.nested.value;

    expect(gets).toContain("nested");
    expect(gets).toContain("nested.value");
    expect(sets).toEqual(["nested.value:1->2"]);
    expect(dels).toEqual(["nested.value:true"]);
  });

  test("readonlyProxy throws on mutation attempts", () => {
    const original = { nested: { value: 1 } };
    const ro = readonlyProxy(original);
    expect(() => ((ro as any).newProp = 1)).toThrow("readonly");
    expect(() => delete (ro as any).nested).toThrow("readonly");
    expect(ro.nested.value).toBe(1);
    expect(() => ((ro.nested as any).value = 2)).toThrow("readonly");
  });

  test("defaultsProxy exposes missing keys and descriptors", () => {
    const obj = { a: 1 };
    const defaults = { b: 2 };
    const proxy = defaultsProxy(obj, defaults);
    expect(proxy.a).toBe(1);
    expect(proxy.b).toBe(2);
    expect("b" in proxy).toBe(true);
    expect(Object.keys(proxy)).toContain("b");
    const desc = Object.getOwnPropertyDescriptor(proxy, "b");
    expect(desc?.value).toBe(2);
  });

  test("validateProxy enforces rules on nested assignments", () => {
    const target = { nested: { value: 1 } };
    const proxy = validateProxy(target, (path, v) => {
      if (path.join(".") === "nested.value" && typeof v !== "number") {
        return "must be number";
      }
      return true;
    });

    proxy.nested.value = 5;
    expect(proxy.nested.value).toBe(5);
    expect(() => (proxy.nested.value = "nope" as any)).toThrow(
      "invalid value: must be number"
    );
  });

  test("lazyProxy resolves properties lazily with optional memo", () => {
    let calls = 0;
    const lazy = lazyProxy(
      {},
      {
        value: () => {
          calls++;
          return 42;
        },
      }
    );
    expect((lazy as any).value).toBe(42);
    expect((lazy as any).value).toBe(42);
    expect(calls).toBe(1);

    calls = 0;
    const noMemo = lazyProxy(
      {},
      { value: () => (++calls, calls) },
      false
    );
    expect((noMemo as any).value).toBe(1);
    expect((noMemo as any).value).toBe(2);
  });

  test("virtualRecord proxies callbacks and descriptors", () => {
    const store = new Map<PropertyKey, any>([
      ["a", 1],
      ["b", 2],
    ]);
    const record = virtualRecord(
      (key) => store.get(key),
      (key, value) => {
        store.set(key, value);
        return true;
      },
      () => Array.from(store.keys())
    );

    expect(record.a).toBe(1);
    record.c = 3;
    expect(store.get("c")).toBe(3);
    expect("b" in record).toBe(true);
    expect(Object.keys(record)).toContain("a");
    const desc = Object.getOwnPropertyDescriptor(record, "a");
    expect(desc?.value).toBe(1);

    const readonly = virtualRecord((key) =>
      key === "x" ? 7 : undefined
    );
    expect(readonly.x).toBe(7);
    expect(() => (readonly as any).x = 8).toThrow("readonly virtual");
  });

  // TODO: fix this unit test is failed
  test("chainProxy reads from later sources but writes to head", () => {
    const base: { a: number; b: number } = { a: 1 } as any;
    const fallback: { a: number; b: number } = { b: 2 } as any;
    const proxy = chainProxy(base, fallback);
    expect(proxy.a).toBe(1);
    expect(proxy.b).toBe(2);
    proxy.b = 5;
    expect(base.b).toBe(5);
    proxy.a = 25;
    expect(base.a).toBe(25);
  });

  test("trackPaths logs get, set, and delete operations", async () => {
    const events: Array<{ op: string; path: (string | number | symbol)[] }> = [];
    const source = { nested: { value: 1 }, other: 2 };
    const proxy = trackPaths(source, (rec) => events.push(rec));
    const nested = proxy.nested;
    void nested.value;
    proxy.other = 3;
    delete proxy.nested;
    await new Promise((resolve) => setTimeout(resolve, 0));

    const ops = events.map((e) => `${e.op}:${e.path.join(".")}`);
    expect(ops).toContain("get:nested");
    expect(ops).toContain("get:nested.value");
    expect(ops).toContain("set:other");
    expect(ops).toContain("del:nested");
  });
});
