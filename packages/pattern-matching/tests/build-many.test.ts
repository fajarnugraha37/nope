import { describe, expect, test } from "bun:test";
import { BuildMany } from "../src/types/build-many.ts";
import { Equal, Expect } from "../src/types/helpers.ts";
import { State } from "./resources/index.ts";

describe("BuildMany", () => {
  test("should correctly update the content of a readonly tuple", () => {
    type cases = [
      Expect<
        Equal<
          BuildMany<readonly [number, State], [[{ status: "idle" }, [1]]]>,
          [number, { status: "idle" }]
        >
      >,
      Expect<
        Equal<
          BuildMany<
            readonly [number, State],
            [[{ status: "idle" }, [1]]] | [[{ status: "loading" }, [1]]]
          >,
          [number, { status: "idle" }] | [number, { status: "loading" }]
        >
      >
    ];
  });
});
