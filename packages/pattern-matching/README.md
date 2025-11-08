# @fajarnugraha37/pattern-matching

_Type-safe pattern matching for modern TypeScript, with Kotlin-inspired sealed unions, structural patterns, runtime guards, and ergonomic DX._

[![npm version](https://img.shields.io/npm/v/@fajarnugraha37/pattern-matching)](https://www.npmjs.com/package/@fajarnugraha37/pattern-matching)
[![bun compatible](https://img.shields.io/badge/bun-compatible-ffdf00.svg)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue?logo=typescript)](https://www.typescriptlang.org/)

`@fajarnugraha37/pattern-matching` is a batteries-included pattern matching toolkit for TypeScript. It takes inspiration from functional languages (ML, Rust, Kotlin) and wraps it in a developer-friendly API that keeps inference precise, exhaustiveness enforced, and runtime ergonomics delightful.

## Table of contents

1. [Installation](#installation)
2. [Why pattern matching?](#why-pattern-matching)
3. [Quick start](#quick-start)
4. [Core concepts](#core-concepts)
   - [Match expressions](#match-expressions)
   - [Patterns & selections](#patterns--selections)
   - [Exhaustiveness & errors](#exhaustiveness--errors)
5. [Pattern catalog](#pattern-catalog)
6. [Advanced features](#advanced-features)
   - [Recursive patterns with `P.lazy`](#recursive-patterns-with-play)
   - [Sealed unions & `matchSealed`](#sealed-unions--matchsealed)
   - [Collection guards & chainables](#collection-guards--chainables)
   - [Custom matchers & matcher protocol](#custom-matchers--matcher-protocol)
7. [Cookbook](#cookbook)
8. [API reference](#api-reference)
9. [FAQ & troubleshooting](#faq--troubleshooting)
10. [Contributing & testing](#contributing--testing)

---

## Installation

```bash
# bun
bun add @fajarnugraha37/pattern-matching

# pnpm
pnpm add @fajarnugraha37/pattern-matching

# npm
npm install @fajarnugraha37/pattern-matching
```

Requirements:

- TypeScript 5.0+
- Node.js ≥ 18 (or Bun ≥ 1.0)
- `"module": "NodeNext"` (or Bun defaults)

Enable `"strict": true` for the best inference experience—many helpers rely on `noImplicitAny`, `exactOptionalPropertyTypes`, and friends.

## Why pattern matching?

Pattern matching gives you expression-oriented control flow, smarter exhaustiveness checking, and a declarative way to destructure nested data. Compared to manual `if/else` or `switch` statements:

- ✅ **Safer**: the compiler refuses to compile if a union member is forgotten.
- ✅ **More expressive**: combine structural constraints, type guards, and user-defined matchers.
- ✅ **More reusable**: patterns are plain values that can be shared across modules.
- ✅ **Runtime-friendly**: `match()` short-circuits, `isMatching()` builds type guards, and errors point at the exact missing case.

If you like Kotlin's `when`, Rust's `match`, or Elixir's pattern clauses, you'll feel at home.

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
    .with(
      {
        status: "success",
        data: P.array(P.string).nonEmpty(),
      },
      ({ data }) => `Loaded ${data.length} entries`
    )
    .with(
      {
        status: "error",
        error: P.instanceOf(Error).select("err"),
      },
      ({ err }) => `Oops: ${err.message}`
    )
    .exhaustive();
```

> 🔐 Calling `.exhaustive()` enforces coverage both at compile time (type error) and at runtime (throws `NonExhaustiveError`).

---

## Core concepts

### Match expressions

- `match(value)` creates a builder.
- `.with(pattern, handler)` registers a clause. Patterns can be objects, primitives, P helpers, or custom matchers.
- `.when(predicate, handler)` lets you drop down to plain type guards.
- `.otherwise(handler)` provides a fallback. Skip it to keep things exhaustively checked.
- `.exhaustive()` runs the cascade and asserts every union member was handled.

```ts
match(request)
  .with({ method: "GET" }, readFromCache)
  .with({ method: "POST", body: P.select("body") }, processPost)
  .otherwise(forwardToBackend);
```

### Patterns & selections

Patterns are declarative shapes: primitives, nested objects, arrays, discriminated unions, guards, and more. Use `P.select("key", subpattern)` (or `.select("key")`) to extract values into handler parameters.

```ts
const positiveNumber = P.when((n: number): n is number => n > 0);

match(payload)
  .with({ price: positiveNumber.select("price") }, ({ price }) => price)
  .otherwise(() => 0);
```

Selections accumulate across nested patterns. Anonymous selections (`P.string.select()`) pass the value directly as the handler argument.

### Exhaustiveness & errors

- `.exhaustive()` uses deep conditional types (`InvertPattern`) to compute the remaining union.
- Forgetting a branch yields `NonExhaustiveError<Remaining>` at compile time.
- At runtime, missing branches throw `NonExhaustiveError` with the offending value.
- Supply a custom catcher if you need soft failures: `.exhaustive(value => ({ kind: "unknown", value }))`.

---

## Pattern catalog

| Category | Helper | Notes |
| --- | --- | --- |
| Wildcards | `P._`, `P.any`, `P.unknown` | Always match. |
| Primitives | `P.string`, `P.number`, `P.boolean`, `P.symbol`, `P.bigint`, `P.nullish`, `P.nonNullable` | Chain `.min(…)`, `.max(…)`, `.startsWith(…)`, etc. |
| Objects / records | Plain objects, `P.record(keyPattern, valuePattern)` | Optional props, nested matching. |
| Arrays / tuples | `P.array(sub)`, tuple literals, variadic tuples | `.length()`, `.minLength()`, `.optional()`. |
| Sets / maps | `P.set(sub)`, `P.map(keyPattern, valuePattern)` | `.size()`, `.nonEmpty()`. |
| Guards | `P.when(predicate)`, `P.not(pattern)` | Compose negatives / narrowing guards. |
| Unions | `P.union(...)`, `P.sealed(...)` | Create OR patterns, with sealed metadata. |
| Custom | `P.matcher` protocol (`P.unstable_Fn`) | Plug in domain-specific matchers (Dates, branded types, etc.). |
| Recursion | `P.lazy(factory)` | Reference a pattern from itself without losing inference. |

### Structural patterns

```ts
const userPattern = {
  id: P.string,
  profile: {
    email: P.select("email", P.string),
    address: {
      country: "ID",
      city: P.when((c: string) => c.length > 0).select("city"),
    },
  },
};

match(input)
  .with(userPattern, ({ email, city }) => `${email} (${city})`)
  .otherwise(() => "anonymous");
```

### Array & tuple helpers

```ts
match(tokens)
  .with(P.array(P.string).nonEmpty().minLength(2), ([first]) => first)
  .with(["GET", P.string], ([, path]) => `get ${path}`)
  .otherwise(() => "noop");
```

### Guards & combinators

```ts
const between = (min: number, max: number) =>
  P.when((n: number): n is number => n >= min && n <= max);

match(score)
  .with(between(90, 100), () => "A")
  .with(between(80, 89), () => "B")
  .otherwise(() => "retry");
```

---

## Advanced features

### Recursive patterns with `P.lazy`

Kotlin-esque sealed hierarchies often involve recursion. `P.lazy` defers pattern construction so references remain typed.

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

match(ast)
  .with(expr, ({ leafValue, children }) =>
    leafValue ?? children.reduce((sum, node) => sum + visit(node), 0)
  )
  .exhaustive();
```

### Sealed unions & `matchSealed`

Declare Kotlin-style sealed unions with `P.sealed` and consume them with `matchSealed`. Unlike `match`, the sealed builder refuses `.otherwise()` and ensures every declared variant appears exactly once.

```ts
const status = P.sealed(
  { type: "loading" },
  { type: "success", data: P.number },
  { type: "error", message: P.string }
);

const describe = (value: { type: string }) =>
  matchSealed(value, status)
    .with({ type: "loading" }, () => "loading…")
    .with({ type: "success" }, ({ data }) => `data: ${data}`)
    .with({ type: "error" }, ({ message }) => `error: ${message}`)
    .exhaustive();
```

You can still re-use `status` as a regular pattern elsewhere (e.g., as middleware guard) thanks to the union shape returned by `P.sealed`.

### Collection guards & chainables

Array / set / map helpers expose a fluent API:

```ts
const nonEmptyUsers = {
  users: P.array({ id: P.number }).nonEmpty().maxLength(100),
};

match(payload)
  .with(nonEmptyUsers, ({ users }) => users.length)
  .otherwise(() => 0);
```

All structural helpers inherit `.optional()`, `.select(key)`, `.and(pattern)`, `.or(pattern)`.

### Custom matchers & matcher protocol

You can turn domain types into patterns by implementing `[P.matcher]` (unstable for now but fully typed).

```ts
class UUID {
  constructor(readonly value: string) {}

  [P.matcher]() {
    return {
      match: (input: unknown) => ({
        matched: typeof input === "string" && input.length === 36,
      }),
    };
  }
}

match(input)
  .with({ id: new UUID("0000…") }, () => "uuid")
  .otherwise(() => "other");
```

---

## Cookbook

### 1. HTTP router

```ts
const route = (req: Request) =>
  match(req)
    .with({ method: "GET", url: /\\/users\\/(?<id>\\d+)/ }, ({ url }) =>
      respondWithUser(url.match(/\\d+/)![0])
    )
    .with({ method: "POST", headers: { "content-type": /json/ } }, createUser)
    .otherwise(notFound);
```

### 2. Feature flag evaluator

```ts
const rule = P.sealed(
  { type: "always" },
  { type: "country", allow: P.array(P.string) },
  { type: "percentage", value: P.number }
);

const evaluate = (ctx: Context, rules: Rule[]) =>
  rules.some((r) =>
    matchSealed(r, rule)
      .with({ type: "always" }, () => true)
      .with({ type: "country" }, ({ allow }) => allow.includes(ctx.country))
      .with({ type: "percentage" }, ({ value }) => ctx.roll < value)
      .exhaustive()
  );
```

### 3. Form validation

```ts
const validation = P.sealed(
  { type: "required", field: P.string },
  { type: "minLength", field: P.string, value: P.number },
  { type: "regex", field: P.string, pattern: P.instanceOf(RegExp) }
);

const runValidation = (input: Record<string, string>, rules: Validation[]) =>
  rules.flatMap((rule) =>
    matchSealed(rule, validation)
      .with({ type: "required" }, ({ field }) =>
        input[field] ? [] : [`${field} is required`]
      )
      .with({ type: "minLength" }, ({ field, value }) =>
        input[field]?.length >= value ? [] : [`${field} too short`]
      )
      .with({ type: "regex" }, ({ field, pattern }) =>
        pattern.test(input[field] ?? "") ? [] : [`${field} invalid`]
      )
      .exhaustive()
  );
```

### 4. Async result helpers

```ts
const AsyncResult = P.sealed(
  { state: "pending" },
  { state: "fulfilled", value: P.select("value") },
  { state: "rejected", reason: P.select("reason") }
);

const unwrap = (input: AsyncResult) =>
  matchSealed(input, AsyncResult)
    .with({ state: "pending" }, () => Promise.reject("still pending"))
    .with({ state: "fulfilled" }, ({ value }) => Promise.resolve(value))
    .with({ state: "rejected" }, ({ reason }) => Promise.reject(reason))
    .exhaustive();
```

---

## API reference

### `match(value)`

| Method | Description |
| --- | --- |
| `.with(pattern, handler)` | Adds a clause. Accepts guard in-between or multiple patterns. |
| `.when(predicate, handler)` | Runs predicate (sync) and handles truthy values. |
| `.otherwise(handler)` | Optional fallback. Not allowed on `matchSealed`. |
| `.exhaustive([handler])` | Returns the final value, ensuring all cases are covered. |
| `.run()` | Alias for `.exhaustive()`. |

### `matchSealed(value, sealedPattern)`

- Accepts a `P.sealed(...)` pattern.
- Returns `SealedMatch` (no `.otherwise`).
- Same API as `match` otherwise.

### Pattern builder (`Pattern as P`)

- Primitives: `P.string`, `P.number`, `P.boolean`, `P.symbol`, `P.bigint`, `P.nullish`, `P.nonNullable`.
- Wildcards: `P._`, `P.any`, `P.unknown`.
- Structural: literal objects / arrays, `P.array`, `P.set`, `P.map`, `P.record`.
- Combinators: `P.union`, `P.sealed`, `P.intersection`, `P.not`, `P.when`.
- Selectors: `.select(key?, subPattern?)`, `P.select(key?, subPattern)`.
- Chainables: `.optional()`, `.and()`, `.or()`, `.length()`, `.minLength()`, `.maxLength()`, `.nonEmpty()`, `.size()`, `.minSize()`, `.maxSize()`.
- Recursion: `P.lazy(self => pattern)`.
- Utility types: `P.infer<typeof pattern>`, `P.narrow<Union, typeof pattern>`.
- Runtime helper: `isMatching(pattern, value)` returns `value is MatchedValue`.

---

## Troubleshooting

**Q: Why do I get `NonExhaustiveError` even though I handled every case?**  
- Ensure your discriminant property uses literal types (`"success" | "error"`).  
- If you used `P.union`, consider switching to `P.sealed` so inference stays literal.

**Q: `P.select()` complains about multiple anonymous selections.**  
Either name each selection (`P.select("user")`) or ensure only one anonymous selection per pattern.

**Q: My handler receives `{ __error: never }`.**  
That means the pattern fell back to `Pattern<unknown>` due to widened inputs. Add explicit generics (`match<Result>()`) or tighten the pattern type.

**Q: Does this work with ESM / Bun?**  
Yes—this package ships ESM, CJS, and `.d.ts`. Bun users can import `src/index.ts` directly thanks to `allowImportingTsExtensions`.

---
