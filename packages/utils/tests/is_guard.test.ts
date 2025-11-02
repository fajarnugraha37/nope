import { describe, expect, test } from "bun:test";
import { Readable } from "stream";
import { tmpdir } from "os";
import { mkdtempSync, writeFileSync } from "fs";
import { join } from "path";

import {
  isNil,
  isDef,
  isBool,
  isNum,
  isInt,
  isFiniteNum,
  isStr,
  isBigInt,
  isSym,
  isObj,
  isArr,
  isDate,
  isRegExp,
  isMap,
  isSet,
  isEmpty,
} from "../src/is/primitives";
import {
  isFunc,
  isAsyncFunc,
  isPromise,
} from "../src/is/functions";
import {
  isArrayOf,
  isRecordOf,
  isTuple,
  isTuple2,
  isTuple3,
  isUnion,
  isUnion3,
  toAsync,
  asyncEvery,
} from "../src/is/async";
import { isOneOf, isShape } from "../src/is/combinators";
import {
  isBrowser,
  isNode,
  isJson,
  isReadableStreamWeb,
  isReadableStreamNode,
  isPathExists,
  isFile,
  isJsonFile,
  isAsyncIterable,
  isIterable,
  isArrayBuffer,
  isTypedArray,
  isBlob,
  isWebFile,
} from "../src/is/misc";
import { toErr } from "../src/guard/guard";
import {
  assert,
  unreachable,
  assertUnreachable,
} from "../src/guard/asserts";
import {
  ensure,
  ensureNotNil,
  ensureNonEmptyString,
  ensureArray,
  ensureArrayNonEmpty,
  ensureObject,
  ensureShape,
} from "../src/guard/ensure";

describe("primitive predicates", () => {
  test("basic type guards", () => {
    expect(isNil(null)).toBe(true);
    expect(isDef(1)).toBe(true);
    expect(isBool(true)).toBe(true);
    expect(isNum(1)).toBe(true);
    expect(isInt(2)).toBe(true);
    expect(isFiniteNum(2)).toBe(true);
    expect(isStr("hi")).toBe(true);
    expect(isBigInt(1n)).toBe(true);
    expect(isSym(Symbol("x"))).toBe(true);
    expect(isObj({})).toBe(true);
    expect(isArr([])).toBe(true);
    expect(isDate(new Date())).toBe(true);
    expect(isRegExp(/a/)).toBe(true);
    expect(isMap(new Map())).toBe(true);
    expect(isSet(new Set())).toBe(true);
    expect(isEmpty({})).toBe(true);
  });
});

describe("function predicates", () => {
  test("detect function shapes", () => {
    const asyncFn = async () => 1;
    expect(isFunc(asyncFn)).toBe(true);
    expect(isAsyncFunc(asyncFn)).toBe(true);
    expect(isPromise(Promise.resolve())).toBe(true);
  });
});

describe("async combinators", () => {
  const isNumber = (x: unknown): x is number => typeof x === "number";
  const isString = (x: unknown): x is string => typeof x === "string";

  test("higher-order guards", async () => {
    expect(isArrayOf(isNumber)([1, 2])).toBe(true);
    expect(isRecordOf(isString)({ a: "x" })).toBe(true);
    expect(isTuple(isNumber)([1])).toBe(true);
    expect(isTuple2(isNumber, isString)([1, "x"])).toBe(true);
    expect(isTuple3(isNumber, isNumber, isString)([1, 2, "x"])).toBe(true);
    expect(isUnion(isNumber, isString)(1)).toBe(true);
    expect(isUnion3(isNumber, isString, Array.isArray)([])).toBe(true);
    expect(await toAsync(isNumber)(2)).toBe(true);
    expect(await asyncEvery([toAsync(isNumber)])(3)).toBe(true);
  });
});

describe("combinators and shapes", () => {
  test("isOneOf and isShape", () => {
    expect(isOneOf("a", "a", "b")).toBe(true);
    expect(
      isShape(
        { a: 1, b: "x" },
        { a: (x: unknown): x is number => typeof x === "number", b: isStr }
      )
    ).toBe(true);
  });
});

describe("misc predicates", () => {
  test("environment detection", () => {
    expect(isBrowser()).toBe(false);
    expect(isNode()).toBe(true);
  });

  test("json helpers", () => {
    expect(isJson('{"a":1}')).toBe(true);
    expect(isJson("not json")).toBe(false);
  });

  test("stream detection", () => {
    expect(isReadableStreamWeb({})).toBe(false);
    const readable = new Readable({ read() {} });
    expect(isReadableStreamNode(readable)).toBe(true);
  });

  test("filesystem guards", async () => {
    const dir = mkdtempSync(join(tmpdir(), "nope-utils-"));
    const filePath = join(dir, "data.json");
    writeFileSync(filePath, '{"ok":true}', "utf8");
    expect(await isPathExists(filePath)).toBe(true);
    expect(await isFile(filePath)).toBe(true);
    const isJsonOk = await isJsonFile<{ ok: boolean }>(
      (x): x is { ok: boolean } => typeof x === "object" && x !== null && "ok" in x
    )(filePath);
    expect(isJsonOk).toBe(true);
  });

  test("iterable guards", () => {
    expect(isAsyncIterable((async function* () {})())).toBe(true);
    expect(isIterable([1, 2, 3])).toBe(true);
  });

  test("buffer and typed arrays", () => {
    const buffer = new ArrayBuffer(8);
    expect(isArrayBuffer(buffer)).toBe(true);
    expect(isTypedArray(new Uint8Array(buffer))).toBe(true);
  });

  test("blob and file detection", () => {
    const blob = new Blob(["x"]);
    expect(isBlob(blob)).toBe(true);
    if (typeof File !== "undefined") {
      const file = new File(["x"], "test.txt");
      expect(isWebFile(file)).toBe(true);
    } else {
      expect(isWebFile({})).toBe(false);
    }
  });
});

describe("guard helpers", () => {
  test("toErr normalises errors", () => {
    expect(toErr("oops")).toBe("oops");
    expect(toErr(() => "dynamic")).toBe("dynamic");
  });

  test("assert throws when condition fails", () => {
    expect(() => assert(false, "fail")).toThrow("fail");
  });

  test("unreachable and assertUnreachable throw", () => {
    expect(() => unreachable(null as never, "nope")).toThrow("nope");
    expect(() => assertUnreachable(null as never, "boom")).toThrow("boom");
  });

  test("ensure helpers narrow values", () => {
    expect(ensure(1, isNum)).toBe(1);
    expect(ensureNotNil(1)).toBe(1);
    expect(ensureNonEmptyString("hi")).toBe("hi");
    expect(ensureArray([1])).toEqual([1]);
    expect(ensureArrayNonEmpty([1])).toEqual([1]);
    expect(ensureObject({ a: 1 })).toEqual({ a: 1 });
    expect(
      ensureShape(
        { a: 1, b: "x" },
        { a: isNum, b: isStr }
      )
    ).toEqual({ a: 1, b: "x" });
  });
});
