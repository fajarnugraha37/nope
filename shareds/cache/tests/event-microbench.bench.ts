import { CacheEventEmitter } from "../src/cache-events";

/**
 * Micro-benchmark: Isolate event emission overhead
 * This measures ONLY the event system, not the cache operations
 */

console.log("\n=== Micro-Benchmark: Event Emission Overhead ===\n");

const iterations = 1_000_000;

// Test 1: Event emitter with NO listeners
console.log("🔬 Test 1: emit() calls with NO listeners\n");

const emitter1 = new CacheEventEmitter<string, any>();

let start = performance.now();
for (let i = 0; i < iterations; i++) {
  emitter1.emit({ type: "set", key: "test", timestamp: Date.now() });
}
let end = performance.now();
const noListenerTime = end - start;

console.log(`   ${iterations.toLocaleString()} emit() calls: ${noListenerTime.toFixed(2)}ms`);
console.log(`   ${(iterations / noListenerTime * 1000).toLocaleString()} ops/sec`);
console.log(`   ${(noListenerTime / iterations * 1000000).toFixed(3)}µs per emit\n`);

// Test 2: Event emitter with 1 listener
console.log("🎧 Test 2: emit() calls with 1 listener\n");

const emitter2 = new CacheEventEmitter<string, any>();
let count = 0;
emitter2.on("set", () => { count++; });

start = performance.now();
for (let i = 0; i < iterations; i++) {
  emitter2.emit({ type: "set", key: "test", timestamp: Date.now() });
}
end = performance.now();
const oneListenerTime = end - start;

console.log(`   ${iterations.toLocaleString()} emit() calls: ${oneListenerTime.toFixed(2)}ms`);
console.log(`   ${(iterations / oneListenerTime * 1000).toLocaleString()} ops/sec`);
console.log(`   ${(oneListenerTime / iterations * 1000000).toFixed(3)}µs per emit\n`);

// Test 3: Event emitter with 5 listeners
console.log("🎧🎧🎧🎧🎧 Test 3: emit() calls with 5 listeners\n");

const emitter3 = new CacheEventEmitter<string, any>();
for (let j = 0; j < 5; j++) {
  emitter3.on("set", () => { count++; });
}

start = performance.now();
for (let i = 0; i < iterations; i++) {
  emitter3.emit({ type: "set", key: "test", timestamp: Date.now() });
}
end = performance.now();
const fiveListenersTime = end - start;

console.log(`   ${iterations.toLocaleString()} emit() calls: ${fiveListenersTime.toFixed(2)}ms`);
console.log(`   ${(iterations / fiveListenersTime * 1000).toLocaleString()} ops/sec`);
console.log(`   ${(fiveListenersTime / iterations * 1000000).toFixed(3)}µs per emit\n`);

// Test 4: hasListeners() check overhead
console.log("⚡ Test 4: hasListeners() check overhead\n");

const emitter4 = new CacheEventEmitter<string, any>();

start = performance.now();
for (let i = 0; i < iterations; i++) {
  if (emitter4.hasListeners()) {
    emitter4.emit({ type: "set", key: "test", timestamp: Date.now() });
  }
}
end = performance.now();
const hasListenersTime = end - start;

console.log(`   ${iterations.toLocaleString()} hasListeners() + skip: ${hasListenersTime.toFixed(2)}ms`);
console.log(`   ${(iterations / hasListenersTime * 1000).toLocaleString()} ops/sec`);
console.log(`   ${(hasListenersTime / iterations * 1000000).toFixed(3)}µs per operation\n`);

console.log("=".repeat(70));
console.log("📊 ANALYSIS");
console.log("=".repeat(70) + "\n");

console.log("Emission overhead per call:\n");
console.log(`   No listeners (direct emit):      ${(noListenerTime / iterations * 1000000).toFixed(3)}µs`);
console.log(`   No listeners (with check):       ${(hasListenersTime / iterations * 1000000).toFixed(3)}µs`);
console.log(`   With 1 listener:                 ${(oneListenerTime / iterations * 1000000).toFixed(3)}µs`);
console.log(`   With 5 listeners:                ${(fiveListenersTime / iterations * 1000000).toFixed(3)}µs\n`);

const optimization = ((noListenerTime - hasListenersTime) / noListenerTime * 100);
console.log(`✅ Optimization Impact:\n`);
console.log(`   hasListeners() check is ${optimization.toFixed(1)}% FASTER than always emitting`);
console.log(`   Saves ${((noListenerTime - hasListenersTime) / iterations * 1000000).toFixed(3)}µs per call\n`);

console.log(`🎯 Per-operation cost:\n`);
console.log(`   Fast-path (no listeners):    ${(hasListenersTime / iterations * 1000000).toFixed(3)}µs`);
console.log(`   Listener invocation (1x):    ${((oneListenerTime - hasListenersTime) / iterations * 1000000).toFixed(3)}µs`);
console.log(`   Listener invocation (5x):    ${((fiveListenersTime - hasListenersTime) / iterations * 1000000).toFixed(3)}µs\n`);

console.log("=".repeat(70) + "\n");
