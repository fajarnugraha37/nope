/**
 * Benchmark: Object identity (WeakMap) vs JSON serialization
 * Tests whether using object references is faster than content serialization
 */

console.log("\n=== Object Identity vs Serialization Benchmark ===\n");

// Strategy 1: JSON.stringify (current)
function jsonKeyer(obj: any): string {
  try {
    return JSON.stringify(obj);
  } catch {
    return String(obj);
  }
}

// Strategy 2: WeakMap with object identity
const objectMap = new WeakMap<object, number>();
let nextId = 1;

function identityKeyer(obj: any): string {
  if (typeof obj !== "object" || obj === null) {
    return String(obj);
  }
  
  let id = objectMap.get(obj);
  if (id === undefined) {
    id = nextId++;
    objectMap.set(obj, id);
  }
  return `obj:${id}`;
}

// Strategy 3: Simple hash code
function hashKeyer(obj: any): string {
  if (typeof obj !== "object" || obj === null) {
    return String(obj);
  }
  
  let hash = 0;
  const str = JSON.stringify(obj);
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return `h:${hash}`;
}

// Strategy 4: Memory address simulation (not available in JS, use object.toString())
function addressKeyer(obj: any): string {
  if (typeof obj !== "object" || obj === null) {
    return String(obj);
  }
  return obj.toString(); // Returns "[object Object]" or similar
}

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
  
  times.sort((a, b) => a - b);
  const trimmed = times.slice(1, 9);
  return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
}

console.log("📊 SIMPLE OBJECT\n");

const simpleObj = { id: 123, name: "test", active: true };

const jsonSimple = benchmark("JSON.stringify", () => {
  jsonKeyer(simpleObj);
});
console.log(`   JSON.stringify:    ${jsonSimple.toFixed(2)}ms (${(100_000 / jsonSimple * 1000).toFixed(0)} ops/sec)`);

const identitySimple = benchmark("WeakMap identity", () => {
  identityKeyer(simpleObj);
});
console.log(`   WeakMap identity:  ${identitySimple.toFixed(2)}ms (${(100_000 / identitySimple * 1000).toFixed(0)} ops/sec)`);

const hashSimple = benchmark("Hash code", () => {
  hashKeyer(simpleObj);
});
console.log(`   Hash code:         ${hashSimple.toFixed(2)}ms (${(100_000 / hashSimple * 1000).toFixed(0)} ops/sec)`);

const speedupIdentity = (jsonSimple / identitySimple).toFixed(2);
const speedupHash = (jsonSimple / hashSimple).toFixed(2);
console.log(`\n   ⚡ Identity: ${speedupIdentity}x vs JSON`);
console.log(`   ⚡ Hash:     ${speedupHash}x vs JSON\n`);

console.log("📊 NESTED OBJECT\n");

const nestedObj = {
  user: { id: 123, profile: { name: "Alice", email: "alice@example.com" } },
  settings: { theme: "dark", notifications: true }
};

const jsonNested = benchmark("JSON.stringify", () => {
  jsonKeyer(nestedObj);
});
console.log(`   JSON.stringify:    ${jsonNested.toFixed(2)}ms (${(100_000 / jsonNested * 1000).toFixed(0)} ops/sec)`);

const identityNested = benchmark("WeakMap identity", () => {
  identityKeyer(nestedObj);
});
console.log(`   WeakMap identity:  ${identityNested.toFixed(2)}ms (${(100_000 / identityNested * 1000).toFixed(0)} ops/sec)`);

const hashNested = benchmark("Hash code", () => {
  hashKeyer(nestedObj);
});
console.log(`   Hash code:         ${hashNested.toFixed(2)}ms (${(100_000 / hashNested * 1000).toFixed(0)} ops/sec)`);

const speedupIdentityNested = (jsonNested / identityNested).toFixed(2);
const speedupHashNested = (jsonNested / hashNested).toFixed(2);
console.log(`\n   ⚡ Identity: ${speedupIdentityNested}x vs JSON`);
console.log(`   ⚡ Hash:     ${speedupHashNested}x vs JSON\n`);

console.log("📊 ARRAY (50 elements)\n");

const arrayTest = Array.from({ length: 50 }, (_, i) => i);

const jsonArray = benchmark("JSON.stringify", () => {
  jsonKeyer(arrayTest);
});
console.log(`   JSON.stringify:    ${jsonArray.toFixed(2)}ms (${(100_000 / jsonArray * 1000).toFixed(0)} ops/sec)`);

const identityArray = benchmark("WeakMap identity", () => {
  identityKeyer(arrayTest);
});
console.log(`   WeakMap identity:  ${identityArray.toFixed(2)}ms (${(100_000 / identityArray * 1000).toFixed(0)} ops/sec)`);

const hashArray = benchmark("Hash code", () => {
  hashKeyer(arrayTest);
});
console.log(`   Hash code:         ${hashArray.toFixed(2)}ms (${(100_000 / hashArray * 1000).toFixed(0)} ops/sec)`);

