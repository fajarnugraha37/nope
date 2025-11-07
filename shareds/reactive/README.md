# @nope/reactive

> A promise-aware observable + stream implementation with a plugin system, immutable state helpers, and a suite of operators for composing async flows.

## Concepts

- **Stream vs Observable** – `Stream<T>` extends `Observable<T>` and keeps the latest value. Use `$(initial)` to create a stream: it exposes `.set` (powered by `limu`), `.next`, `.pause`, `.restart`, `.complete`, and `.pipe`.
- **Promise-aware** – Every observable behaves like a promise (`then`, `catch`, `finally`) while also supporting multiple subscribers, fan-out, and plugin hooks.
- **Plugins** – Attach logging/debugging/delay layers via `.use(consoleAll(), debugNode(), delayExec(...))` or write your own by implementing the `PluginParams` interface (then/execute hooks).
- **Operators** – Import operators (`map`, `filter`, `combine`, `merge`, `buffer`, `audit`, `debounce`, `throttle`, `partition`, `skip*`, `set`, `get`, etc.) and compose them with `.pipe`.
- **Global factory** – When a global `__fluth_global_factory__` exists the operators will reuse it, otherwise a new `Stream` is created per combination.

## Example

```ts
import { $, combine, map, filter, throttle } from "@nope/reactive";
import { consoleAll } from "@nope/reactive/plugins";

// Create stateful streams
const clicks$ = $(0);
const search$ = $("");

const throttled$ = clicks$
  .pipe(
    map((count) => count + 1),
    throttle(250)
  )
  .use(consoleAll("clicks"));

const filteredSearch$ = search$
  .pipe(
    map((text) => text.trim()),
    filter((text) => text.length > 2)
  )
  .use(consoleAll("query"));

const combined$ = combine(throttled$, filteredSearch$).pipe(
  map(([count, query]) => ({ count, query }))
);

// React like a promise
combined$.then(({ count, query }) => {
  console.log("Emit after operators", { count, query });
});

// Push new values
clicks$.next(1);
search$.next(" he");
search$.next("hello");

// Immutable updates for object-like state
const form$ = $({ count: 0 });
form$.set((draft) => {
  draft.count += 1;
});
```

## Operators & plugins

- Operators live under `src/operators/*.ts`. They are plain functions that accept an `Observable` and return another `Observable`, so you can extend them by following the same signature.
- Available operators include: `audit`, `buffer`, `change`, `combine`, `concat`, `debounce`, `delay`, `filter`, `finish`, `fork`, `get`, `map`, `merge`, `partition`, `promiseAll`, `promiseRace`, `set`, `skip`, `skipUntil`, `skipFilter`, `throttle`.
- Plugins live under `src/plugins`. Out of the box you get `consoleAll`, `consoleNode`, `debugAll`, `debugNode`, and `delayExec`.

## Working with streams

- Subscribe to lifecycle hooks via `.afterUnsubscribe`, `.afterComplete`, `.afterSetValue`.
- `.use` attaches per-node plugins; `.remove` detaches them.
- `.pipe` accepts any number of operator functions and returns a new observable (the original stream stays usable).
- `.execute()` lets you manually drive a node when you want to seed it with a specific promise/value.

## Scripts

| Command | Description |
| --- | --- |
| `bun run build` | Compile the package (ESM + CJS). |
| `bun run test` | Placeholder for future suites (runs Bun tests if present). |
| `bun run test:watch` | Watch mode. |
| `bun run coverage:view` | Open the coverage report (when generated). |

This package depends on `limu` for structural sharing and `@nope/common` for type guards, so updates to those libraries immediately benefit the reactive layer as well.
