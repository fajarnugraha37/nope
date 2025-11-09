/**
 * Comparison benchmark: Original vs Optimized key generation
 */

import { fastKeyer, originalKeyer, weakMapKeyer } from "../src/fast-keyer.ts";

console.log("\n=== Key Generation Optimization - COMPARISON ===\n");

function benchmark(name: string, fn: () => void, iterations: number = 100_000): number {
  // Warmup
  for (let i = 0; i < 1000; i++) fn();
  
  const times: number[] = [];
  for (let run = 0; run < 10; run++) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      fn();
    }
    const end = performance.now();
    times.push(end - start);
  }
  
  // Remove outliers
  times.sort((a, b) => a - b);
  const trimmed = times.slice(1, 9);
  return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
}

function compare(name: string, args: any[]): void {
  const original = benchmark(`Original: ${name}`, () => originalKeyer(args));
  const fast = benchmark(`Fast: ${name}`, () => fastKeyer(args));
  const improvement = ((original / fast - 1) * 100).toFixed(1);
  const speedup = (original / fast).toFixed(2);
  
  console.log(`   ${name}`);
  console.log(`     Original:  ${original.toFixed(2)}ms (${(100_000 / original * 1000).toFixed(0)} ops/sec)`);
  console.log(`     Fast:      ${fast.toFixed(2)}ms (${(100_000 / fast * 1000).toFixed(0)} ops/sec)`);
  console.log(`     ⚡ ${speedup}x faster (+${improvement}% improvement)\n`);
}

console.log("📊 PRIMITIVE ARGUMENTS\n");

compare("Single number", [42]);
compare("Single string", ["user:123"]);
compare("Two numbers", [42, 100]);
compare("Multiple primitives", [42, "test", true, null]);

console.log("📊 OBJECT ARGUMENTS\n");

const simpleObject = { id: 123, name: "test" };
compare("Simple object", [simpleObject]);

const nestedObject = {
  user: { id: 123, profile: { name: "Alice", email: "alice@example.com" } },
  settings: { theme: "dark", notifications: true }
};
compare("Nested object", [nestedObject]);

const objectWithArray = {
  items: [1, 2, 3, 4, 5],
  metadata: { count: 5, total: 15 }
};
compare("Object with array", [objectWithArray]);

console.log("📊 ARRAY ARGUMENTS\n");

compare("Small array (5)", [[1, 2, 3, 4, 5]]);
compare("Medium array (50)", [Array.from({ length: 50 }, (_, i) => i)]);
compare("Large array (500)", [Array.from({ length: 500 }, (_, i) => i)]);

console.log("📊 MIXED ARGUMENTS\n");

compare("Number + string", [123, "user"]);
compare("Multiple types", [123, "user", { id: 456 }, [1, 2, 3]]);

console.log("📊 REAL-WORLD PATTERNS\n");

compare("getUserById(id)", ["user123"]);
compare("fetchData(id, opts)", [123, { limit: 10, offset: 0 }]);
compare("process(arr, opts)", [[1, 2, 3, 4, 5], { mode: "sum", precision: 2 }]);

console.log("=".repeat(70));
console.log("📈 OPTIMIZATION SUMMARY");
console.log("=".repeat(70) + "\n");

// Run comprehensive summary benchmark
const patterns = [
  { name: "Single primitive", args: [42], category: "primitives" },
  { name: "Two primitives", args: [42, "test"], category: "primitives" },
  { name: "Multiple primitives", args: [1, 2, 3, 4, 5], category: "primitives" },
  { name: "Simple object", args: [{ id: 123 }], category: "objects" },
  { name: "Complex object", args: [nestedObject], category: "objects" },
  { name: "Small array", args: [[1, 2, 3, 4, 5]], category: "arrays" },
  { name: "Medium array", args: [Array.from({ length: 50 }, (_, i) => i)], category: "arrays" },
  { name: "Large array", args: [Array.from({ length: 500 }, (_, i) => i)], category: "arrays" },
];

const results: { category: string; original: number; fast: number; speedup: number }[] = [];

patterns.forEach(({ args, category }) => {
  const original = benchmark("", () => originalKeyer(args));
  const fast = benchmark("", () => fastKeyer(args));
  results.push({ category, original, fast, speedup: original / fast });
});

// Calculate category averages
const categories = ["primitives", "objects", "arrays"];
categories.forEach(cat => {
  const filtered = results.filter(r => r.category === cat);
  const avgOriginal = filtered.reduce((sum, r) => sum + r.original, 0) / filtered.length;
  const avgFast = filtered.reduce((sum, r) => sum + r.fast, 0) / filtered.length;
  const avgSpeedup = avgOriginal / avgFast;
  
  console.log(`${cat.toUpperCase()}:`);
  console.log(`  Original: ${avgOriginal.toFixed(2)}ms avg`);
  console.log(`  Fast:     ${avgFast.toFixed(2)}ms avg`);
  console.log(`  ⚡ ${avgSpeedup.toFixed(2)}x faster\n`);
});

// Overall average
const overallOriginal = results.reduce((sum, r) => sum + r.original, 0) / results.length;
const overallFast = results.reduce((sum, r) => sum + r.fast, 0) / results.length;
const overallSpeedup = overallOriginal / overallFast;

console.log(`OVERALL AVERAGE:`);
console.log(`  Original: ${overallOriginal.toFixed(2)}ms`);
console.log(`  Fast:     ${overallFast.toFixed(2)}ms`);
console.log(`  ⚡ ${overallSpeedup.toFixed(2)}x faster (+${((overallSpeedup - 1) * 100).toFixed(1)}% improvement)\n`);

console.log("=== Comparison Benchmark Complete ===\n");
