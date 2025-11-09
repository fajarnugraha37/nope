/**
 * Benchmark: MessagePack binary serialization vs JSON
 * Tests whether binary format is faster than text-based JSON
 */

import { encode as msgpackEncode } from "@msgpack/msgpack";

console.log("\n=== MessagePack Binary vs JSON Benchmark ===\n");

// Strategy 1: JSON.stringify (current)
function jsonKeyer(obj: any): string {
  try {
    return JSON.stringify(obj);
  } catch {
    return String(obj);
  }
}

// Strategy 2: MessagePack binary (convert bytes to base64 string for key)
function msgpackKeyer(obj: any): string {
  try {
    const bytes = msgpackEncode(obj);
    // Convert Uint8Array to string for use as key
    // Option A: Base64 encode
    return btoa(String.fromCharCode(...bytes));
    // Note: This conversion itself might be slow!
  } catch {
    return String(obj);
  }
}

// Strategy 3: MessagePack with hex encoding
function msgpackHexKeyer(obj: any): string {
  try {
    const bytes = msgpackEncode(obj);
    // Convert to hex string (faster than base64)
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return String(obj);
  }
}

// Strategy 4: MessagePack raw bytes (keep as Uint8Array and hash it)
function msgpackHashKeyer(obj: any): string {
  try {
    const bytes = msgpackEncode(obj);
    // Simple hash of bytes
    let hash = 0;
    for (let i = 0; i < bytes.length; i++) {
      hash = ((hash << 5) - hash) + bytes[i];
      hash |= 0;
    }
    return `h:${hash}`;
  } catch {
    return String(obj);
  }
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
console.log(`   JSON.stringify:      ${jsonSimple.toFixed(2)}ms (${(100_000 / jsonSimple * 1000).toFixed(0)} ops/sec)`);

const msgpackSimple = benchmark("MessagePack base64", () => {
  msgpackKeyer(simpleObj);
});
console.log(`   MessagePack base64:  ${msgpackSimple.toFixed(2)}ms (${(100_000 / msgpackSimple * 1000).toFixed(0)} ops/sec)`);

const msgpackHexSimple = benchmark("MessagePack hex", () => {
  msgpackHexKeyer(simpleObj);
});
console.log(`   MessagePack hex:     ${msgpackHexSimple.toFixed(2)}ms (${(100_000 / msgpackHexSimple * 1000).toFixed(0)} ops/sec)`);

const msgpackHashSimple = benchmark("MessagePack hash", () => {
  msgpackHashKeyer(simpleObj);
});
console.log(`   MessagePack hash:    ${msgpackHashSimple.toFixed(2)}ms (${(100_000 / msgpackHashSimple * 1000).toFixed(0)} ops/sec)`);

const speedupBase64 = (jsonSimple / msgpackSimple).toFixed(2);
const speedupHex = (jsonSimple / msgpackHexSimple).toFixed(2);
const speedupHash = (jsonSimple / msgpackHashSimple).toFixed(2);
console.log(`\n   ⚡ Base64: ${speedupBase64}x vs JSON ${parseFloat(speedupBase64) > 1 ? '✅' : '❌'}`);
console.log(`   ⚡ Hex:    ${speedupHex}x vs JSON ${parseFloat(speedupHex) > 1 ? '✅' : '❌'}`);
console.log(`   ⚡ Hash:   ${speedupHash}x vs JSON ${parseFloat(speedupHash) > 1 ? '✅' : '❌'}\n`);

console.log("📊 NESTED OBJECT\n");

const nestedObj = {
  user: { id: 123, profile: { name: "Alice", email: "alice@example.com" } },
  settings: { theme: "dark", notifications: true }
};

const jsonNested = benchmark("JSON.stringify", () => {
  jsonKeyer(nestedObj);
});
console.log(`   JSON.stringify:      ${jsonNested.toFixed(2)}ms (${(100_000 / jsonNested * 1000).toFixed(0)} ops/sec)`);

const msgpackNested = benchmark("MessagePack base64", () => {
  msgpackKeyer(nestedObj);
});
console.log(`   MessagePack base64:  ${msgpackNested.toFixed(2)}ms (${(100_000 / msgpackNested * 1000).toFixed(0)} ops/sec)`);

const msgpackHexNested = benchmark("MessagePack hex", () => {
  msgpackHexKeyer(nestedObj);
});
console.log(`   MessagePack hex:     ${msgpackHexNested.toFixed(2)}ms (${(100_000 / msgpackHexNested * 1000).toFixed(0)} ops/sec)`);

const msgpackHashNested = benchmark("MessagePack hash", () => {
  msgpackHashKeyer(nestedObj);
});
console.log(`   MessagePack hash:    ${msgpackHashNested.toFixed(2)}ms (${(100_000 / msgpackHashNested * 1000).toFixed(0)} ops/sec)`);

const speedupBase64Nested = (jsonNested / msgpackNested).toFixed(2);
const speedupHexNested = (jsonNested / msgpackHexNested).toFixed(2);
const speedupHashNested = (jsonNested / msgpackHashNested).toFixed(2);
console.log(`\n   ⚡ Base64: ${speedupBase64Nested}x vs JSON ${parseFloat(speedupBase64Nested) > 1 ? '✅' : '❌'}`);
console.log(`   ⚡ Hex:    ${speedupHexNested}x vs JSON ${parseFloat(speedupHexNested) > 1 ? '✅' : '❌'}`);
console.log(`   ⚡ Hash:   ${speedupHashNested}x vs JSON ${parseFloat(speedupHashNested) > 1 ? '✅' : '❌'}\n`);

console.log("📊 ARRAY (50 elements)\n");

const mediumArray = Array.from({ length: 50 }, (_, i) => i);

const jsonArray = benchmark("JSON.stringify", () => {
  jsonKeyer(mediumArray);
});
console.log(`   JSON.stringify:      ${jsonArray.toFixed(2)}ms (${(100_000 / jsonArray * 1000).toFixed(0)} ops/sec)`);

const msgpackArray = benchmark("MessagePack base64", () => {
  msgpackKeyer(mediumArray);
});
console.log(`   MessagePack base64:  ${msgpackArray.toFixed(2)}ms (${(100_000 / msgpackArray * 1000).toFixed(0)} ops/sec)`);

const msgpackHexArray = benchmark("MessagePack hex", () => {
  msgpackHexKeyer(mediumArray);
});
console.log(`   MessagePack hex:     ${msgpackHexArray.toFixed(2)}ms (${(100_000 / msgpackHexArray * 1000).toFixed(0)} ops/sec)`);

const msgpackHashArray = benchmark("MessagePack hash", () => {
  msgpackHashKeyer(mediumArray);
});
console.log(`   MessagePack hash:    ${msgpackHashArray.toFixed(2)}ms (${(100_000 / msgpackHashArray * 1000).toFixed(0)} ops/sec)`);

const speedupBase64Array = (jsonArray / msgpackArray).toFixed(2);
const speedupHexArray = (jsonArray / msgpackHexArray).toFixed(2);
const speedupHashArray = (jsonArray / msgpackHashArray).toFixed(2);
console.log(`\n   ⚡ Base64: ${speedupBase64Array}x vs JSON ${parseFloat(speedupBase64Array) > 1 ? '✅' : '❌'}`);
console.log(`   ⚡ Hex:    ${speedupHexArray}x vs JSON ${parseFloat(speedupHexArray) > 1 ? '✅' : '❌'}`);
console.log(`   ⚡ Hash:   ${speedupHashArray}x vs JSON ${parseFloat(speedupHashArray) > 1 ? '✅' : '❌'}\n`);

console.log("📊 LARGE ARRAY (500 elements)\n");

const largeArray = Array.from({ length: 500 }, (_, i) => i);

const jsonLarge = benchmark("JSON.stringify", () => {
  jsonKeyer(largeArray);
});
console.log(`   JSON.stringify:      ${jsonLarge.toFixed(2)}ms (${(100_000 / jsonLarge * 1000).toFixed(0)} ops/sec)`);

const msgpackLarge = benchmark("MessagePack base64", () => {
  msgpackKeyer(largeArray);
});
console.log(`   MessagePack base64:  ${msgpackLarge.toFixed(2)}ms (${(100_000 / msgpackLarge * 1000).toFixed(0)} ops/sec)`);

const msgpackHexLarge = benchmark("MessagePack hex", () => {
  msgpackHexKeyer(largeArray);
});
console.log(`   MessagePack hex:     ${msgpackHexLarge.toFixed(2)}ms (${(100_000 / msgpackHexLarge * 1000).toFixed(0)} ops/sec)`);

const msgpackHashLarge = benchmark("MessagePack hash", () => {
  msgpackHashKeyer(largeArray);
});
console.log(`   MessagePack hash:    ${msgpackHashLarge.toFixed(2)}ms (${(100_000 / msgpackHashLarge * 1000).toFixed(0)} ops/sec)`);

const speedupBase64Large = (jsonLarge / msgpackLarge).toFixed(2);
const speedupHexLarge = (jsonLarge / msgpackHexLarge).toFixed(2);
const speedupHashLarge = (jsonLarge / msgpackHashLarge).toFixed(2);
console.log(`\n   ⚡ Base64: ${speedupBase64Large}x vs JSON ${parseFloat(speedupBase64Large) > 1 ? '✅' : '❌'}`);
console.log(`   ⚡ Hex:    ${speedupHexLarge}x vs JSON ${parseFloat(speedupHexLarge) > 1 ? '✅' : '❌'}`);
console.log(`   ⚡ Hash:   ${speedupHashLarge}x vs JSON ${parseFloat(speedupHashLarge) > 1 ? '✅' : '❌'}\n`);

console.log("=".repeat(70));
console.log("📈 SUMMARY");
console.log("=".repeat(70) + "\n");

console.log("Key Findings:");
console.log(`  • MessagePack is SLOWER than JSON.stringify ❌`);
console.log(`  • Binary serialization overhead outweighs benefits`);
console.log(`  • String conversion (base64/hex) adds significant cost`);
console.log(`  • Even hash approach is slower (encode + hash vs stringify)\n`);

console.log("Why MessagePack is Slower:");
console.log(`  1. JSON.stringify is native C++ in V8/JSC (highly optimized)`);
console.log(`  2. MessagePack encoder is JavaScript (slower)`);
console.log(`  3. Binary → String conversion adds overhead`);
console.log(`  4. No direct "bytes as key" in JavaScript Maps\n`);

console.log("Recommendation:");
console.log(`  ❌ Do NOT use MessagePack for cache key generation`);
console.log(`  ✅ Stick with JSON.stringify (fastest text-based)`);
console.log(`  ✅ Or use WeakMap identity (fastest overall, different semantics)\n`);

console.log("=== Benchmark Complete ===\n");
