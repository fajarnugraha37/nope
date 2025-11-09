# @fajarnugraha37/async

[![npm version](https://img.shields.io/npm/v/@fajarnugraha37/async.svg)](https://www.npmjs.com/package/@fajarnugraha37/async)
[![Tests](https://img.shields.io/badge/tests-228%20passing-success)](./tests)
[![Coverage](https://img.shields.io/badge/coverage-98.06%25%20lines-brightgreen)](./coverage)

> Async/concurrency utilities: Go-like channels, typed event buses, resource-safe scopes, generators, and resilient retry helpers.

## Table of Contents

1. [Installation](#installation)
2. [Why this lib?](#why-this-lib)
3. [Quick start](#quick-start)
4. [Core concepts](#core-concepts)
5. [Usage catalog](#usage-catalog)
6. [Advanced features](#advanced-features)
7. [Cookbook](#cookbook)
8. [API reference](#api-reference)
9. [FAQ & troubleshooting](#faq--troubleshooting)

## Installation

```bash
# Node.js with npm
npm install @fajarnugraha37/async

# Node.js with pnpm
pnpm add @fajarnugraha37/async

# Node.js with yarn
yarn add @fajarnugraha37/async

# Bun
bun add @fajarnugraha37/async

# Deno
deno add npm:@fajarnugraha37/async
```

---

## Why this lib?

Modern JavaScript/TypeScript applications need powerful async primitives beyond basic Promises. This library provides:

- **🚦 Go-style Channels**: CSP-style concurrency with buffered/unbuffered channels and `select` for multi-channel operations
- **🔒 Synchronization Primitives**: Mutex, Semaphore, CountdownLatch for coordinating concurrent operations
- **📡 Typed Event Systems**: Type-safe EventBus with stream integration, regex filtering, and async iteration
- **🔄 Resilient Retry Logic**: Exponential backoff, circuit breakers, rate limiting, and timeout handling
- **🎯 Resource Safety**: Automatic cleanup with defer scopes (inspired by Go's `defer` and Zig's `errdefer`)
- **⚡ Async Generators**: Rich manipulation tools (map, filter, chunk, zip, tee) for async iteration
- **🎭 Flow Control**: Debounce, throttle, job queues, thread pools for managing async workloads
- **📊 Production-Ready**: 228 tests, 98% coverage, battle-tested patterns

Whether you're building event-driven systems, managing complex async workflows, or need structured concurrency, this library provides the tools.

---

## Quick start

```ts
import { 
  Channel, 
  select, 
  EventBus, 
  retry, 
  withDefer 
} from "@fajarnugraha37/async";

// Go-style channels
const ch = new Channel<number>(10);
await ch.send(42);
const { value } = await ch.recv();

// Select from multiple channels
const result = await select([ch1, ch2, ch3], 1000);

// Typed event bus
type Events = { "user:login": { id: string } };
const bus = new EventBus<Events>();
bus.on("user:login", (evt) => console.log(evt.payload.id));
bus.emit("user:login", { id: "123" });

// Resilient retry with backoff
const data = await retry(
  async () => fetch("https://api.example.com/data").then(r => r.json()),
  { maxAttempts: 3, delayMs: 1000 }
);

// Resource-safe cleanup
await withDefer(async (scope) => {
  const file = await openFile("data.txt");
  scope.defer(() => file.close());
  return processFile(file);
});
```

---

## Core concepts

### Channels & CSP

Channels provide Go-style communication between async tasks:

```ts
const ch = new Channel<string>(5); // buffered channel

// Producer
(async () => {
  for (let i = 0; i < 10; i++) {
    await ch.send(`message-${i}`);
  }
  ch.close();
})();

// Consumer
for await (const msg of ch) {
  console.log(msg);
}
```

**Key features:**
- Unbuffered (synchronous) or buffered channels
- `select` for multiplexing multiple channels
- Async iteration support
- Backpressure handling

### Synchronization Primitives

#### Mutex
```ts
const mutex = new Mutex();
await mutex.runExclusive(async () => {
  // Critical section - only one task at a time
  await updateSharedResource();
});
```

#### Semaphore
```ts
const sem = new Semaphore(3); // max 3 concurrent operations
await sem.withPermit(async () => {
  await expensiveOperation();
});
```

#### CountdownLatch
```ts
const latch = new CountdownLatch(5);

// 5 workers
for (let i = 0; i < 5; i++) {
  doWork().finally(() => latch.countDown());
}

// Wait for all workers
await latch.wait();
console.log("All work complete!");
```

### Resource Management

Inspired by Go's `defer` and Zig's error handling:

```ts
await withDefer(async (scope) => {
  const conn = await db.connect();
  scope.defer(() => conn.close());
  
  const tx = await conn.beginTransaction();
  scope.defer(() => tx.rollback());
  
  await tx.execute("INSERT ...");
  await tx.commit();
  // Deferred cleanup runs in LIFO order
});
```

### Event Systems

Type-safe event bus with advanced features:

```ts
type Events = {
  "user:created": { id: string; email: string };
  "order:placed": { orderId: number; total: number };
};

const bus = new EventBus<Events>();

// Subscribe with type safety
bus.on("user:created", (evt) => {
  console.log(evt.payload.email); // ✅ Type-checked
});

// Regex filtering
bus.on(/^user:/, (evt) => {
  console.log("User event:", evt.topic);
});

// Async iteration
for await (const evt of bus) {
  if (evt.topic === "order:placed") break;
}
```

### Retry & Resilience

Comprehensive error handling:

```ts
// Simple retry
await retry(fetchData, { maxAttempts: 3 });

// Advanced retry with backoff
await retryWith(fetchData, {
  maxAttempts: 5,
  baseMs: 100,
  factor: 2,
  jitter: 0.1,
  shouldRetry: (err) => err.code !== "PERMANENT_ERROR"
});

// Circuit breaker
const cb = new CircuitBreaker({ failureThreshold: 5 });
await cb.call(async () => callExternalAPI());

// Rate limiting
const limiter = new TokenBucket(100, 10); // 100 capacity, 10/sec
if (limiter.tryTake(1)) {
  await processRequest();
}
```

---

## Usage catalog

### Concurrency

#### Channel & Select
```ts
import { Channel, select } from "@fajarnugraha37/async";

// Unbuffered channel (blocking send/recv)
const ch = new Channel<number>();
await ch.send(42);
const { value } = await ch.recv();

// Buffered channel
const buffered = new Channel<string>(10);
for (let i = 0; i < 10; i++) {
  buffered.send(`msg-${i}`); // non-blocking until buffer full
}

// Select from multiple channels
const ch1 = new Channel<number>();
const ch2 = new Channel<string>();
const result = await select([ch1, ch2], 1000); // 1s timeout
if (result.ok && result.channel === 0) {
  console.log("ch1:", result.value);
}

// Async iteration
for await (const msg of ch) {
  console.log(msg);
  if (msg === "stop") break;
}
```

#### Mutex
```ts
import { Mutex } from "@fajarnugraha37/async";

const mutex = new Mutex();
let counter = 0;

// Exclusive access
await mutex.runExclusive(async () => {
  counter++;
  await someAsyncOperation();
});

// Manual lock/unlock
await mutex.acquire();
try {
  // critical section
} finally {
  mutex.release();
}
```

#### Semaphore & FairSemaphore
```ts
import { Semaphore, FairSemaphore } from "@fajarnugraha37/async";

// Standard semaphore (allows up to N concurrent operations)
const sem = new Semaphore(3);
await sem.withPermit(async () => {
  await processData(); // max 3 concurrent
});

// Fair semaphore (FIFO order)
const fair = new FairSemaphore(5);
await fair.acquire();
try {
  await criticalWork();
} finally {
  fair.release();
}
```

#### CountdownLatch
```ts
import { CountdownLatch } from "@fajarnugraha37/async";

const latch = new CountdownLatch(3);

// Start 3 parallel tasks
Promise.all([
  task1().finally(() => latch.countDown()),
  task2().finally(() => latch.countDown()),
  task3().finally(() => latch.countDown())
]);

// Wait for all to complete
await latch.wait();
console.log("All tasks done!");
```

#### JobQueue
```ts
import { JobQueue } from "@fajarnugraha37/async";

const queue = new JobQueue(5); // 5 concurrent workers

// Enqueue jobs
for (let i = 0; i < 100; i++) {
  queue.enqueue(async () => {
    await processItem(i);
  });
}

await queue.drain(); // wait for all jobs
queue.close();
```

#### ThreadPool
```ts
import { ThreadPool } from "@fajarnugraha37/async";

const pool = new ThreadPool(4); // 4 workers

const results = await Promise.all([
  pool.submit(() => expensiveTask(1)),
  pool.submit(() => expensiveTask(2)),
  pool.submit(() => expensiveTask(3))
]);

pool.shutdown();
```

#### PriorityQueue
```ts
import { PriorityQueue } from "@fajarnugraha37/async";

// Min-heap by default
const pq = new PriorityQueue<number>();
pq.push(5, 2, 8, 1);
console.log(pq.pop()); // 1

// Custom comparator
const maxHeap = new PriorityQueue<number>((a, b) => b - a);
maxHeap.push(5, 2, 8, 1);
console.log(maxHeap.pop()); // 8
```

#### Debounce & Throttle
```ts
import { debounce, throttle } from "@fajarnugraha37/async";

// Debounce: wait for quiet period
const search = debounce(async (query: string) => {
  return await api.search(query);
}, 300);

// Throttle: limit execution rate
const trackScroll = throttle(() => {
  updateScrollPosition();
}, 100);

window.addEventListener("scroll", trackScroll);
```

#### Defer & Resource Management
```ts
import { 
  withDefer, 
  withAbort, 
  timedAbort, 
  using, 
  deferred 
} from "@fajarnugraha37/async";

// Automatic cleanup
await withDefer(async (scope) => {
  const file = await fs.open("data.txt");
  scope.defer(() => file.close());
  
  const conn = await db.connect();
  scope.defer(() => conn.close());
  
  // All defers run in LIFO order
  return await process(file, conn);
});

// AbortController cleanup
await withDefer(async (scope) => {
  const ac = withAbort(scope);
  const response = await fetch(url, { signal: ac.signal });
  return await response.json();
});

// Timed abort
await withDefer(async (scope) => {
  const ac = timedAbort(scope, 5000); // 5s timeout
  return await longRunningOp(ac.signal);
});

// Generic resource wrapper
await withDefer(async (scope) => {
  const handle = using(resource, (r) => r.cleanup());
  scope.defer(handle);
  return await useResource(resource);
});

// Manual deferred promise
const { promise, resolve, reject } = deferred<number>();
setTimeout(() => resolve(42), 1000);
const result = await promise;
```

#### Sleep & Utilities
```ts
import { sleep } from "@fajarnugraha37/async";

await sleep(1000); // 1 second
console.log("Done waiting");
```

---

### Event Systems

#### EventBus (Stream-based)
```ts
import { EventBus, match, filterEnv } from "@fajarnugraha37/async";

type Events = {
  "user:login": { userId: string };
  "user:logout": { userId: string };
  "order:created": { orderId: number; total: number };
};

const bus = new EventBus<Events>();

// Type-safe subscription
bus.on("user:login", (evt) => {
  console.log("User logged in:", evt.payload.userId);
});

// Regex filtering
bus.on(/^user:/, (evt) => {
  console.log("User event:", evt.topic);
});

// Predicate filtering
bus.on((evt) => evt.topic.startsWith("order:"), (evt) => {
  console.log("Order event:", evt.payload);
});

// Emit events
bus.emit("user:login", { userId: "123" });

// Async iteration
for await (const evt of bus) {
  console.log(evt.topic, evt.payload);
  if (evt.topic === "shutdown") break;
}

// Transform streams
const userEvents = bus.pipe(
  filterEnv((e) => e.topic.startsWith("user:"))
);

// Topic reader/writer
const writer = bus.writer();
writer.write({ topic: "user:login", payload: { userId: "456" } });
```

#### EventEmitter (Lightweight)
```ts
import { EventEmitter } from "@fajarnugraha37/async";

type Events = {
  data: { value: number };
  error: Error;
};

const emitter = new EventEmitter<Events>();

// Subscribe
const unsubscribe = emitter.on("data", (evt) => {
  console.log("Data:", evt.value);
});

// One-time listener
emitter.once("error", (err) => {
  console.error("Error:", err);
});

// Emit
emitter.emit("data", { value: 42 });

// Wildcard handlers
emitter.on("*", (type, evt) => {
  console.log(`Event ${String(type)}:`, evt);
});

// Cleanup
unsubscribe();
emitter.off("data", handler);
```

#### Event Factories
```ts
import {
  createEventBus,
  createTopicDemux,
  createTopicMux,
  pipeTopics,
  tapLog
} from "@fajarnugraha37/async";

// Factory for typed bus
const bus = createEventBus<MyEvents>();

// Demux: split topics into separate streams
const { read, streams } = createTopicDemux<Events>(bus);
for await (const evt of streams["user:login"]) {
  console.log("Login:", evt.payload);
}

// Mux: combine streams
const combined = createTopicMux([stream1, stream2]);

// Pipe topics between buses
pipeTopics(sourceBus, targetBus);

// Debug logging
const logged = tapLog(bus, (evt) => console.log("Event:", evt));
```

---

### Async Generators

#### Basics: map, filter, take, drop
```ts
import { 
  mapG, 
  filterG, 
  take, 
  drop, 
  takeWhile, 
  dropWhile,
  enumerate,
  chunk,
  flatMapG,
  zip,
  chain
} from "@fajarnugraha37/async";

async function* numbers() {
  for (let i = 0; i < 10; i++) yield i;
}

// Map
const doubled = mapG(numbers(), (x) => x * 2);

// Filter
const evens = filterG(numbers(), (x) => x % 2 === 0);

// Take first N
const first5 = take(numbers(), 5);

// Drop first N
const rest = drop(numbers(), 3);

// Take while condition
const lessThan5 = takeWhile(numbers(), (x) => x < 5);

// Enumerate with index
for await (const [idx, val] of enumerate(numbers())) {
  console.log(idx, val);
}

// Chunk into arrays
for await (const chunk of chunk(numbers(), 3)) {
  console.log(chunk); // [0,1,2], [3,4,5], ...
}

// Flat map
const nested = flatMapG(numbers(), function*(n) {
  for (let i = 0; i < n; i++) yield i;
});

// Zip multiple iterables
for await (const [a, b, c] of zip(iter1, iter2, iter3)) {
  console.log(a, b, c);
}

// Chain iterables
const combined = chain(iter1, iter2, iter3);
```

#### Collectors
```ts
import { 
  reduceG, 
  toArray, 
  toSet, 
  toMap,
  groupBy,
  partition
} from "@fajarnugraha37/async";

// Reduce
const sum = reduceG(numbers(), (acc, x) => acc + x, 0);

// To collections
const arr = toArray(numbers());
const set = toSet(numbers());
const map = toMap(
  enumerate(numbers()),
  ([idx, val]) => [idx, val]
);

// Group by key
const grouped = groupBy(items, (item) => item.category);

// Partition by predicate
const [evens, odds] = partition(numbers(), (x) => x % 2 === 0);
```

#### Creators
```ts
import { 
  range, 
  count, 
  repeat, 
  cycle 
} from "@fajarnugraha37/async";

// Range
for (const n of range(10)) console.log(n); // 0..9
for (const n of range(5, 10)) console.log(n); // 5..9
for (const n of range(0, 10, 2)) console.log(n); // 0,2,4,6,8

// Infinite counter
for (const n of count(0, 2)) {
  console.log(n); // 0,2,4,6,...
  if (n >= 10) break;
}

// Repeat value
for (const x of repeat("hello", 3)) {
  console.log(x); // hello, hello, hello
}

// Cycle through values
for (const x of cycle([1, 2, 3])) {
  console.log(x); // 1,2,3,1,2,3,...
}
```

#### Sorting & Merging
```ts
import { mergeSorted } from "@fajarnugraha37/async";

const iter1 = [1, 3, 5];
const iter2 = [2, 4, 6];

// Merge sorted iterables
for (const n of mergeSorted((a, b) => a - b, iter1, iter2)) {
  console.log(n); // 1,2,3,4,5,6
}
```

#### Tee (Split iterator)
```ts
import { tee } from "@fajarnugraha37/async";

const source = numbers();
const [iter1, iter2] = tee(source, 2);

// Two independent copies
for await (const n of iter1) console.log("A:", n);
for await (const n of iter2) console.log("B:", n);
```

---

### Retry & Resilience

#### Basic Retry
```ts
import { retry, retryWith, retryAll } from "@fajarnugraha37/async";

// Simple retry
const result = await retry(
  async () => fetchData(),
  { maxAttempts: 3, delayMs: 1000 }
);

// Advanced retry with backoff
const data = await retryWith(
  async () => callAPI(),
  {
    maxAttempts: 5,
    baseMs: 100,
    factor: 2,
    jitter: 0.1,
    shouldRetry: (err) => err.status !== 400
  }
);

// Retry all with individual policies
const results = await retryAll([
  { fn: task1, policy: { maxAttempts: 3 } },
  { fn: task2, policy: { maxAttempts: 5 } }
]);
```

#### Retry Policies
```ts
import { 
  retryAfterDelayMs, 
  httpRetryPolicy,
  expBackoffDelay 
} from "@fajarnugraha37/async";

// Fixed delay
const policy1 = retryAfterDelayMs(1000);

// HTTP-aware retry
const httpPolicy = httpRetryPolicy({
  method: "GET",
  status: 503
});
const decision = httpPolicy(error, 2);

// Exponential backoff
const backoff = expBackoffDelay({
  baseMs: 100,
  factor: 2,
  maxMs: 10000,
  jitter: 0.1
});
```

#### Circuit Breaker
```ts
import { CircuitBreaker } from "@fajarnugraha37/async";

const breaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 30000,
  halfOpenMaxAttempts: 2
});

try {
  const result = await breaker.call(async () => {
    return await externalAPI();
  });
} catch (err) {
  console.error("Circuit open:", err);
}

// Check state
console.log(breaker.state); // "closed" | "open" | "half-open"
```

#### Rate Limiting
```ts
import { 
  TokenBucket, 
  rateLimit,
  Scheduler 
} from "@fajarnugraha37/async";

// Token bucket
const bucket = new TokenBucket(100, 10); // 100 capacity, 10/sec
if (bucket.tryTake(5)) {
  await processRequest();
}

// Rate limit wrapper
const limited = rateLimit(
  async (data) => processData(data),
  { capacity: 100, refillRate: 10 }
);
await limited(myData);

// Scheduler for batch operations
const scheduler = new Scheduler({
  maxConcurrency: 5,
  intervalMs: 1000
});
scheduler.schedule(() => task1());
scheduler.schedule(() => task2());
```

#### Timeout Handling
```ts
import { 
  timeoutPromise, 
  withTimeout 
} from "@fajarnugraha37/async";

// Promise timeout
const result = await timeoutPromise(
  fetchData(),
  5000,
  "Operation timed out"
);

// Wrapper with timeout
const timedFetch = withTimeout(fetchData, 3000);
await timedFetch("https://api.example.com");
```

#### Result Type (Ok/Err)
```ts
import { 
  tryCatch, 
  collectAll,
  partitionOkErr,
  firstErr,
  anyOk,
  collectAllObj
} from "@fajarnugraha37/async";

// Try-catch wrapper
const result = tryCatch(() => riskyOperation());
if (result.ok) {
  console.log(result.value);
} else {
  console.error(result.error);
}

// Collect results
const results = [
  { ok: true, value: 1 },
  { ok: true, value: 2 },
  { ok: false, error: "fail" }
];
const all = collectAll(results); // Err if any fail

// Partition
const [oks, errs] = partitionOkErr(results);

// First error
const err = firstErr(results);

// Any success
const hasOk = anyOk(results);

// Object results
const obj = collectAllObj({
  a: { ok: true, value: 1 },
  b: { ok: true, value: 2 }
}); // { ok: true, value: { a: 1, b: 2 } }
```

#### Parallel Execution
```ts
import { 
  parallel, 
  parallelLimit,
  race,
  raceMaybe
} from "@fajarnugraha37/async";

// Unlimited parallel
const results = await parallel([
  async () => task1(),
  async () => task2(),
  async () => task3()
]);

// Limited concurrency
const limited = await parallelLimit([
  async () => task1(),
  async () => task2(),
  async () => task3()
], 2); // max 2 concurrent

// Race
const winner = await race([
  fetchFromAPI1(),
  fetchFromAPI2()
]);

// Race maybe (returns all results)
const all = await raceMaybe([
  fetchFromAPI1(),
  fetchFromAPI2()
]);
```

---

### Channels & `select`

```ts
import { Channel, select } from "@fajarnugraha37/async";

const input = new Channel<number>(1);

(async () => {
  await input.send(41);
  await input.send(42);
  input.close();
})();

while (true) {
  const { value, done } = await input.recv();
  if (done) break;
  console.log(value);
}

// Listen to whichever channel fires first
const a = new Channel<string>();
const b = new Channel<string>();

setTimeout(() => void a.send("from A"), 10);
setTimeout(() => void b.send("from B"), 5);

const first = await select([a, b], 100);
console.log(first.index, first.value);
```

### Resource-safe scopes

```ts
import { withDefer, timedAbort } from "@fajarnugraha37/async";

await withDefer(async (scope) => {
  const abortController = timedAbort(scope, 1_000);
  scope.defer(() => console.log("cleanup runs even on throw"));

  const response = await fetch(url, { signal: abortController.signal });
  return response.json();
});
```

### Event bus

```ts
import { EventBus } from "@fajarnugraha37/async";

type Events = {
  "user:created": { id: string };
  audit: { action: string };
};

const bus = new EventBus<Events>();

const stop = bus.on("user:created", (evt) => {
  console.log("user", evt.payload.id);
});

await bus.emitAsync("user:created", { id: "42" });
stop();
```

### Retry helpers

```ts
import { retryWith } from "@fajarnugraha37/async";

const result = await retryWith(
  async (signal) => {
    const response = await fetch("https://example.com", { signal });
    if (!response.ok) throw new Error("boom");
    return response.json();
  },
  { retries: 5, delayMs: 200, backoff: 1.5, jitter: 0.1, timeoutMs: 2_000 }
);

if (!result.ok) throw result.error;
```

---

## Advanced features

### Custom Retry Policies

Create sophisticated retry strategies:

```ts
import { RetryDecision } from "@fajarnugraha37/async";

function customRetryPolicy(error: any, attempt: number): RetryDecision {
  // Don't retry client errors
  if (error.status >= 400 && error.status < 500) {
    return { shouldRetry: false };
  }
  
  // Exponential backoff with jitter
  const baseDelay = 1000;
  const delay = baseDelay * Math.pow(2, attempt) * (0.9 + Math.random() * 0.2);
  
  return {
    shouldRetry: attempt < 5,
    delayMs: Math.min(delay, 30000) // cap at 30s
  };
}

await retryWith(apiCall, customRetryPolicy);
```

### Circuit Breaker Patterns

Implement resilient microservices:

```ts
const breaker = new CircuitBreaker({
  failureThreshold: 5,      // Open after 5 failures
  resetTimeout: 30000,       // Try again after 30s
  halfOpenMaxAttempts: 2     // Test with 2 requests
});

// Fallback on circuit open
async function resilientCall() {
  try {
    return await breaker.call(() => primaryService());
  } catch (err) {
    if (breaker.state === "open") {
      return await fallbackService();
    }
    throw err;
  }
}
```

### Composing Event Streams

Build complex event pipelines:

```ts
import { EventBus, filterEnv, createTopicDemux } from "@fajarnugraha37/async";

const bus = new EventBus<MyEvents>();

// Create filtered sub-streams
const userEvents = bus.pipe(filterEnv(e => e.topic.startsWith("user:")));
const orderEvents = bus.pipe(filterEnv(e => e.topic.startsWith("order:")));

// Demux into separate channels
const { streams } = createTopicDemux(bus);
for await (const evt of streams["critical:error"]) {
  await alertOps(evt);
}
```

### Custom Priority Queues

```ts
interface Task {
  priority: number;
  deadline: Date;
  execute: () => Promise<void>;
}

const taskQueue = new PriorityQueue<Task>((a, b) => {
  // Higher priority first
  if (a.priority !== b.priority) return b.priority - a.priority;
  // Earlier deadline first
  return a.deadline.getTime() - b.deadline.getTime();
});

taskQueue.push(...tasks);
while (taskQueue.size > 0) {
  const task = taskQueue.pop();
  await task.execute();
}
```

---

## Cookbook

### Pattern 1: Fan-out/Fan-in

Process items in parallel, collect results:

```ts
import { Channel, withDefer } from "@fajarnugraha37/async";

async function fanOutFanIn<T, R>(
  items: T[],
  process: (item: T) => Promise<R>,
  workers: number
): Promise<R[]> {
  return withDefer(async (scope) => {
    const input = new Channel<T>(items.length);
    const output = new Channel<R>(items.length);
    
    scope.defer(() => { input.close(); output.close(); });
    
    // Fan-out: spawn workers
    const workerPromises = Array.from({ length: workers }, async () => {
      for await (const item of input) {
        const result = await process(item);
        await output.send(result);
      }
    });
    
    // Feed input
    for (const item of items) await input.send(item);
    input.close();
    
    // Fan-in: collect results
    const results: R[] = [];
    for await (const result of output) {
      results.push(result);
      if (results.length === items.length) break;
    }
    
    await Promise.all(workerPromises);
    return results;
  });
}

// Usage
const urls = ["url1", "url2", "url3"];
const responses = await fanOutFanIn(urls, fetch, 5);
```

### Pattern 2: Worker Pool with Queue

```ts
import { ThreadPool } from "@fajarnugraha37/async";

async function workerPool<T, R>(
  tasks: T[],
  worker: (task: T) => Promise<R>,
  poolSize: number
): Promise<R[]> {
  const pool = new ThreadPool(poolSize);
  const results = await Promise.all(
    tasks.map(task => pool.submit(() => worker(task)))
  );
  pool.shutdown();
  return results;
}

// Usage
const processed = await workerPool(data, processItem, 10);
```

### Pattern 3: Rate-Limited Batch Processor

```ts
import { TokenBucket, sleep } from "@fajarnugraha37/async";

async function rateLimitedBatch<T>(
  items: T[],
  process: (item: T) => Promise<void>,
  ratePerSecond: number
) {
  const bucket = new TokenBucket(ratePerSecond, ratePerSecond);
  
  for (const item of items) {
    while (!bucket.tryTake(1)) {
      await sleep(100); // wait for tokens
    }
    await process(item);
  }
}

// Process 100 items/sec
await rateLimitedBatch(items, processItem, 100);
```

### Pattern 4: Retry with Fallback Chain

Try multiple strategies:

```ts
import { retry } from "@fajarnugraha37/async";

async function resilientFetch(url: string) {
  // Try primary
  try {
    return await retry(
      () => fetch(url).then(r => r.json()),
      { maxAttempts: 3, delayMs: 1000 }
    );
  } catch (err) {
    console.warn("Primary failed, trying cache");
  }
  
  // Try cache
  try {
    return await cache.get(url);
  } catch (err) {
    console.warn("Cache failed, using fallback");
  }
  
  // Fallback
  return await fetchFromBackup(url);
}
```

### Pattern 5: Pub/Sub with Type Safety

```ts
import { EventBus } from "@fajarnugraha37/async";

type Events = {
  "user:login": { userId: string; timestamp: number };
  "user:logout": { userId: string };
  "data:update": { key: string; value: any };
};

class PubSub {
  private bus = new EventBus<Events>();
  
  subscribe<K extends keyof Events>(
    topic: K,
    handler: (payload: Events[K]) => void
  ) {
    return this.bus.on(topic, (evt) => handler(evt.payload));
  }
  
  publish<K extends keyof Events>(topic: K, payload: Events[K]) {
    this.bus.emit(topic, payload);
  }
  
  async *stream() {
    for await (const evt of this.bus) {
      yield evt;
    }
  }
}

// Usage
const pubsub = new PubSub();
pubsub.subscribe("user:login", ({ userId }) => {
  console.log(`User ${userId} logged in`);
});
pubsub.publish("user:login", { userId: "123", timestamp: Date.now() });
```

---

## Benchmark results

Performance characteristics (Bun 1.3.1):

```
Channel send/recv              33.84ms  (100k ops)
Channel buffered (100)         44.61ms  (10k ops)
JobQueue (100 jobs)            36.87ms  
Mutex lock/unlock              32.72ms  (100k ops)
Semaphore (5 permits)          33.26ms  (50k ops)
CountdownLatch (10)            30.19ms  (10k ops)
PriorityQueue (1000 items)      4.07ms  
ThreadPool (10 tasks)          72.78ms  
EventBus (1000 events)         18.42ms  
EventEmitter (100 events)       1.30ms  
```

Run benchmarks yourself:
```bash
bun run benchmark
```

---

## API reference

Complete type signatures and detailed documentation for all exports.

### Concurrency Module

#### `Channel<T>`
Go-style buffered/unbuffered channel.

```ts
class Channel<T> {
  constructor(bufferSize?: number);
  send(value: T): Promise<void>;
  recv(): Promise<{ value: T, ok: boolean }>;
  close(): void;
  [Symbol.asyncIterator](): AsyncIterator<T>;
}
```

#### `select()`
```ts
function select<T>(
  channels: Channel<T>[],
  timeoutMs?: number
): Promise<{ ok: boolean; channel?: number; value?: T }>
```

#### `Mutex`
```ts
class Mutex {
  acquire(): Promise<void>;
  release(): void;
  runExclusive<T>(fn: () => Promise<T>): Promise<T>;
}
```

#### `Semaphore` / `FairSemaphore`
```ts
class Semaphore {
  constructor(permits: number);
  acquire(): Promise<void>;
  release(): void;
  withPermit<T>(fn: () => Promise<T>): Promise<T>;
}

class FairSemaphore {
  constructor(permits: number);
  acquire(): Promise<void>;
  release(): void;
  withPermit<T>(fn: () => Promise<T>): Promise<T>;
}
```

#### `CountdownLatch`
```ts
class CountdownLatch {
  constructor(count: number);
  countDown(): void;
  wait(): Promise<void>;
}
```

#### `JobQueue`
```ts
class JobQueue {
  constructor(concurrency: number);
  enqueue(job: () => Promise<void>): void;
  drain(): Promise<void>;
  close(): void;
}
```

#### `ThreadPool`
```ts
class ThreadPool {
  constructor(size: number);
  submit<T>(task: () => T): Promise<T>;
  shutdown(): void;
}
```

#### `PriorityQueue<T>`
```ts
class PriorityQueue<T> {
  constructor(comparator?: (a: T, b: T) => number);
  push(...items: T[]): void;
  pop(): T | undefined;
  peek(): T | undefined;
  size: number;
}
```

#### Defer & Resource Management
```ts
interface Defer {
  defer(finalizer: () => void | Promise<void>): void;
}

function withDefer<T>(fn: (scope: Defer) => Promise<T>): Promise<T>;
function withAbort(scope: Defer): AbortController;
function timedAbort(scope: Defer, ms: number): AbortController;
function using<T>(value: T, dispose: (v: T) => void | Promise<void>);

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: any): void;
}
function deferred<T>(): Deferred<T>;
```

#### Flow Control
```ts
function debounce<A extends any[], R>(
  fn: (...args: A) => R,
  delayMs: number
): (...args: A) => Promise<R>;

function throttle<A extends any[], R>(
  fn: (...args: A) => R,
  intervalMs: number
): (...args: A) => R;
```

### Event Systems Module

#### `EventBus<T>`
```ts
class EventBus<T extends Record<string, any>> {
  on(topic: string | RegExp | Predicate, handler: Handler): () => void;
  emit(topic: string, payload: any): void;
  close(): void;
  pipe(transform: Transform): Readable;
  [Symbol.asyncIterator](): AsyncIterator;
}
```

#### `EventEmitter<T>`
```ts
class EventEmitter<T extends Record<EventType, any>> {
  on(event: keyof T, handler: (data: T[event]) => void): () => void;
  once(event: keyof T, handler: (data: T[event]) => void): () => void;
  off(event: keyof T, handler: Handler): void;
  emit(event: keyof T, data: T[event]): void;
}
```

### Generator Module

All generator utilities (`mapG`, `filterG`, `take`, `drop`, `chunk`, `zip`, `chain`, etc.) plus creators (`range`, `count`, `repeat`, `cycle`) and collectors (`toArray`, `toSet`, `reduceG`).

### Retry & Resilience Module

#### `retry()` / `retryWith()`
```ts
function retry<T>(
  fn: () => Promise<T>,
  options?: { maxAttempts?: number; delayMs?: number }
): Promise<T>;

function retryWith<T>(
  fn: () => Promise<T>,
  policy: RetryPolicy | RetryDecisionFn
): Promise<T>;

interface RetryDecision {
  shouldRetry: boolean;
  delayMs?: number;
}
```

#### `CircuitBreaker`
```ts
class CircuitBreaker {
  constructor(options: {
    failureThreshold: number;
    resetTimeout: number;
    halfOpenMaxAttempts?: number;
  });
  call<T>(fn: () => Promise<T>): Promise<T>;
  state: "closed" | "open" | "half-open";
}
```

#### `TokenBucket`
```ts
class TokenBucket {
  constructor(capacity: number, refillRate: number);
  tryTake(tokens: number): boolean;
  take(tokens: number): Promise<void>;
  availableTokens(): number;
}
```

#### Utilities
- `timeoutPromise<T>(promise, ms, message?)`: Add timeout to promise
- `withTimeout<T>(fn, ms)`: Wrap function with timeout
- `parallel<T>(fns)`: Run functions in parallel
- `parallelLimit<T>(fns, limit)`: Limit concurrency
- `Result<T, E>` types: `Ok<T>`, `Err<E>`, and collection helpers

---

## FAQ

**Q: When should I use Channels vs EventBus?**

- **Channels**: Point-to-point communication, backpressure, CSP patterns
- **EventBus**: Pub/sub, multiple subscribers, event filtering

**Q: How do I handle cleanup in async workflows?**

Use `withDefer` for automatic resource cleanup in LIFO order.

**Q: What's the difference between Semaphore and FairSemaphore?**

- `Semaphore`: LIFO-like (stack order)
- `FairSemaphore`: FIFO (queue order) - use when fairness matters

**Q: How do I implement request retries with backoff?**

```ts
await retryWith(apiCall, {
  maxAttempts: 5,
  baseMs: 100,
  factor: 2,
  jitter: 0.1
});
```

**Q: Can I use this with Node.js streams?**

Yes! `EventBus` is built on Node streams and fully compatible.

**Q: How do I prevent memory leaks?**

Always unsubscribe when done, or use `for await` with `break`.

**Q: What's the performance overhead of defer scopes?**

Minimal (~1-2% overhead). Defers are stored in an array and called in reverse.

**Q: Can I nest `withDefer` scopes?**

Yes! Inner scopes' defers run first (LIFO within each scope).

**Q: How do I debug circuit breaker issues?**

Check `breaker.state` and add logging on state transitions.

---

## Scripts

| Command | Description |
| --- | --- |
| `bun run build` | Bundle sources via `tsup`. |
| `bun run test` | Run the suites under `shareds/async/tests` (concurrency, emitter, generator, try). |
| `bun run test:watch` | Watch mode. |
| `bun run coverage:view` | Inspect coverage output. |

`@fajarnugraha37/expression` and other packages treat this module as their standard async toolbox—prefer it over ad-hoc helpers so behavior stays consistent throughout the repo.
