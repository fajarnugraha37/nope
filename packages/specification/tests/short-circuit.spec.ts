import { describe, expect, it } from "bun:test";
import { all, any } from "../src/core/combinators";
import { BaseSpec } from "../src/core/base-spec";

class CountingSpec extends BaseSpec<number> {
  constructor(
    private shouldPass: boolean,
    private asyncMode: boolean,
    private counter: { count: number },
  ) {
    super();
  }

  protected evaluate(candidate: number): boolean | Promise<boolean> {
    if (this.asyncMode) {
      return new Promise((resolve) => {
        this.counter.count++;
        setTimeout(() => resolve(this.shouldPass), 1);
      });
    }
    this.counter.count++;
    return this.shouldPass;
  }
}

describe("Short-Circuit Optimization", () => {


  describe("Asynchronous AND", () => {
    it("stops on first false", async () => {
      const counter = { count: 0 };
      const spec1 = new CountingSpec(false, true, counter);
      const spec2 = new CountingSpec(true, true, counter);
      const spec3 = new CountingSpec(true, true, counter);

      const combined = all(spec1, spec2, spec3);
      const result = await combined.isSatisfiedByAsync!(42);

      expect(result).toBe(false);
      expect(counter.count).toBe(1);
    });

    it("evaluates all when all pass", async () => {
      const counter = { count: 0 };
      const spec1 = new CountingSpec(true, true, counter);
      const spec2 = new CountingSpec(true, true, counter);
      const spec3 = new CountingSpec(true, true, counter);

      const combined = all(spec1, spec2, spec3);
      const result = await combined.isSatisfiedByAsync!(42);

      expect(result).toBe(true);
      expect(counter.count).toBe(3);
    });

    it("stops on second false", async () => {
      const counter = { count: 0 };
      const spec1 = new CountingSpec(true, true, counter);
      const spec2 = new CountingSpec(false, true, counter);
      const spec3 = new CountingSpec(true, true, counter);

      const combined = all(spec1, spec2, spec3);
      const result = await combined.isSatisfiedByAsync!(42);

      expect(result).toBe(false);
      expect(counter.count).toBe(2);
    });
  });

  describe("Asynchronous OR", () => {
    it("stops on first true", async () => {
      const counter = { count: 0 };
      const spec1 = new CountingSpec(true, true, counter);
      const spec2 = new CountingSpec(false, true, counter);
      const spec3 = new CountingSpec(false, true, counter);

      const combined = any(spec1, spec2, spec3);
      const result = await combined.isSatisfiedByAsync!(42);

      expect(result).toBe(true);
      expect(counter.count).toBe(1);
    });

    it("evaluates all when all fail", async () => {
      const counter = { count: 0 };
      const spec1 = new CountingSpec(false, true, counter);
      const spec2 = new CountingSpec(false, true, counter);
      const spec3 = new CountingSpec(false, true, counter);

      const combined = any(spec1, spec2, spec3);
      const result = await combined.isSatisfiedByAsync!(42);

      expect(result).toBe(false);
      expect(counter.count).toBe(3);
    });

    it("stops on second true", async () => {
      const counter = { count: 0 };
      const spec1 = new CountingSpec(false, true, counter);
      const spec2 = new CountingSpec(true, true, counter);
      const spec3 = new CountingSpec(false, true, counter);

      const combined = any(spec1, spec2, spec3);
      const result = await combined.isSatisfiedByAsync!(42);

      expect(result).toBe(true);
      expect(counter.count).toBe(2);
    });
  });

  describe("Performance Characteristics", () => {
    it("demonstrates AND short-circuit with 100 specs", async () => {
      const counter = { count: 0 };
      const specs = [
        new CountingSpec(false, true, counter),
        ...Array.from({ length: 99 }, () => new CountingSpec(true, true, counter)),
      ];

      const combined = all(...specs);
      const result = await combined.isSatisfiedByAsync!(42);

      expect(result).toBe(false);
      expect(counter.count).toBe(1);
    });

    it("demonstrates OR short-circuit with 100 specs", async () => {
      const counter = { count: 0 };
      const specs = [
        new CountingSpec(true, true, counter),
        ...Array.from({ length: 99 }, () => new CountingSpec(false, true, counter)),
      ];

      const combined = any(...specs);
      const result = await combined.isSatisfiedByAsync!(42);

      expect(result).toBe(true);
      expect(counter.count).toBe(1);
    });
  });

  describe("Nested Combinators", () => {
    it("short-circuits in nested AND within OR", async () => {
      const counter = { count: 0 };
      
      // OR([AND([false, true]), true])
      // Should evaluate: false in first AND (1), then true in OR (1)
      const innerAnd = all(
        new CountingSpec(false, true, counter),
        new CountingSpec(true, true, counter),
      );
      const combined = any(
        innerAnd,
        new CountingSpec(true, true, counter),
      );

      const result = await combined.isSatisfiedByAsync!(42);

      expect(result).toBe(true);
      expect(counter.count).toBe(2); // 1 from inner AND + 1 from outer OR
    });

    it("short-circuits in nested OR within AND", async () => {
      const counter = { count: 0 };
      
      // AND([OR([true, false]), false])
      // Should evaluate: true in first OR (1), then false in AND (1)
      const innerOr = any(
        new CountingSpec(true, true, counter),
        new CountingSpec(false, true, counter),
      );
      const combined = all(
        innerOr,
        new CountingSpec(false, true, counter),
      );

      const result = await combined.isSatisfiedByAsync!(42);

      expect(result).toBe(false);
      expect(counter.count).toBe(2); // 1 from inner OR + 1 from outer AND
    });

    it("deeply nested combinators short-circuit correctly", async () => {
      const counter = { count: 0 };
      
      // AND([
      //   OR([false, AND([true, true])]),
      //   OR([true, false])
      // ])
      // Expected: false in first OR (1), true+true in inner AND (2), 
      //           true in second OR (1) = 4 total
      const deepInnerAnd = all(
        new CountingSpec(true, true, counter),
        new CountingSpec(true, true, counter),
      );
      const firstOr = any(
        new CountingSpec(false, true, counter),
        deepInnerAnd,
      );
      const secondOr = any(
        new CountingSpec(true, true, counter),
        new CountingSpec(false, true, counter),
      );
      const combined = all(firstOr, secondOr);

      const result = await combined.isSatisfiedByAsync!(42);

      expect(result).toBe(true);
      expect(counter.count).toBe(4);
    });

    it("stops early in complex nested structure", async () => {
      const counter = { count: 0 };
      
      // AND([
      //   AND([true, true]),
      //   OR([false, false]),
      //   true  // Should never reach this
      // ])
      // Expected: 2 (from first AND) + 2 (from OR, both evaluated) = 4
      const firstAnd = all(
        new CountingSpec(true, true, counter),
        new CountingSpec(true, true, counter),
      );
      const secondOr = any(
        new CountingSpec(false, true, counter),
        new CountingSpec(false, true, counter),
      );
      const combined = all(
        firstAnd,
        secondOr,
        new CountingSpec(true, true, counter), // Should not be evaluated
      );

      const result = await combined.isSatisfiedByAsync!(42);

      expect(result).toBe(false);
      expect(counter.count).toBe(4); // Never reaches the third spec
    });
  });

  describe("Mixed Sync/Async", () => {
    it("short-circuits with sync specs in AND", async () => {
      const counter = { count: 0 };
      
      // Mix sync (false) + async specs
      const combined = all(
        new CountingSpec(false, false, counter), // sync false
        new CountingSpec(true, true, counter),   // async true
        new CountingSpec(true, true, counter),   // async true
      );

      const result = await combined.isSatisfiedByAsync!(42);

      expect(result).toBe(false);
      expect(counter.count).toBe(1); // Only sync false evaluated
    });

    it("short-circuits with sync specs in OR", async () => {
      const counter = { count: 0 };
      
      // Mix sync (true) + async specs
      const combined = any(
        new CountingSpec(true, false, counter), // sync true
        new CountingSpec(false, true, counter), // async false
        new CountingSpec(false, true, counter), // async false
      );

      const result = await combined.isSatisfiedByAsync!(42);

      expect(result).toBe(true);
      expect(counter.count).toBe(1); // Only sync true evaluated
    });

    it("evaluates async after sync in AND when needed", async () => {
      const counter = { count: 0 };
      
      // Sync passes, async fails
      const combined = all(
        new CountingSpec(true, false, counter),  // sync true
        new CountingSpec(false, true, counter),  // async false
        new CountingSpec(true, true, counter),   // async true (not reached)
      );

      const result = await combined.isSatisfiedByAsync!(42);

      expect(result).toBe(false);
      expect(counter.count).toBe(2); // sync + first async
    });

    it("evaluates async after sync in OR when needed", async () => {
      const counter = { count: 0 };
      
      // Sync fails, async succeeds
      const combined = any(
        new CountingSpec(false, false, counter), // sync false
        new CountingSpec(true, true, counter),   // async true
        new CountingSpec(false, true, counter),  // async false (not reached)
      );

      const result = await combined.isSatisfiedByAsync!(42);

      expect(result).toBe(true);
      expect(counter.count).toBe(2); // sync + first async
    });

    it("handles mixed sync/async in nested combinators", async () => {
      const counter = { count: 0 };
      
      // OR([
      //   AND([sync:false, async:true]),
      //   sync:true
      // ])
      const innerAnd = all(
        new CountingSpec(false, false, counter), // sync false
        new CountingSpec(true, true, counter),   // async true (not reached)
      );
      const combined = any(
        innerAnd,
        new CountingSpec(true, false, counter),  // sync true
      );

      const result = await combined.isSatisfiedByAsync!(42);

      expect(result).toBe(true);
      expect(counter.count).toBe(2); // 1 from inner AND + 1 from outer OR
    });

    it("all sync specs use synchronous short-circuit in AND", async () => {
      const counter = { count: 0 };
      
      // All sync AND - evaluated with isSatisfiedByAsync but specs are sync
      const combined = all(
        new CountingSpec(false, false, counter),
        new CountingSpec(true, false, counter),
        new CountingSpec(true, false, counter),
      );

      const result = await combined.isSatisfiedByAsync!(42);

      expect(result).toBe(false);
      expect(counter.count).toBe(1);
    });

    it("all sync specs use synchronous short-circuit in OR", async () => {
      const counter = { count: 0 };
      
      // All sync OR - evaluated with isSatisfiedByAsync but specs are sync
      const combined = any(
        new CountingSpec(true, false, counter),
        new CountingSpec(false, false, counter),
        new CountingSpec(false, false, counter),
      );

      const result = await combined.isSatisfiedByAsync!(42);

      expect(result).toBe(true);
      expect(counter.count).toBe(1);
    });
  });

  describe("Edge Cases", () => {
    it("single spec AND short-circuits (trivial case)", async () => {
      const counter = { count: 0 };
      const combined = all(new CountingSpec(false, true, counter));

      const result = await combined.isSatisfiedByAsync!(42);

      expect(result).toBe(false);
      expect(counter.count).toBe(1);
    });

    it("single spec OR short-circuits (trivial case)", async () => {
      const counter = { count: 0 };
      const combined = any(new CountingSpec(true, true, counter));

      const result = await combined.isSatisfiedByAsync!(42);

      expect(result).toBe(true);
      expect(counter.count).toBe(1);
    });

    it("empty array AND returns true without evaluation", async () => {
      const combined = all();
      const result = await combined.isSatisfiedByAsync!(42);
      expect(result).toBe(true);
    });

    it("empty array OR returns false without evaluation", async () => {
      const combined = any();
      const result = await combined.isSatisfiedByAsync!(42);
      expect(result).toBe(false);
    });

    it("alternating pass/fail in AND stops at first fail", async () => {
      const counter = { count: 0 };
      const combined = all(
        new CountingSpec(true, true, counter),
        new CountingSpec(false, true, counter),
        new CountingSpec(true, true, counter),
        new CountingSpec(false, true, counter),
      );

      const result = await combined.isSatisfiedByAsync!(42);

      expect(result).toBe(false);
      expect(counter.count).toBe(2); // Stops at second spec
    });

    it("alternating fail/pass in OR stops at first pass", async () => {
      const counter = { count: 0 };
      const combined = any(
        new CountingSpec(false, true, counter),
        new CountingSpec(true, true, counter),
        new CountingSpec(false, true, counter),
        new CountingSpec(true, true, counter),
      );

      const result = await combined.isSatisfiedByAsync!(42);

      expect(result).toBe(true);
      expect(counter.count).toBe(2); // Stops at second spec
    });
  });
});
