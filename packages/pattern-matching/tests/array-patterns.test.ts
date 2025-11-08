import { describe, expect, test } from "bun:test";
import { match, Pattern as P } from "../src/index.ts";

describe("array length helpers", () => {
  test("length enforces exact match", () => {
    const pass = match([1, 2, 3])
      .with(P.array(P.number).length(3), () => true)
      .otherwise(() => false);

    const fail = match([1, 2])
      .with(P.array(P.number).length(3), () => true)
      .otherwise(() => false);

    expect(pass).toBe(true);
    expect(fail).toBe(false);
  });

  test("minLength enforces lower bound", () => {
    const result = match([1, 2, 3])
      .with(P.array(P.number).minLength(2), () => "ok")
      .otherwise(() => "nope");

    expect(result).toBe("ok");

    const tooShort = match([1])
      .with(P.array(P.number).minLength(2), () => true)
      .otherwise(() => false);

    expect(tooShort).toBe(false);
  });

  test("maxLength enforces upper bound", () => {
    const result = match([1, 2])
      .with(P.array(P.number).maxLength(2), () => "ok")
      .otherwise(() => "nope");

    expect(result).toBe("ok");

    const tooLong = match([1, 2, 3])
      .with(P.array(P.number).maxLength(2), () => true)
      .otherwise(() => false);

    expect(tooLong).toBe(false);
  });

  test("length matches exact size", () => {
    const result = match(["a", "b", "c"])
      .with(P.array(P.string).length(3), () => "just right")
      .otherwise(() => "nope");

    expect(result).toBe("just right");
  });

  test("nonEmpty matches arrays with at least one element", () => {
    const value = match(["a"])
      .with(P.array(P.string).nonEmpty(), (arr) => arr.length)
      .otherwise(() => 0);

    expect(value).toBe(1);

    const emptyResult = match([])
      .with(P.array(P.string).nonEmpty(), () => true)
      .otherwise(() => false);

    expect(emptyResult).toBe(false);
  });

  test("selection aggregation works with length guards", () => {
    const pattern = P.array(P.select("items")).minLength(1);

    const payload = ["alpha", "beta"];
    const selected = match(payload)
      .with(pattern, ({ items }) => items)
      .otherwise(() => []);

    expect(selected).toEqual(payload);
  });
});
