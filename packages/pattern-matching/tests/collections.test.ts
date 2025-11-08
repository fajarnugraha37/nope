import { describe, expect, test } from "bun:test";
import { match, Pattern as P } from "../src/index.ts";

describe("set/map size helpers", () => {
  test("set size helpers", () => {
    const exactlyTwo = new Set([1, 2]);
    const result = match(exactlyTwo)
      .with(P.set(P.number).size(2), () => "two")
      .otherwise(() => "other");

    expect(result).toBe("two");

    const largeEnough = match(new Set([1, 2, 3]))
      .with(P.set(P.number).minSize(2), () => true)
      .otherwise(() => false);

    expect(largeEnough).toBe(true);

    const notEnough = match(new Set<number>())
      .with(P.set(P.number).nonEmpty(), () => true)
      .otherwise(() => false);

    expect(notEnough).toBe(false);

    const tooLarge = match(new Set([1, 2, 3]))
      .with(P.set(P.number).maxSize(2), () => true)
      .otherwise(() => false);

    expect(tooLarge).toBe(false);
  });

  test("map size helpers", () => {
    const map = new Map([
      ["a", 1],
      ["b", 2],
    ]);

    const exact = match(map)
      .with(P.map(P.string, P.number).size(2), () => true)
      .otherwise(() => false);

    expect(exact).toBe(true);

    const bounded = match(map)
      .with(P.map(P.string, P.number).maxSize(1), () => true)
      .otherwise(() => false);

    expect(bounded).toBe(false);

    const nonEmpty = match(new Map([["x", 1]]))
      .with(P.map(P.string, P.number).nonEmpty(), () => true)
      .otherwise(() => false);

    expect(nonEmpty).toBe(true);
  });
});
