import { describe, test, expect } from "bun:test";
import * as fc from "fast-check";
import { spec, toAst, fromAst, createRegistry, all, any, none, builtInOperators } from "../src/index.js";
import type { Specification } from "../src/core/types.js";

// Arbitraries for generating random specifications
const arbValue = fc.oneof(
  fc.integer(),
  fc.string(),
  fc.boolean(),
  fc.constant(null),
  fc.constant(undefined)
);

const arbFieldPath = fc.oneof(
  fc.constant("age"),
  fc.constant("name"),
  fc.constant("email"),
  fc.constant("status"),
  fc.constant("score")
);

const arbFieldSpec = fc
  .tuple(arbFieldPath, arbValue)
  .map(([path, value]) => spec.field<any>(path).eq(value));

const arbComparison = fc
  .tuple(arbFieldPath, fc.integer({ min: 0, max: 100 }))
  .chain(([path, value]) =>
    fc.oneof(
      fc.constant(spec.field<any>(path).eq(value)),
      fc.constant(spec.field<any>(path).ne(value)),
      fc.constant(spec.field<any>(path).gt(value)),
      fc.constant(spec.field<any>(path).gte(value)),
      fc.constant(spec.field<any>(path).lt(value)),
      fc.constant(spec.field<any>(path).lte(value))
    )
  );

const arbStringOp = fc
  .tuple(arbFieldPath, fc.string({ minLength: 1, maxLength: 10 }))
  .chain(([path, value]) =>
    fc.oneof(
      fc.constant(spec.field<any>(path).contains(value)),
      fc.constant(spec.field<any>(path).startsWith(value)),
      fc.constant(spec.field<any>(path).endsWith(value))
    )
  );

const arbExistence = arbFieldPath.chain((path) =>
  fc.oneof(
    fc.constant(spec.field<any>(path).exists()),
    fc.constant(spec.field<any>(path).missing())
  )
);

const arbArrayOp = fc
  .tuple(arbFieldPath, fc.array(fc.integer(), { minLength: 1, maxLength: 5 }))
  .chain(([path, values]) =>
    fc.oneof(
      fc.constant(spec.field<any>(path).in(values)),
      fc.constant(spec.field<any>(path).notIn(values))
    )
  );

// Simple spec (leaf node)
const arbSimpleSpec: fc.Arbitrary<Specification<any>> = fc.oneof(
  arbFieldSpec,
  arbComparison,
  arbStringOp,
  arbExistence,
  arbArrayOp
);

// Composite spec (with combinators) - limited depth to avoid stack overflow
const arbCompositeSpec = (depth: number): fc.Arbitrary<Specification<any>> => {
  if (depth <= 0) {
    return arbSimpleSpec;
  }

  return fc.oneof(
    arbSimpleSpec,
    fc.tuple(arbCompositeSpec(depth - 1), arbCompositeSpec(depth - 1)).map(([s1, s2]) => s1.and(s2)),
    fc.tuple(arbCompositeSpec(depth - 1), arbCompositeSpec(depth - 1)).map(([s1, s2]) => s1.or(s2)),
    arbCompositeSpec(depth - 1).map((s) => s.not())
  );
};

const arbSpec = arbCompositeSpec(2);

// Helper to evaluate specs
const evaluateSpec = async (s: Specification<any>, value: any): Promise<boolean> => {
  if (s.isSatisfiedByAsync) {
    return s.isSatisfiedByAsync(value);
  }
  return s.isSatisfiedBy(value);
};

// Test data generator
const arbTestData = fc.record({
  age: fc.integer({ min: 0, max: 120 }),
  name: fc.string(),
  email: fc.emailAddress(),
  status: fc.oneof(fc.constant("active"), fc.constant("inactive"), fc.constant("pending")),
  score: fc.integer({ min: 0, max: 100 }),
});

