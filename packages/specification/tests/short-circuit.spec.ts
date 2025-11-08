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
});