const speedupIdentityArray = (jsonArray / identityArray).toFixed(2);
const speedupHashArray = (jsonArray / hashArray).toFixed(2);
console.log(`\n   ⚡ Identity: ${speedupIdentityArray}x vs JSON`);
console.log(`   ⚡ Hash:     ${speedupHashArray}x vs JSON\n`);

console.log("📊 CRITICAL TEST: Different Objects with Same Content\n");

// This is the KEY test - do we want content equality or reference equality?
const obj1 = { id: 1, name: "test" };
const obj2 = { id: 1, name: "test" }; // Same content, different reference

console.log("Testing cache behavior:");
console.log(`   obj1 JSON key:     "${jsonKeyer(obj1)}"`);
console.log(`   obj2 JSON key:     "${jsonKeyer(obj2)}"`);
console.log(`   Keys match:        ${jsonKeyer(obj1) === jsonKeyer(obj2)} ✅ (content equality)\n`);

console.log(`   obj1 identity key: "${identityKeyer(obj1)}"`);
console.log(`   obj2 identity key: "${identityKeyer(obj2)}"`);
console.log(`   Keys match:        ${identityKeyer(obj1) === identityKeyer(obj2)} ❌ (reference equality)\n`);

console.log(`   obj1 hash key:     "${hashKeyer(obj1)}"`);
console.log(`   obj2 hash key:     "${hashKeyer(obj2)}"`);
console.log(`   Keys match:        ${hashKeyer(obj1) === hashKeyer(obj2)} ✅ (content equality)\n`);

console.log("=".repeat(70));
console.log("📈 SUMMARY");
console.log("=".repeat(70) + "\n");

console.log("Performance Comparison:");
console.log(`  Simple Object:`);
console.log(`    • JSON:     ${jsonSimple.toFixed(2)}ms (baseline)`);
console.log(`    • Identity: ${identitySimple.toFixed(2)}ms (${speedupIdentity}x ${parseFloat(speedupIdentity) > 1 ? 'faster ⚡' : 'slower ❌'})`);
console.log(`    • Hash:     ${hashSimple.toFixed(2)}ms (${speedupHash}x ${parseFloat(speedupHash) > 1 ? 'faster ⚡' : 'slower ❌'})\n`);

console.log(`  Nested Object:`);
console.log(`    • JSON:     ${jsonNested.toFixed(2)}ms (baseline)`);
console.log(`    • Identity: ${identityNested.toFixed(2)}ms (${speedupIdentityNested}x ${parseFloat(speedupIdentityNested) > 1 ? 'faster ⚡' : 'slower ❌'})`);
console.log(`    • Hash:     ${hashNested.toFixed(2)}ms (${speedupHashNested}x ${parseFloat(speedupHashNested) > 1 ? 'faster ⚡' : 'slower ❌'})\n`);

console.log(`  Array (50 elements):`);
console.log(`    • JSON:     ${jsonArray.toFixed(2)}ms (baseline)`);
console.log(`    • Identity: ${identityArray.toFixed(2)}ms (${speedupIdentityArray}x ${parseFloat(speedupIdentityArray) > 1 ? 'faster ⚡' : 'slower ❌'})`);
console.log(`    • Hash:     ${hashArray.toFixed(2)}ms (${speedupHashArray}x ${parseFloat(speedupHashArray) > 1 ? 'faster ⚡' : 'slower ❌'})\n`);

console.log("Key Insights:");
console.log(`  ✅ WeakMap identity is fastest (${speedupIdentityNested}x for nested objects)`);
console.log(`  ❌ Hash code is slowest (still needs JSON.stringify!)`);
console.log(`  ⚠️  Identity uses REFERENCE equality (not content equality)`);
console.log(`  ⚠️  JSON uses CONTENT equality (cache hits for equivalent objects)\n`);

console.log("Trade-offs:");
console.log(`  WeakMap Identity:`);
console.log(`    ✅ Fastest: ~${speedupIdentityNested}x faster`);
console.log(`    ❌ Different semantics: obj1 !== obj2 even if identical`);
console.log(`    ❌ Cache misses for equivalent objects`);
console.log(`    ❌ No cross-process/serialization support\n`);

console.log(`  JSON Stringify:`);
console.log(`    ✅ Content equality: obj1 === obj2 if same content`);
console.log(`    ✅ Predictable caching behavior`);
console.log(`    ✅ Serializable keys`);
console.log(`    ❌ Slower for complex objects\n`);

console.log("Recommendation:");
console.log(`  • Keep JSON.stringify for DEFAULT behavior (content equality)`);
console.log(`  • Add OPTIONAL WeakMap keyer for advanced users`);
console.log(`  • Let users choose based on their use case\n`);

console.log("=== Benchmark Complete ===\n");
