import { describe, expect, it } from "bun:test";
import { spec } from "../src/dsl/spec-builder";

interface Product {
  name: string;
  price: number;
  stock: number;
  category: string;
  tags: string[];
  metadata?: {
    rating?: number;
    reviews?: number;
  };
}

describe("DSL Spec Builder", () => {
  describe("Basic field operations", () => {
    it("creates eq specification", async () => {
      const eqSpec = spec.field<Product>("category").eq("electronics");
      expect(await eqSpec.isSatisfiedByAsync!({ category: "electronics" } as Product)).toBe(true);
      expect(await eqSpec.isSatisfiedByAsync!({ category: "books" } as Product)).toBe(false);
    });

    it("creates ne specification", async () => {
      const neSpec = spec.field<Product>("category").ne("electronics");
      expect(await neSpec.isSatisfiedByAsync!({ category: "books" } as Product)).toBe(true);
      expect(await neSpec.isSatisfiedByAsync!({ category: "electronics" } as Product)).toBe(false);
    });

    it("creates lt specification", async () => {
      const ltSpec = spec.field<Product>("price").lt(100);
      expect(await ltSpec.isSatisfiedByAsync!({ price: 50 } as Product)).toBe(true);
      expect(await ltSpec.isSatisfiedByAsync!({ price: 150 } as Product)).toBe(false);
    });

    it("creates lte specification", async () => {
      const lteSpec = spec.field<Product>("price").lte(100);
      expect(await lteSpec.isSatisfiedByAsync!({ price: 100 } as Product)).toBe(true);
      expect(await lteSpec.isSatisfiedByAsync!({ price: 50 } as Product)).toBe(true);
      expect(await lteSpec.isSatisfiedByAsync!({ price: 150 } as Product)).toBe(false);
    });

    it("creates gt specification", async () => {
      const gtSpec = spec.field<Product>("price").gt(100);
      expect(await gtSpec.isSatisfiedByAsync!({ price: 150 } as Product)).toBe(true);
      expect(await gtSpec.isSatisfiedByAsync!({ price: 50 } as Product)).toBe(false);
    });

    it("creates gte specification", async () => {
      const gteSpec = spec.field<Product>("price").gte(100);
      expect(await gteSpec.isSatisfiedByAsync!({ price: 100 } as Product)).toBe(true);
      expect(await gteSpec.isSatisfiedByAsync!({ price: 150 } as Product)).toBe(true);
      expect(await gteSpec.isSatisfiedByAsync!({ price: 50 } as Product)).toBe(false);
    });

    it("creates in specification", async () => {
      const inSpec = spec.field<Product>("category").in(["electronics", "books"]);
      expect(await inSpec.isSatisfiedByAsync!({ category: "electronics" } as Product)).toBe(true);
      expect(await inSpec.isSatisfiedByAsync!({ category: "books" } as Product)).toBe(true);
      expect(await inSpec.isSatisfiedByAsync!({ category: "toys" } as Product)).toBe(false);
    });

    it("creates notIn specification", async () => {
      const notInSpec = spec.field<Product>("category").notIn(["electronics", "books"]);
      expect(await notInSpec.isSatisfiedByAsync!({ category: "toys" } as Product)).toBe(true);
      expect(await notInSpec.isSatisfiedByAsync!({ category: "electronics" } as Product)).toBe(false);
    });

    it("creates exists specification", async () => {
      const existsSpec = spec.field<Product>("metadata").exists();
      expect(await existsSpec.isSatisfiedByAsync!({ metadata: { rating: 5 } } as Product)).toBe(true);
      expect(await existsSpec.isSatisfiedByAsync!({ metadata: undefined } as Product)).toBe(false);
    });

    it("creates missing specification", async () => {
      const missingSpec = spec.field<Product>("metadata").missing();
      expect(await missingSpec.isSatisfiedByAsync!({ metadata: undefined } as Product)).toBe(true);
      expect(await missingSpec.isSatisfiedByAsync!({ metadata: { rating: 5 } } as Product)).toBe(false);
    });
  });

  describe("String operations", () => {
    it("creates regex specification", async () => {
      const regexSpec = spec.field<Product>("name").regex("^Pro");
      expect(await regexSpec.isSatisfiedByAsync!({ name: "Product A" } as Product)).toBe(true);
      expect(await regexSpec.isSatisfiedByAsync!({ name: "Item B" } as Product)).toBe(false);
    });

    it("creates startsWith specification", async () => {
      const startsSpec = spec.field<Product>("name").startsWith("Pro");
      expect(await startsSpec.isSatisfiedByAsync!({ name: "Product A" } as Product)).toBe(true);
      expect(await startsSpec.isSatisfiedByAsync!({ name: "Item B" } as Product)).toBe(false);
    });

    it("creates endsWith specification", async () => {
      const endsSpec = spec.field<Product>("name").endsWith("A");
      expect(await endsSpec.isSatisfiedByAsync!({ name: "Product A" } as Product)).toBe(true);
      expect(await endsSpec.isSatisfiedByAsync!({ name: "Product B" } as Product)).toBe(false);
    });

    it("creates contains specification", async () => {
      const containsSpec = spec.field<Product>("tags").contains("sale");
      expect(await containsSpec.isSatisfiedByAsync!({ tags: ["new", "sale", "featured"] } as Product)).toBe(true);
      expect(await containsSpec.isSatisfiedByAsync!({ tags: ["new", "featured"] } as Product)).toBe(false);
    });
  });

  describe("Combinators", () => {
    it("chains with and", async () => {
      const combined = spec
        .field<Product>("price").gte(50)
        .and(spec.field<Product>("stock").gt(0));
      
      expect(await combined.isSatisfiedByAsync!({ price: 100, stock: 10 } as Product)).toBe(true);
      expect(await combined.isSatisfiedByAsync!({ price: 100, stock: 0 } as Product)).toBe(false);
      expect(await combined.isSatisfiedByAsync!({ price: 30, stock: 10 } as Product)).toBe(false);
    });

    it("chains with or", async () => {
      const combined = spec
        .field<Product>("price").lt(50)
        .or(spec.field<Product>("category").eq("clearance"));
      
      expect(await combined.isSatisfiedByAsync!({ price: 30, category: "books" } as Product)).toBe(true);
      expect(await combined.isSatisfiedByAsync!({ price: 100, category: "clearance" } as Product)).toBe(true);
      expect(await combined.isSatisfiedByAsync!({ price: 100, category: "books" } as Product)).toBe(false);
    });

    it("chains with not", async () => {
      const notSpec = spec.field<Product>("category").eq("electronics").not();
      expect(await notSpec.isSatisfiedByAsync!({ category: "books" } as Product)).toBe(true);
      expect(await notSpec.isSatisfiedByAsync!({ category: "electronics" } as Product)).toBe(false);
    });

    it("creates complex chained specifications", async () => {
      const complex = spec
        .field<Product>("price").gte(50)
        .and(spec.field<Product>("price").lte(200))
        .and(spec.field<Product>("stock").gt(0))
        .or(spec.field<Product>("category").eq("clearance"));
      
      expect(await complex.isSatisfiedByAsync!({ price: 100, stock: 5, category: "books" } as Product)).toBe(true);
      expect(await complex.isSatisfiedByAsync!({ price: 300, stock: 0, category: "clearance" } as Product)).toBe(true);
      expect(await complex.isSatisfiedByAsync!({ price: 300, stock: 0, category: "books" } as Product)).toBe(false);
    });
  });

  describe("Nested field paths", () => {
    it("handles nested field paths", async () => {
      const nestedSpec = spec.field<any>("metadata.rating").gte(4);
      expect(await nestedSpec.isSatisfiedByAsync!({ metadata: { rating: 5 } } as Product)).toBe(true);
      expect(await nestedSpec.isSatisfiedByAsync!({ metadata: { rating: 3 } } as Product)).toBe(false);
    });
  });

  describe("Multiple specifications", () => {
    it("combines multiple independent specs", async () => {
      const inStock = spec.field<Product>("stock").gt(0);
      const affordable = spec.field<Product>("price").lt(100);
      const electronics = spec.field<Product>("category").eq("electronics");
      
      const combined = inStock.and(affordable).and(electronics);
      
      expect(await combined.isSatisfiedByAsync!({
        stock: 10,
        price: 50,
        category: "electronics"
      } as Product)).toBe(true);
      
      expect(await combined.isSatisfiedByAsync!({
        stock: 0,
        price: 50,
        category: "electronics"
      } as Product)).toBe(false);
    });
  });
});
