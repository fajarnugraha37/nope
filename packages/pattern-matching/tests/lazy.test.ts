import { describe, expect, test } from "bun:test";
import { match, Pattern as P } from "../src/index.ts";

describe("P.lazy", () => {
  test("matches recursive tree structures", () => {
    type Node = { value: number; children?: Node[] };

    const tree = P.lazy(() => ({
      value: P.number,
      children: P.array(tree).optional(),
    }));

    const sample: Node = {
      value: 1,
      children: [
        { value: 2 },
        {
          value: 3,
          children: [{ value: 4 }],
        },
      ],
    };

    const total = (node: Node): number =>
      match(node)
        .with(
          tree,
          ({ value, children }) =>
            value +
            (children ? children.map(total).reduce((a, b) => a + b, 0) : 0)
        )
        .otherwise(() => 0);

    expect(total(sample)).toBe(10);
  });

  test("preserves selections within lazy patterns", () => {
    type Expr =
      | { type: "leaf"; value: number }
      | { type: "node"; children: Expr[] };

    const expr = P.lazy(() =>
      P.union(
        { type: "leaf", value: P.select("leafValue", P.number) },
        { type: "node", children: P.array(expr) }
      )
    );

    const result = match<Expr>({ type: "leaf", value: 42 })
      .with(expr, (obj) => obj.leafValue ?? 0)
      .otherwise(() => -1);

    expect(result).toBe(42);
  });
});
