import { describe, expect, it } from "bun:test";
import { BaseSpec, withMeta } from "../src/core/base-spec";
import type { Specification, SpecMeta, SpecContext } from "../src/core/types";

class TestSpec extends BaseSpec<number> {
  constructor(private value: number, meta?: SpecMeta) {
    super(undefined, { meta });
  }

  protected evaluate(candidate: number): boolean {
    return candidate === this.value;
  }
}

class AsyncSpec extends BaseSpec<number> {
  constructor(private value: number, meta?: SpecMeta) {
    super(undefined, { meta });
  }

  protected async evaluate(candidate: number): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 1));
    return candidate === this.value;
  }
}

describe("BaseSpec", () => {
  describe("Metadata", () => {
    it("stores metadata in constructor", () => {
      const meta: SpecMeta = {
        name: "test-spec",
        tags: ["test"],
        version: "1.0.0"
      };

      const spec = new TestSpec(42, meta);
      expect(spec.meta).toMatchObject(meta);
      expect(spec.name).toBe("test-spec");
    });

    it("generates unique IDs", () => {
      const spec1 = new TestSpec(42);
      const spec2 = new TestSpec(43);
      
      expect(spec1.id).toBeDefined();
      expect(spec2.id).toBeDefined();
      expect(spec1.id).not.toBe(spec2.id);
    });

    it("uses provided ID from meta", () => {
      const spec = new TestSpec(42, { id: "custom-id" });
      expect(spec.id).toBe("custom-id");
    });

    it("modifies metadata with withMeta", () => {
      const spec = new TestSpec(42);
      const updated = withMeta(spec, { name: "updated", tags: ["new"] });
      
      expect(updated.name).toBe("updated");
      if (updated instanceof BaseSpec) {
        expect(updated.meta?.tags).toContain("new");
      }
    });
  });

  describe("Logical combinators", () => {
    it("creates and combinator", async () => {
      const spec1 = new TestSpec(42);
      const spec2 = new TestSpec(42);
      const combined = spec1.and(spec2);

      expect(await combined.isSatisfiedByAsync!(42)).toBe(true);
      expect(await combined.isSatisfiedByAsync!(43)).toBe(false);
    });

    it("creates or combinator", async () => {
      const spec1 = new TestSpec(42);
      const spec2 = new TestSpec(43);
      const combined = spec1.or(spec2);

      expect(await combined.isSatisfiedByAsync!(42)).toBe(true);
      expect(await combined.isSatisfiedByAsync!(43)).toBe(true);
      expect(await combined.isSatisfiedByAsync!(44)).toBe(false);
    });

    it("creates not combinator", async () => {
      const spec = new TestSpec(42);
      const negated = spec.not();

      expect(await negated.isSatisfiedByAsync!(42)).toBe(false);
      expect(await negated.isSatisfiedByAsync!(43)).toBe(true);
    });

    it("chains multiple combinators", async () => {
      const spec1 = new TestSpec(42);
      const spec2 = new TestSpec(42);
      const spec3 = new TestSpec(43);
      
      const complex = spec1.and(spec2).or(spec3);
      
      expect(await complex.isSatisfiedByAsync!(42)).toBe(true);
      expect(await complex.isSatisfiedByAsync!(43)).toBe(true);
      expect(await complex.isSatisfiedByAsync!(44)).toBe(false);
    });
  });

  describe("Async evaluation", () => {
    it("handles async specifications", async () => {
      const spec = new AsyncSpec(42);
      expect(await spec.isSatisfiedByAsync!(42)).toBe(true);
      expect(await spec.isSatisfiedByAsync!(43)).toBe(false);
    });

    it("evaluates sync specifications async", async () => {
      const spec = new TestSpec(42);
      expect(await spec.isSatisfiedByAsync!(42)).toBe(true);
    });

    it("handles async in combinators", async () => {
      const spec1 = new AsyncSpec(42);
      const spec2 = new AsyncSpec(42);
      const combined = spec1.and(spec2);

      expect(await combined.isSatisfiedByAsync!(42)).toBe(true);
    });
  });

  describe("Evaluation methods", () => {
    it("evaluates sync specification", () => {
      const spec = new TestSpec(42);
      expect(spec.isSatisfiedBy(42)).toBe(true);
      expect(spec.isSatisfiedBy(43)).toBe(false);
    });

    it("evaluates async specification", async () => {
      const spec = new TestSpec(42);
      expect(await spec.isSatisfiedByAsync!(42)).toBe(true);
      expect(await spec.isSatisfiedByAsync!(43)).toBe(false);
    });

    it("handles async evaluation correctly", async () => {
      const spec = new AsyncSpec(42);
      expect(await spec.isSatisfiedByAsync!(42)).toBe(true);
      expect(await spec.isSatisfiedByAsync!(43)).toBe(false);
    });
  });

  describe("Explain functionality", () => {
    it("explains sync specifications", () => {
      const spec = new TestSpec(42, { name: "equalTo42" });
      const node = spec.explain(42);
      
      expect(node.id).toBeDefined();
      expect(node.name).toBe("equalTo42");
      expect(node.pass).toBe(true);
    });

    it("explains failed specifications", () => {
      const spec = new TestSpec(42, { name: "equalTo42" });
      const node = spec.explain(43);
      
      expect(node.pass).toBe(false);
    });

    it("shows unknown for async specs in sync explain", () => {
      const spec = new AsyncSpec(42, { name: "asyncCheck" });
      const node = spec.explain(42);
      
      expect(node.pass).toBe("unknown");
      expect(node.reason).toContain("Asynchronous evaluation");
    });
  });

  describe("Complex scenarios", () => {
    it("handles deeply nested combinators", async () => {
      const s1 = new TestSpec(1);
      const s2 = new TestSpec(2);
      const s3 = new TestSpec(3);
      const s4 = new TestSpec(4);

      const complex = s1.or(s2).and(s3.or(s4).not());

      expect(await complex.isSatisfiedByAsync!(1)).toBe(true);
      expect(await complex.isSatisfiedByAsync!(3)).toBe(false);
    });

    it("explains complex specifications", () => {
      const spec1 = new TestSpec(42, { name: "first" });
      const spec2 = new TestSpec(43, { name: "second" });
      const combined = spec1.or(spec2);
      
      const node = combined.explain(42);
      expect(node.pass).toBe(true);
      expect(node.children).toBeDefined();
      expect(node.children?.length).toBe(2);
    });
  });
});
