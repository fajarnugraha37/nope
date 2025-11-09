/**
 * Baseline benchmark for memoization key generation
 * Tests JSON.stringify performance with different argument patterns
 */

console.log("\n=== Memoization Key Generation - BASELINE ===\n");

// Current implementation
const defaultKeyer = (args: any[]) => {
  try {
    return JSON.stringify(args);
  } catch {
    return String(args[0]);
  }
};

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

console.log("📊 PRIMITIVE ARGUMENTS\n");

// Single number
const singleNumber = benchmark("Single number", () => {
  defaultKeyer([42]);
});
console.log(`   Single number:        ${singleNumber.toFixed(2)}ms (${(100_000 / singleNumber * 1000).toFixed(0)} ops/sec)`);

// Single string
const singleString = benchmark("Single string", () => {
  defaultKeyer(["user:123"]);
});
console.log(`   Single string:        ${singleString.toFixed(2)}ms (${(100_000 / singleString * 1000).toFixed(0)} ops/sec)`);

// Two numbers
const twoNumbers = benchmark("Two numbers", () => {
  defaultKeyer([42, 100]);
});
console.log(`   Two numbers:          ${twoNumbers.toFixed(2)}ms (${(100_000 / twoNumbers * 1000).toFixed(0)} ops/sec)`);

// Multiple primitives
const multiPrimitive = benchmark("Multiple primitives", () => {
  defaultKeyer([42, "test", true, null]);
});
console.log(`   Multiple primitives:  ${multiPrimitive.toFixed(2)}ms (${(100_000 / multiPrimitive * 1000).toFixed(0)} ops/sec)\n`);

console.log("📊 OBJECT ARGUMENTS\n");

const simpleObject = { id: 123, name: "test" };
const objSimple = benchmark("Simple object", () => {
  defaultKeyer([simpleObject]);
});
console.log(`   Simple object:        ${objSimple.toFixed(2)}ms (${(100_000 / objSimple * 1000).toFixed(0)} ops/sec)`);

const nestedObject = {
  user: { id: 123, profile: { name: "Alice", email: "alice@example.com" } },
  settings: { theme: "dark", notifications: true }
};
const objNested = benchmark("Nested object", () => {
  defaultKeyer([nestedObject]);
});
console.log(`   Nested object:        ${objNested.toFixed(2)}ms (${(100_000 / objNested * 1000).toFixed(0)} ops/sec)`);

const objectWithArray = {
  items: [1, 2, 3, 4, 5],
  metadata: { count: 5, total: 15 }
};
const objArray = benchmark("Object with array", () => {
  defaultKeyer([objectWithArray]);
});
console.log(`   Object with array:    ${objArray.toFixed(2)}ms (${(100_000 / objArray * 1000).toFixed(0)} ops/sec)\n`);

console.log("📊 ARRAY ARGUMENTS\n");

const smallArray = [1, 2, 3, 4, 5];
const arrSmall = benchmark("Small array", () => {
  defaultKeyer([smallArray]);
});
console.log(`   Small array (5):      ${arrSmall.toFixed(2)}ms (${(100_000 / arrSmall * 1000).toFixed(0)} ops/sec)`);

const mediumArray = Array.from({ length: 50 }, (_, i) => i);
const arrMedium = benchmark("Medium array", () => {
  defaultKeyer([mediumArray]);
});
console.log(`   Medium array (50):    ${arrMedium.toFixed(2)}ms (${(100_000 / arrMedium * 1000).toFixed(0)} ops/sec)`);

const largeArray = Array.from({ length: 500 }, (_, i) => i);
const arrLarge = benchmark("Large array", () => {
  defaultKeyer([largeArray]);
});
console.log(`   Large array (500):    ${arrLarge.toFixed(2)}ms (${(100_000 / arrLarge * 1000).toFixed(0)} ops/sec)\n`);

console.log("📊 MIXED ARGUMENTS\n");

const mixedSimple = benchmark("Number + string", () => {
  defaultKeyer([123, "user"]);
});
console.log(`   Number + string:      ${mixedSimple.toFixed(2)}ms (${(100_000 / mixedSimple * 1000).toFixed(0)} ops/sec)`);

const mixedComplex = benchmark("Multiple types", () => {
  defaultKeyer([123, "user", { id: 456 }, [1, 2, 3]]);
});
console.log(`   Multiple types:       ${mixedComplex.toFixed(2)}ms (${(100_000 / mixedComplex * 1000).toFixed(0)} ops/sec)\n`);

console.log("📊 REAL-WORLD PATTERNS\n");

// Common API call pattern: (id: string)
const apiPattern1 = benchmark("API: getUserById(id)", () => {
  defaultKeyer(["user123"]);
});
console.log(`   getUserById(id):      ${apiPattern1.toFixed(2)}ms (${(100_000 / apiPattern1 * 1000).toFixed(0)} ops/sec)`);

// Common API call pattern: (id: number, options: object)
const apiPattern2 = benchmark("API: fetchData(id, opts)", () => {
  defaultKeyer([123, { limit: 10, offset: 0 }]);
});
console.log(`   fetchData(id, opts):  ${apiPattern2.toFixed(2)}ms (${(100_000 / apiPattern2 * 1000).toFixed(0)} ops/sec)`);

// Complex computation pattern: (arr: number[], opts: object)
const computePattern = benchmark("Compute: process(arr, opts)", () => {
  defaultKeyer([[1, 2, 3, 4, 5], { mode: "sum", precision: 2 }]);
});
console.log(`   process(arr, opts):   ${computePattern.toFixed(2)}ms (${(100_000 / computePattern * 1000).toFixed(0)} ops/sec)\n`);

console.log("=".repeat(70));
console.log("📈 BASELINE SUMMARY");
console.log("=".repeat(70) + "\n");

const avgPrimitive = (singleNumber + singleString + twoNumbers + multiPrimitive) / 4;
const avgObject = (objSimple + objNested + objArray) / 3;
const avgArray = (arrSmall + arrMedium + arrLarge) / 3;

console.log(`Average Times:`);
console.log(`  • Primitives:    ${avgPrimitive.toFixed(2)}ms (${(100_000 / avgPrimitive * 1000).toFixed(0)} ops/sec)`);
console.log(`  • Objects:       ${avgObject.toFixed(2)}ms (${(100_000 / avgObject * 1000).toFixed(0)} ops/sec)`);
console.log(`  • Arrays:        ${avgArray.toFixed(2)}ms (${(100_000 / avgArray * 1000).toFixed(0)} ops/sec)\n`);

console.log("Hotspots (slowest operations):");
const results = [
  { name: "Nested object", time: objNested },
  { name: "Large array (500)", time: arrLarge },
  { name: "Medium array (50)", time: arrMedium },
  { name: "Object with array", time: objArray },
  { name: "Multiple types", time: mixedComplex }
].sort((a, b) => b.time - a.time);

results.slice(0, 3).forEach((r, i) => {
  console.log(`  ${i + 1}. ${r.name}: ${r.time.toFixed(2)}ms`);
});

console.log("\n=== Baseline Benchmark Complete ===\n");
