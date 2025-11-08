# @fajarnugraha37/pattern-matching

Type-safe, ergonomic pattern matching primitives for TypeScript. Inspired by functional languages, this package ships a zero-boilerplate `match` expression, a batteries-included `P` pattern builder, and runtime guarantees that keep your control-flow honest.

## Installation

```bash
bun add @fajarnugraha37/pattern-matching
# or pnpm add, npm install, etc.
```

## Quick start

```ts
import { match, Pattern as P } from "@fajarnugraha37/pattern-matching";

type Result =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: string[] }
  | { status: "error"; error: Error };

const message = (state: Result) =>
  match(state)
    .with({ status: "idle" }, () => "Waiting…")
    .with({ status: "loading" }, () => "Fetching data…")
    .with({ status: "success", data: P.array(P.string).nonEmpty() }, ({ data }) =>
      `Loaded ${data.length} entries`
    )
    .with({ status: "error", error: P.instanceOf(Error).select("err") }, ({ err }) =>
      `Oops: ${err.message}`
    )
    .exhaustive();
```

### Highlights

- 🔒 **Exhaustiveness**: `match(...).exhaustive()` throws at runtime and fails at compile time when not all cases are covered.
- 🎯 **Structural + wildcard patterns**: Mix object literals, arrays, union helpers, `P.when`, `P.select`, and more.
- ♻️ **Recursive safety**: Compose self-referential patterns with `P.lazy` and keep type inference intact.
- 🧩 **Collection ergonomics**: `P.array`, `P.set`, and `P.map` now feature chainable guards (`minLength`, `maxSize`, `nonEmpty`, etc.) for declarative constraints.
- ✅ **Runtime predicates**: `isMatching(pattern, value)` produces reusable type guards.

## New DX upgrades

| Feature | Why it matters |
| --- | --- |
| `P.array(...).length / minLength / maxLength / nonEmpty` | Expressive size constraints without custom guards. |
| `P.set(...)` & `P.map(...)` `.size / minSize / maxSize / nonEmpty` | Capture “at least one entry” semantics directly in your pattern. |
| `P.lazy((self) => pattern)` | Model recursive data (trees, ASTs, menus) without fragile manual narrowing while keeping selections. |

Example – recursive expression evaluator:

```ts
type Expr =
  | { type: "leaf"; value: number }
  | { type: "node"; children: Expr[] };

const expr = P.lazy((self) =>
  P.union(
    { type: "leaf", value: P.select("leafValue", P.number) },
    { type: "node", children: P.array(self()).nonEmpty() }
  )
);

const evaluate = (input: Expr): number =>
  match(input)
    .with(expr, ({ leafValue, children }) =>
      leafValue ?? children.map(evaluate).reduce((sum, value) => sum + value, 0)
    )
    .exhaustive();
```

## Testing & contributing

```bash
bun test
```

The Bun test runner is configured in `bunfig.toml` with coverage enabled. When adding matchers or helpers, include accompanying tests under `./tests` and keep the TypeScript types in `src/types/*` in sync with the runtime implementation.

PRs and suggestions are very welcome—feel free to open an issue with DX ideas or missing helpers you would love to see.
