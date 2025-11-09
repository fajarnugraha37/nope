import { describe, expect, test } from "bun:test";
import {
  mapG,
  filterG,
  take,
  drop,
  takeWhile,
  dropWhile,
  enumerate,
  chunk,
  slidingWindow,
  flatten,
  flatMap,
  zip,
  interleave,
  uniqueBy,
} from "../src/generator/basics";
import {
  reduceG,
  toArray,
  toSet,
  toMap,
} from "../src/generator/collectors";
import {
  range,
  count,
  repeat,
  cycle,
} from "../src/generator/creators";
import { mergeSorted } from "../src/generator/sort";
import { tee } from "../src/generator/tee";

const array = <T>(iter: Iterable<T>) => Array.from(iter);

describe("generator basics", () => {
  test("mapG and filterG transform sequences", () => {
    expect(array(mapG([1, 2], (x) => x * 2))).toEqual([2, 4]);
    expect(array(filterG([1, 2, 3], (x) => x % 2 === 1))).toEqual([1, 3]);
  });

  test("take and drop work with counts", () => {
    expect(array(take([1, 2, 3], 2))).toEqual([1, 2]);
    expect(array(drop([1, 2, 3], 1))).toEqual([2, 3]);
  });

  test("takeWhile and dropWhile respect predicates", () => {
    expect(array(takeWhile([1, 2, 3], (x) => x < 3))).toEqual([1, 2]);
    expect(array(dropWhile([1, 2, 3], (x) => x < 2))).toEqual([2, 3]);
  });

  test("enumerate pairs elements with indices", () => {
    expect(array(enumerate(["a", "b"], 1))).toEqual([
      [1, "a"],
      [2, "b"],
    ]);
  });

  test("chunk groups into fixed sizes", () => {
    expect(array(chunk([1, 2, 3, 4, 5], 2))).toEqual([
      [1, 2],
      [3, 4],
      [5],
    ]);
  });

  test("slidingWindow yields overlapping windows", () => {
    expect(array(slidingWindow([1, 2, 3, 4], 2, 1))).toEqual([
      [1, 2],
      [2, 3],
      [3, 4],
    ]);
  });

  test("flatten and flatMap collapse iterables", () => {
    expect(array(flatten([[1, 2], [3]]))).toEqual([1, 2, 3]);
    expect(array(flatMap([1, 2], (x) => [x, x * 10]))).toEqual([
      1, 10, 2, 20,
    ]);
  });

  test("zip combines sequences by index", () => {
    expect(array(zip([1, 2], ["a", "b"]))).toEqual([
      [1, "a"],
      [2, "b"],
    ]);
  });

  test("interleave cycles through iterators", () => {
    expect(array(interleave([1, 2], ["a"], [true, false]))).toEqual([
      1,
      "a",
      true,
      2,
      false,
    ]);
  });

  test("uniqueBy filters duplicate keys", () => {
    const data = [
      { id: 1, v: "a" },
      { id: 1, v: "b" },
      { id: 2, v: "c" },
    ];
    expect(array(uniqueBy(data, (x) => x.id))).toEqual([
      { id: 1, v: "a" },
      { id: 2, v: "c" },
    ]);
  });
});

describe("generator collectors", () => {
  test("reduceG accumulates values", () => {
    expect(reduceG([1, 2, 3], (acc, x) => acc + x, 0)).toBe(6);
  });

  test("toArray, toSet, toMap collect results", () => {
    expect(toArray(new Set([1, 2]))).toEqual([1, 2]);
    expect(toSet([1, 1, 2])).toEqual(new Set([1, 2]));
    const map = toMap(
      ["a", "bb"],
      (x) => x,
      (x) => x.length
    );
    expect(map.get("bb")).toBe(2);
  });
});

describe("generator creators", () => {
  test("range produces sequences", () => {
    expect(array(range(0, 3))).toEqual([0, 1, 2]);
    expect(array(range(3))).toEqual([0, 1, 2]);
    expect(array(range(5, 0, -2))).toEqual([5, 3, 1]);
  });

  test("count yields infinite sequence with step", () => {
    const iter = count(1, 2)[Symbol.iterator]();
    expect(iter.next().value).toBe(1);
    expect(iter.next().value).toBe(3);
  });

  test("repeat yields repeated values", () => {
    expect(array(take(repeat("x"), 3))).toEqual(["x", "x", "x"]);
    expect(array(repeat("x", 2))).toEqual(["x", "x"]);
  });

  test("cycle repeats source infinitely", () => {
    expect(array(take(cycle([1, 2]), 5))).toEqual([1, 2, 1, 2, 1]);
  });
});

describe("generator sort and tee", () => {
  test("mergeSorted merges ordered streams", () => {
    const merged = array(
      mergeSorted(
        (a, b) => a - b,
        [1, 4],
        [2, 3],
        [0, 5]
      )
    );
    expect(merged).toEqual([0, 1, 2, 3, 4, 5]);
  });

  test("tee clones iterables", () => {
    const [a, b] = tee([1, 2, 3], 2);
    expect(array(a)).toEqual([1, 2, 3]);
    expect(array(b)).toEqual([1, 2, 3]);
  });
});
