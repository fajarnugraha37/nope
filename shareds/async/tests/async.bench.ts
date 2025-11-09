import { Channel, select, Mutex, Semaphore, FairSemaphore, JobQueue, CountdownLatch, PriorityQueue, ThreadPool } from "../src/concurrency/index";
import { EventBus } from "../src/emitter/index";
import mitt from "../src/emitter/event-emitter";

console.log("\n=== @fajarnugraha37/async Performance Benchmarks ===\n");

function runBenchmark(name, fn) {
  const start = performance.now();
  const result = fn();
  if (result instanceof Promise) {
    return result.then(() => console.log(`✓ ${name}: ${(performance.now() - start).toFixed(2)}ms`));
  } else {
    console.log(`✓ ${name}: ${(performance.now() - start).toFixed(2)}ms`);
  }
}

console.log("\n--- Channel ---");
runBenchmark("Channel: send/recv", async () => { const ch = new Channel(); const p = ch.send(42); await ch.recv(); await p; });
runBenchmark("Channel: buffered 100", async () => { const ch = new Channel(100); for (let i = 0; i < 100; i++) await ch.send(i); for (let i = 0; i < 100; i++) await ch.recv(); });

console.log("\n--- JobQueue ---");
runBenchmark("JobQueue: 100 jobs", async () => { const q = new JobQueue(5); await Promise.all(Array.from({ length: 100 }, (_, i) => q.add(async () => i * 2))); });

console.log("\n--- Mutex ---");
runBenchmark("Mutex: lock/unlock", async () => { const m = new Mutex(); await m.runExclusive(async () => {}); });

console.log("\n--- Semaphore ---");
runBenchmark("Semaphore: 5 permits", async () => { const s = new Semaphore(5); await s.withPermit(async () => {}); });

console.log("\n--- Latch ---");
runBenchmark("Latch: 10 counters", async () => { const l = new CountdownLatch(10); const p = l.wait(); for (let i = 0; i < 10; i++) l.countDown(); await p; });

console.log("\n--- PriorityQueue ---");
runBenchmark("PriorityQueue: 1000 items", () => { const pq = new PriorityQueue((a, b) => a - b); for (let i = 0; i < 1000; i++) pq.push(Math.random()); while (!pq.isEmpty()) pq.pop(); });

console.log("\n--- ThreadPool ---");
runBenchmark("ThreadPool: 10 tasks", async () => { const pool = new ThreadPool(); await Promise.all(Array.from({ length: 10 }, (_, i) => pool.run(`return a0 * 2`, [i]))); });

console.log("\n--- EventBus ---");
runBenchmark("EventBus: 1000 events", () => { const bus = new EventBus(); bus.on("test", () => {}); for (let i = 0; i < 1000; i++) bus.emit("test", i); });

console.log("\n--- EventEmitter ---");
runBenchmark("EventEmitter: 100 events", () => { const em = mitt(); em.on("test", () => {}); for (let i = 0; i < 100; i++) em.emit("test", i); });

console.log("\n=== Complete ===\n");
