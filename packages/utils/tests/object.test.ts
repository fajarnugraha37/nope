import { describe, expect, test } from "bun:test";

import {
  groupBy,
  indexBy,
  countBy,
} from "../src/object/aggregate";
import {
  shallowClone,
  deepClone,
  structuredClone,
  merge,
  freezeDeep,
  cloneShallow,
  isShallowEqual,
  stableStringify,
} from "../src/object/clone";
import {
  flattenObject,
  flattenObjectStream,
  unflattenObject,
  unflattenObjectStream,
} from "../src/object/flatten";
import {
  mapGetOrSet,
  mapEnsure,
  mapUpsert,
  mapMapValues,
  mapFilter,
  mergeMaps,
  objectToMap,
  mapToObject,
  mapGroupBy,
  mapIndexBy,
  MultiMap,
} from "../src/object/map";
import {
  invert,
  compact,
  mergeDeep,
  getIn,
  setIn,
  updateIn,
} from "../src/object";
import {
  getNestedValue,
  setNestedValue,
  hasNestedProperty,
  deleteNestedProperty,
} from "../src/object/nested";
import { toPairs, fromPairs } from "../src/object/pairs";
import {
  toPath as toPathExtra,
  getIn as getInExtra,
  setIn as setInExtra,
  delIn,
  deepPick,
  deepOmit,
  deepDiff,
  applyDiff,
  makeRecord,
  assertExactKeys,
  isTypedRecord,
} from "../src/object/extras";
import { isNum } from "../src/is/primitives";
import {
  observeProxy,
  readonlyProxy,
  defaultsProxy,
  validateProxy,
  lazyProxy,
  virtualRecord,
  chainProxy,
  trackPaths,
  makeRevocable,
} from "../src/object/proxy";
import {
  hasOwn,
  keys,
  entries,
  values,
  pick,
  omit,
  mapValues,
  mapKeys,
  filterObject,
  reduceObject,
} from "../src/object/record";

describe("object aggregate helpers", () => {
  test("groupBy groups items by key", () => {
    const data = ["a", "ab", "bc", "c"];
    const grouped = groupBy(data, (s) => s.length);
    expect(grouped).toEqual({
      1: ["a", "c"],
      2: ["ab", "bc"],
    });
  });

  test("indexBy indexes items by key", () => {
    const data = [{ id: 1 }, { id: 2 }];
    const indexed = indexBy(data, (x) => x.id);
    expect(indexed).toEqual({ 1: { id: 1 }, 2: { id: 2 } });
  });

  test("countBy counts by key", () => {
    const data = ["a", "b", "a", "c"];
    const counts = countBy(data, (c) => c);
    expect(counts).toEqual({ a: 2, b: 1, c: 1 });
  });
});

