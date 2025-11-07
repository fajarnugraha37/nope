# @nope/async

> Async/concurrency utilities: Go-like channels, typed event buses, resource-safe scopes, generators, and resilient retry helpers.

## Modules
- **`concurrency/`**
  - `Channel`, `select`, async iterators for channels.
  - Flow control helpers: `debounce`, `throttle`, `JobQueue`, `ThreadPool`, `Mutex`, `Semaphore`/`FairSemaphore`, `CountdownLatch`, `PriorityQueue`.
  - Scope helpers: `withDefer`, `withAbort`, `timedAbort`, `using`, `deferred`.
- **`emitter/`**
  - Typed `EventBus` built on Node streams with regex/predicate filtering, async iteration, topic readers/writers.
  - Lightweight `EventEmitter` factories for browser/server usage.
- **`generator/`**
  - `map`, `tee`, `collectors`, `creators`, sorting helpers to manipulate async generators.
- **`try/`**
  - `Result` type (`Ok`/`Err`), `tryCatch*`, `unwrap*`, `retry`, `retryWith`, `retryAll`, `timeoutPromise`, `withTimeout`, collection helpers.

Every export is re-exported from `src/index.ts` so you can do:

```ts
import { Channel, select, withDefer, EventBus, retryWith } from "@nope/async";
```

## Examples

### Channels & `select`

```ts
import { Channel, select } from "@nope/async";

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
import { withDefer, timedAbort } from "@nope/async";

await withDefer(async (scope) => {
  const abortController = timedAbort(scope, 1_000);
  scope.defer(() => console.log("cleanup runs even on throw"));

  const response = await fetch(url, { signal: abortController.signal });
  return response.json();
});
```

### Event bus

```ts
import { EventBus } from "@nope/async";

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
import { retryWith } from "@nope/async";

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

## Scripts

| Command | Description |
| --- | --- |
| `bun run build` | Bundle sources via `tsup`. |
| `bun run test` | Run the suites under `shareds/async/tests` (concurrency, emitter, generator, try). |
| `bun run test:watch` | Watch mode. |
| `bun run coverage:view` | Inspect coverage output. |

`@nope/expression` and other packages treat this module as their standard async toolbox—prefer it over ad-hoc helpers so behavior stays consistent throughout the repo.