describe("Property-Based Testing", () => {
  describe("AST Round-Trip Integrity", () => {
    test("toAst/fromAst preserves specification behavior", () => {
      fc.assert(
        fc.asyncProperty(arbSpec, arbTestData, async (originalSpec, testData) => {
          const registry = createRegistry({ operators: builtInOperators });

          // Convert to AST and back
          const ast = toAst(originalSpec);
          const reconstructedSpec = fromAst(ast, registry);

          // Both should produce the same result
          const originalResult = await evaluateSpec(originalSpec, testData);
          const reconstructedResult = await evaluateSpec(reconstructedSpec, testData);

          expect(reconstructedResult).toBe(originalResult);
        }),
        { numRuns: 100 }
      );
    });

    test("double round-trip produces identical AST", () => {
      fc.assert(
        fc.property(arbSpec, (originalSpec) => {
          const registry = createRegistry({ operators: builtInOperators });

          const ast1 = toAst(originalSpec);
          const spec1 = fromAst(ast1, registry);
          const ast2 = toAst(spec1);

          // AST structure should be identical
          expect(JSON.stringify(ast2)).toBe(JSON.stringify(ast1));
        }),
        { numRuns: 100 }
      );
    });

    test("AST serialization is deterministic", () => {
      fc.assert(
        fc.property(arbSpec, (spec) => {
          const ast1 = toAst(spec);
          const ast2 = toAst(spec);

          // Same spec should produce identical AST
          expect(JSON.stringify(ast1)).toBe(JSON.stringify(ast2));
        }),
        { numRuns: 100 }
      );
    });
  });

  describe("Commutativity of Combinators", () => {
    test("AND is commutative: a.and(b) ≡ b.and(a)", () => {
      fc.assert(
        fc.asyncProperty(arbSimpleSpec, arbSimpleSpec, arbTestData, async (a, b, testData) => {
          const ab = a.and(b);
          const ba = b.and(a);

          const resultAB = await evaluateSpec(ab, testData);
          const resultBA = await evaluateSpec(ba, testData);

          expect(resultBA).toBe(resultAB);
        }),
        { numRuns: 100 }
      );
    });

    test("OR is commutative: a.or(b) ≡ b.or(a)", () => {
      fc.assert(
        fc.asyncProperty(arbSimpleSpec, arbSimpleSpec, arbTestData, async (a, b, testData) => {
          const ab = a.or(b);
          const ba = b.or(a);

          const resultAB = await evaluateSpec(ab, testData);
          const resultBA = await evaluateSpec(ba, testData);

          expect(resultBA).toBe(resultAB);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe("Associativity of Combinators", () => {
    test("AND is associative: (a.and(b)).and(c) ≡ a.and(b.and(c))", () => {
      fc.assert(
        fc.asyncProperty(
          arbSimpleSpec,
          arbSimpleSpec,
          arbSimpleSpec,
          arbTestData,
          async (a, b, c, testData) => {
            const left = a.and(b).and(c);
            const right = a.and(b.and(c));

            const resultLeft = await evaluateSpec(left, testData);
            const resultRight = await evaluateSpec(right, testData);

            expect(resultRight).toBe(resultLeft);
          }
        ),
        { numRuns: 100 }
      );
    });

    test("OR is associative: (a.or(b)).or(c) ≡ a.or(b.or(c))", () => {
      fc.assert(
        fc.asyncProperty(
          arbSimpleSpec,
          arbSimpleSpec,
          arbSimpleSpec,
          arbTestData,
          async (a, b, c, testData) => {
            const left = a.or(b).or(c);
            const right = a.or(b.or(c));

            const resultLeft = await evaluateSpec(left, testData);
            const resultRight = await evaluateSpec(right, testData);

            expect(resultRight).toBe(resultLeft);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe("Boolean Algebra Laws", () => {
    test("De Morgan's Law: not(a.and(b)) ≡ not(a).or(not(b))", () => {
      fc.assert(
        fc.asyncProperty(arbSimpleSpec, arbSimpleSpec, arbTestData, async (a, b, testData) => {
          const left = a.and(b).not();
          const right = a.not().or(b.not());

          const resultLeft = await evaluateSpec(left, testData);
          const resultRight = await evaluateSpec(right, testData);

          expect(resultRight).toBe(resultLeft);
        }),
        { numRuns: 100 }
      );
    });

    test("De Morgan's Law: not(a.or(b)) ≡ not(a).and(not(b))", () => {
      fc.assert(
        fc.asyncProperty(arbSimpleSpec, arbSimpleSpec, arbTestData, async (a, b, testData) => {
          const left = a.or(b).not();
          const right = a.not().and(b.not());

          const resultLeft = await evaluateSpec(left, testData);
          const resultRight = await evaluateSpec(right, testData);

          expect(resultRight).toBe(resultLeft);
        }),
        { numRuns: 100 }
      );
    });

    test("Double Negation: not(not(a)) ≡ a", () => {
      fc.assert(
        fc.asyncProperty(arbSimpleSpec, arbTestData, async (a, testData) => {
          const doubled = a.not().not();

          const resultOriginal = await evaluateSpec(a, testData);
          const resultDoubled = await evaluateSpec(doubled, testData);

          expect(resultDoubled).toBe(resultOriginal);
        }),
        { numRuns: 100 }
      );
    });

    test("Distributivity: a.and(b.or(c)) ≡ (a.and(b)).or(a.and(c))", () => {
      fc.assert(
        fc.asyncProperty(
          arbSimpleSpec,
          arbSimpleSpec,
          arbSimpleSpec,
          arbTestData,
          async (a, b, c, testData) => {
            const left = a.and(b.or(c));
            const right = a.and(b).or(a.and(c));

            const resultLeft = await evaluateSpec(left, testData);
            const resultRight = await evaluateSpec(right, testData);

            expect(resultRight).toBe(resultLeft);
          }
        ),
        { numRuns: 100 }
      );
    });

    test("Distributivity: a.or(b.and(c)) ≡ (a.or(b)).and(a.or(c))", () => {
      fc.assert(
        fc.asyncProperty(
          arbSimpleSpec,
          arbSimpleSpec,
          arbSimpleSpec,
          arbTestData,
          async (a, b, c, testData) => {
            const left = a.or(b.and(c));
            const right = a.or(b).and(a.or(c));

            const resultLeft = await evaluateSpec(left, testData);
            const resultRight = await evaluateSpec(right, testData);

            expect(resultRight).toBe(resultLeft);
          }
        ),
        { numRuns: 100 }
      );
    });

    test("Identity: a.and(true) ≡ a", () => {
      fc.assert(
        fc.asyncProperty(arbSimpleSpec, arbTestData, async (a, testData) => {
          // Create a spec that always returns true
          const alwaysTrue = spec.field<any>("age").gte(0); // Assuming age is always >= 0

          const combined = a.and(alwaysTrue);

          const resultOriginal = await evaluateSpec(a, testData);
          const resultCombined = await evaluateSpec(combined, testData);

          // This may not always hold if alwaysTrue isn't actually always true
          // So we check: if alwaysTrue is true, then combined should equal a
          const alwaysTrueResult = await evaluateSpec(alwaysTrue, testData);
          if (alwaysTrueResult) {
            expect(resultCombined).toBe(resultOriginal);
          }
        }),
        { numRuns: 100 }
      );
    });

    test("Absorption: a.or(a.and(b)) ≡ a", () => {
      fc.assert(
        fc.asyncProperty(arbSimpleSpec, arbSimpleSpec, arbTestData, async (a, b, testData) => {
          const combined = a.or(a.and(b));

          const resultOriginal = await evaluateSpec(a, testData);
          const resultCombined = await evaluateSpec(combined, testData);

          expect(resultCombined).toBe(resultOriginal);
        }),
        { numRuns: 100 }
      );
    });

    test("Absorption: a.and(a.or(b)) ≡ a", () => {
      fc.assert(
        fc.asyncProperty(arbSimpleSpec, arbSimpleSpec, arbTestData, async (a, b, testData) => {
          const combined = a.and(a.or(b));

          const resultOriginal = await evaluateSpec(a, testData);
          const resultCombined = await evaluateSpec(combined, testData);

          expect(resultCombined).toBe(resultOriginal);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe("Idempotence", () => {
    test("AND is idempotent: a.and(a) ≡ a", () => {
      fc.assert(
        fc.asyncProperty(arbSimpleSpec, arbTestData, async (a, testData) => {
          const doubled = a.and(a);

          const resultOriginal = await evaluateSpec(a, testData);
          const resultDoubled = await evaluateSpec(doubled, testData);

          expect(resultDoubled).toBe(resultOriginal);
        }),
        { numRuns: 100 }
      );
    });

    test("OR is idempotent: a.or(a) ≡ a", () => {
      fc.assert(
        fc.asyncProperty(arbSimpleSpec, arbTestData, async (a, testData) => {
          const doubled = a.or(a);

          const resultOriginal = await evaluateSpec(a, testData);
          const resultDoubled = await evaluateSpec(doubled, testData);

          expect(resultDoubled).toBe(resultOriginal);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe("Combinator Helpers Equivalence", () => {
    test("all([a, b, c]) ≡ a.and(b).and(c)", () => {
      fc.assert(
        fc.asyncProperty(
          arbSimpleSpec,
          arbSimpleSpec,
          arbSimpleSpec,
          arbTestData,
          async (a, b, c, testData) => {
            const usingAll = all(a, b, c);
            const usingAnd = a.and(b).and(c);

            const resultAll = await evaluateSpec(usingAll, testData);
            const resultAnd = await evaluateSpec(usingAnd, testData);

            expect(resultAll).toBe(resultAnd);
          }
        ),
        { numRuns: 100 }
      );
    });

    test("any([a, b, c]) ≡ a.or(b).or(c)", () => {
      fc.assert(
        fc.asyncProperty(
          arbSimpleSpec,
          arbSimpleSpec,
          arbSimpleSpec,
          arbTestData,
          async (a, b, c, testData) => {
            const usingAny = any(a, b, c);
            const usingOr = a.or(b).or(c);

            const resultAny = await evaluateSpec(usingAny, testData);
            const resultOr = await evaluateSpec(usingOr, testData);

            expect(resultAny).toBe(resultOr);
          }
        ),
        { numRuns: 100 }
      );
    });

    test("none([a, b]) ≡ not(a).and(not(b))", () => {
      fc.assert(
        fc.asyncProperty(arbSimpleSpec, arbSimpleSpec, arbTestData, async (a, b, testData) => {
          const usingNone = none(a, b);
          const usingNot = a.not().and(b.not());

          const resultNone = await evaluateSpec(usingNone, testData);
          const resultNot = await evaluateSpec(usingNot, testData);

          expect(resultNone).toBe(resultNot);
        }),
        { numRuns: 100 }
      );
    });
  });
});