describe("object clone helpers", () => {
  test("shallowClone copies top-level", () => {
    const original = { nested: { value: 1 } };
    const cloned = shallowClone(original);
    expect(cloned).not.toBe(original);
    expect(cloned.nested).toBe(original.nested);
  });

  test("deepClone copies deep structures", () => {
    const original = { nested: { value: 1 }, arr: [1, { x: 2 }] };
    const cloned = deepClone(original);
    expect(cloned).not.toBe(original);
    expect(cloned.nested).not.toBe(original.nested);
    expect(cloned.arr[1]).not.toBe(original.arr[1]);
    expect(cloned).toEqual(original);
  });

  test("structuredClone uses global when available", () => {
    const original = { ok: true };
    const cloned = structuredClone(original);
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
  });

  test("merge merges nested objects", () => {
    const base = { a: 1, nested: { x: 1, y: 2 } };
    const merged = merge(base, { b: 2, nested: { y: 3 } });
    expect(merged).toEqual({ a: 1, b: 2, nested: { x: 1, y: 3 } });
    expect(base).toEqual({ a: 1, nested: { x: 1, y: 2 } });
  });

  test("freezeDeep freezes nested structures", () => {
    const obj = { nested: { value: 1 } };
    freezeDeep(obj);
    expect(Object.isFrozen(obj)).toBe(true);
    expect(Object.isFrozen(obj.nested)).toBe(true);
  });

  test("cloneShallow clones objects and arrays", () => {
    const arr = [1, 2, 3];
    const arrClone = cloneShallow(arr);
    expect(arrClone).toEqual(arr);
    expect(arrClone).not.toBe(arr);

    const obj = { a: 1 };
    const objClone = cloneShallow(obj);
    expect(objClone).toEqual(obj);
    expect(objClone).not.toBe(obj);
  });

  test("isShallowEqual compares shallow properties", () => {
    expect(isShallowEqual({ a: 1 }, { a: 1 })).toBe(true);
    expect(isShallowEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  test("stableStringify sorts keys deterministically", () => {
    const obj = { b: 1, a: { z: 2, y: 3 } };
    expect(stableStringify(obj)).toBe('{"a":{"y":3,"z":2},"b":1}');
  });
});

describe("object flatten helpers", () => {
  test("flattenObject flattens nested objects", () => {
    const flat = flattenObject({ foo: { bar: 1 } });
    expect(flat).toEqual({ "foo.bar": 1 });
  });

  test("flattenObjectStream iterates entries", async () => {
    const entriesFromStream: Array<{ key: string; value: any }> = [];
    for await (const item of flattenObjectStream({ foo: { bar: 1 } })) {
      entriesFromStream.push(item);
    }
    expect(entriesFromStream).toEqual([{ key: "foo.bar", value: 1 }]);
  });

  test("unflattenObject rebuilds nested structure", () => {
    const nested = unflattenObject({ "foo.bar": 1 });
    expect(nested).toEqual({ foo: { bar: 1 } });
  });

  test("unflattenObjectStream yields reconstruction steps", () => {
    const stream = unflattenObjectStream({ "foo.bar": 1, "foo.baz": 2 });
    const steps = Array.from(stream);
    expect(steps).toEqual([
      { path: "foo.bar", value: 1, isComplete: false },
      { path: "foo.baz", value: 2, isComplete: true },
    ]);
  });
});

describe("object map helpers", () => {
  test("mapGetOrSet and mapEnsure behave identically", () => {
    const m = new Map<string, number>();
    const first = mapGetOrSet(m, "foo", () => 1);
    const second = mapEnsure(m, "foo", () => 2);
    expect(first).toBe(1);
    expect(second).toBe(1);
  });

  test("mapUpsert overwrites with callback result", () => {
    const m = new Map<string, number>([["count", 1]]);
    const result = mapUpsert(m, "count", (prev) => (prev ?? 0) + 9);
    expect(result).toBe(10);
    expect(m.get("count")).toBe(10);
  });

  test("mapMapValues transforms values", () => {
    const m = new Map([
      ["a", 1],
      ["b", 2],
    ]);
    const doubled = mapMapValues(m, (v) => v * 2);
    expect(doubled.get("a")).toBe(2);
    expect(doubled.get("b")).toBe(4);
  });

  test("mapFilter filters entries", () => {
    const m = new Map([
      ["a", 1],
      ["b", 2],
    ]);
    const evens = mapFilter(m, (v) => v % 2 === 0);
    expect(Array.from(evens.entries())).toEqual([["b", 2]]);
  });

  test("mergeMaps combines maps with resolver", () => {
    const target = new Map([
      ["a", 1],
      ["b", 2],
    ]);
    const src = new Map([
      ["b", 3],
      ["c", 4],
    ]);
    const merged = mergeMaps(target, src, (a, b) => (a ?? 0) + b);
    expect(Array.from(merged.entries())).toEqual([
      ["a", 1],
      ["b", 5],
      ["c", 4],
    ]);
  });

  test("objectToMap and mapToObject round-trip", () => {
    const obj = { a: 1, b: 2 };
    const map = objectToMap(obj);
    expect(mapToObject(map)).toEqual(obj);
  });

  test("mapGroupBy groups into map", () => {
    const grouped = mapGroupBy(["a", "bb"], (x) => x.length);
    expect(grouped.get(1)).toEqual(["a"]);
    expect(grouped.get(2)).toEqual(["bb"]);
  });

  test("mapIndexBy indexes items", () => {
    const map = mapIndexBy(["a", "b"], (x) => x);
    expect(map.get("a")).toBe("a");
  });

  test("MultiMap stores multiple values per key", () => {
    const mm = new MultiMap<string, number>();
    mm.add("a", 1);
    mm.add("a", 2);
    expect(mm.get("a")).toEqual([1, 2]);
    expect(mm.delete("a", 1)).toBe(true);
    expect(mm.get("a")).toEqual([2]);
    mm.clear();
    expect(Array.from(mm.keys())).toEqual([]);
  });
});

describe("object misc helpers", () => {
  test("invert swaps keys and values", () => {
    expect(invert({ a: "x", b: "y" })).toEqual({ x: "a", y: "b" });
  });

  test("compact removes nullish values", () => {
    expect(compact({ a: 1, b: null, c: undefined })).toEqual({ a: 1 });
  });

  test("mergeDeep merges nested plain objects", () => {
    const merged = mergeDeep({ nested: { a: 1 } }, { nested: { b: 2 } });
    expect(merged).toEqual({ nested: { a: 1, b: 2 } });
  });

  test("getIn retrieves nested values", () => {
    const obj = { a: { b: 2 } };
    expect(getIn(obj, ["a", "b"])).toBe(2);
    expect(getIn(obj, ["a", "c"], "fallback")).toBe("fallback");
  });

  test("setIn creates nested path immutably", () => {
    const obj = { a: { b: 2 } };
    const updated = setIn(obj, ["a", "c"], 3);
    expect(updated).toEqual({ a: { b: 2, c: 3 } });
    expect(obj).toEqual({ a: { b: 2 } });
  });

  test("updateIn updates using callback", () => {
    const obj = { a: { b: 2 } };
    const updated = updateIn(obj, ["a", "b"], (x) => (x ?? 0) + 1);
    expect(updated).toEqual({ a: { b: 3 } });
  });
});

describe("object nested helpers", () => {
  test("getNestedValue returns nested data", () => {
    expect(getNestedValue({ a: { b: 2 } }, "a.b")).toBe(2);
  });

  test("setNestedValue sets nested values", () => {
    const obj: Record<string, any> = {};
    setNestedValue(obj, "a.b", 3);
    expect(obj).toEqual({ a: { b: 3 } });
  });

  test("hasNestedProperty checks nested existence", () => {
    const obj = { a: { b: 2 } };
    expect(hasNestedProperty(obj, "a.b")).toBe(true);
    expect(hasNestedProperty(obj, "a.c")).toBe(false);
  });

  test("deleteNestedProperty removes nested path", () => {
    const obj: Record<string, any> = { a: { b: 2 } };
    expect(deleteNestedProperty(obj, "a.b")).toBe(true);
    expect(obj).toEqual({ a: {} });
  });
});

describe("object pairs helpers", () => {
  test("toPairs converts object to tuples", () => {
    expect(toPairs({ a: 1 })).toEqual([["a", 1]]);
  });

  test("fromPairs builds object from tuples", () => {
    expect(fromPairs([["a", 1]])).toEqual({ a: 1 });
  });
});

describe("object extras helpers", () => {
  test("toPath parses string paths", () => {
    expect(toPathExtra("a.b[0].c")).toEqual(["a", "b", 0, "c"]);
  });

  test("getIn/setIn/delIn from extras operate on paths", () => {
    const obj = { a: { b: [0, { c: 1 }] } };
    expect(getInExtra(obj, ["a", "b", 1, "c"])).toBe(1);
    const updated = setInExtra(obj, ["a", "b", 1, "c"], 2);
    expect(getInExtra(updated, ["a", "b", 1, "c"])).toBe(2);
    const deleted = delIn(updated, ["a", "b", 0]);
    expect(getInExtra(deleted, ["a", "b", 0])).toBeUndefined();
  });

  test("deepPick and deepOmit respect paths", () => {
    const obj = { a: { b: 1, c: 2 }, d: 3 };
    expect(deepPick(obj, ["a.b"])).toEqual({ a: { b: 1 } });
    expect(deepOmit(obj, ["a.c"])).toEqual({ a: { b: 1 }, d: 3 });
  });

  test("deepDiff and applyDiff compute differences", () => {
    const a = { user: { name: "alice", age: 20 }, active: true };
    const b = { user: { name: "alice", age: 21 }, active: false };
    const diff = deepDiff(a, b);
    expect(diff.set).toEqual({
      "user.age": 21,
      active: false,
    });
    expect(diff.unset).toEqual([]);
    expect(applyDiff(a, diff)).toEqual(b);
  });

  test("makeRecord builds typed record", () => {
    const rec = makeRecord(["a", "b"] as const, (k, i) => `${k}:${i}`);
    expect(rec).toEqual({ a: "a:0", b: "b:1" });
  });

  test("assertExactKeys validates keys", () => {
    expect(() => assertExactKeys({ a: 1, b: 2 }, ["a", "b"])).not.toThrow();
    expect(() => assertExactKeys({ a: 1 }, ["a", "b"])).toThrow("missing key: b");
  });

  test("isTypedRecord validates records", () => {
    expect(isTypedRecord({ a: 1, b: 2 }, ["a", "b"], isNum)).toBe(true);
    expect(isTypedRecord({ a: 1 }, ["a", "b"], isNum)).toBe(false);
  });
});

describe("object proxy helpers", () => {
  test("observeProxy tracks get/set/delete", () => {
    const paths: Array<{ op: string; path: (string | number | symbol)[] }> = [];
    const target = { value: 1 };
    const proxy = observeProxy(
      target,
      {
        onGet: (path) => paths.push({ op: "get", path }),
        onSet: (path) => paths.push({ op: "set", path }),
        onDelete: (path) => paths.push({ op: "del", path }),
      },
      { deep: true }
    );
    // eslint-disable-next-line no-unused-expressions
    proxy.value;
    proxy.value = 2;
    delete proxy.value;
    expect(paths).toEqual([
      { op: "get", path: ["value"] },
      { op: "set", path: ["value"] },
      { op: "del", path: ["value"] },
    ]);
  });

  test("readonlyProxy prevents mutation", () => {
    const proxy = readonlyProxy({ value: 1 });
    expect(() => {
      (proxy as any).value = 2;
    }).toThrowError("readonly");
  });

  test("defaultsProxy fills missing values", () => {
    const proxy = defaultsProxy({ present: 1 }, { missing: 2 });
    expect(proxy.present).toBe(1);
    expect(proxy.missing).toBe(2);
    expect("missing" in proxy).toBe(true);
  });

  test("validateProxy enforces predicate", () => {
    const proxy = validateProxy<{ value: number }>(
      { value: 1 },
      (_path, v) => (typeof v === "number" ? true : "not number")
    );
    expect(() => {
      proxy.value = "x" as any;
    }).toThrowError("invalid value: not number");
    proxy.value = 5;
    expect(proxy.value).toBe(5);
  });

  test("lazyProxy resolves missing values lazily", () => {
    let calls = 0;
    const proxy = lazyProxy<{ value: number }>(
      {},
      { value: () => (++calls, 42) }
    );
    expect(proxy.value).toBe(42);
    expect(proxy.value).toBe(42);
    expect(calls).toBe(1);
  });

  test("virtualRecord proxies get/set/keys", () => {
    const backing = new Map<PropertyKey, any>();
    const vr = virtualRecord(
      (k) => backing.get(k),
      (k, v) => !!backing.set(k, v),
      () => Array.from(backing.keys())
    );
    vr.foo = 1;
    expect(vr.foo).toBe(1);
    expect("foo" in vr).toBe(true);
    expect(Object.keys(vr)).toEqual(["foo"]);
  });

  test("chainProxy composes sources", () => {
    const proxy = chainProxy({ a: 1 }, { b: 2 }, { a: 3 });
    expect(proxy.a).toBe(1);
    expect(proxy.b).toBe(2);
    proxy.c = 4;
    expect(proxy.c).toBe(4);
  });

  test("trackPaths logs operations", () => {
    const logs: Array<{ op: string; path: (string | number | symbol)[]; value?: unknown }> = [];
    const proxy = trackPaths({ nested: { value: 1 } }, (rec) => logs.push(rec));
    // eslint-disable-next-line no-unused-expressions
    proxy.nested.value;
    proxy.nested.value = 2;
    delete proxy.nested.value;
    const summary = logs.map(({ op, path }) => ({ op, path }));
    expect(summary).toEqual([
      { op: "get", path: ["nested"] },
      { op: "get", path: ["nested", "value"] },
      { op: "set", path: ["nested", "value"] },
      { op: "del", path: ["nested", "value"] },
    ]);
  });

  test("makeRevocable revokes proxy access", () => {
    const { proxy, revoke } = makeRevocable({ value: 1 });
    expect(proxy.value).toBe(1);
    revoke();
    expect(() => proxy.value).toThrow();
  });
});

describe("record helpers", () => {
  test("hasOwn checks property presence", () => {
    const obj = { a: 1 } as const;
    expect(hasOwn(obj, "a")).toBe(true);
    expect(hasOwn(obj, "b")).toBe(false);
  });

  test("keys/entries/values mirror Object.*", () => {
    const obj = { a: 1, b: 2 };
    expect(keys(obj)).toEqual(["a", "b"]);
    expect(entries(obj)).toEqual([
      ["a", 1],
      ["b", 2],
    ]);
    expect(values(obj)).toEqual([1, 2]);
  });

  test("pick selects keys", () => {
    const obj = { a: 1, b: 2 };
    expect(pick(obj, ["a"])).toEqual({ a: 1 });
  });

  test("omit removes keys", () => {
    const obj = { a: 1, b: 2 };
    expect(omit(obj, ["a"])).toEqual({ b: 2 });
  });

  test("mapValues transforms each property", () => {
    const obj = { a: 1 };
    expect(mapValues(obj, (v) => v * 2)).toEqual({ a: 2 });
  });

  test("mapKeys remaps property names", () => {
    const obj = { a: 1, b: 2 };
    const result = mapKeys(obj, (k) => `_${String(k)}` as const);
    expect(result).toEqual({ _a: 1, _b: 2 });
  });

  test("filterObject filters by predicate", () => {
    const obj = { a: 1, b: 2 };
    expect(filterObject(obj, (v) => v > 1)).toEqual({ b: 2 });
  });

  test("reduceObject reduces to summary", () => {
    const obj = { a: 1, b: 2 };
    const sum = reduceObject(obj, (acc, v) => acc + v, 0);
    expect(sum).toBe(3);
  });
});
