# @fajarnugraha37/expression

> Strongly typed expression schemas, fluent builders, analyzers, validators, and a cache-aware evaluator powered by `json-logic-engine`.

## Why this exists
- Author composable JSON-like expressions with full metadata (id, description, tags, categories, version) via `ExpressionBuilder`.
- Inspect expressions before you run them: extract variables/literals, detect recursion, summarize complexity, and validate the structure.
- Execute expressions against arbitrary data using the asynchronous `ExpressionEvaluator` which compiles rules once, caches the compiled functions, and enforces depth/time limits.
- Debug, optimize, and serialize rules with utilities such as `ExpressionDebugger`, `ExpressionOptimizer`, builder short-hands (`Compare`, `Logic`, `Str`, `Arr`, `$`, `BuilderFactory`, …), and tight integration with `@fajarnugraha37/validator`.

## Installation
Inside this monorepo the package is already linked. In another workspace:

```bash
bun add @fajarnugraha37/expression
# or
pnpm add @fajarnugraha37/expression
```

> The package publishes ESM and CJS bundles plus `.d.ts` files via `tsup`.

## Quick start

```ts
import {
  ExpressionBuilder,
  ExpressionEvaluator,
  ExpressionAnalyzer,
  ExpressionValidator,
  ExpressionDebugger,
  Ops,
  Compare,
  Logic,
  Str,
  Arr,
  when,
  $
} from "@fajarnugraha37/expression";

const rule = ExpressionBuilder.create("eligibility-rule")
  .name("Loan eligibility")
  .description("Tag VIP borrowers when the score and history allow it")
  .tags("loans", "kyc")
  .category("underwriting")
  .priority(1)
  .all()
  .add(Compare.gte(Ops.v("score"), 720))
  .add(
    Logic.or(
      Str.contains(Ops.v("tags"), "vip"),
      $(Ops.v("recentPayments")).map(
        Ops.literal({
          ">": [Ops.v("amount"), 500],
        })
      ).build()
    )
  )
  .add(
    when(
      Ops.v("tier", "standard"),
      { gold: Ops.literal(true), platinum: Ops.literal(true) },
      Ops.literal(false)
    )
  )
  .strictValidation()
  .build();

const evaluator = new ExpressionEvaluator({
  timeout: 500,
  cache: { maxEntries: 256, ttl: 10 * 60 * 1000 },
  debug: true,
});

const { value, success, metadata } = await evaluator.evaluate(rule, {
  data: {
    score: 735,
    tags: ["vip", "beta"],
    tier: "gold",
    recentPayments: [{ amount: 800 }, { amount: 150 }],
  },
  variables: { country: "id" },
  functions: {
    tag: (val: unknown) => String(val).toUpperCase(),
  },
});

if (!success) throw value;

console.log("decision", value, metadata.duration);

const summary = ExpressionAnalyzer.generateSummary(rule);
const validation = ExpressionValidator.validate(rule);

console.log(ExpressionDebugger.format(rule));

if (!validation.valid) {
  console.warn(validation.errors.join("\n"));
}
```

## Building expressions

- `ExpressionBuilder` enforces required metadata (`id`, `name`, `description`, combination operator, operations) and exposes helpers to manipulate metadata, tags, category, priority, author, and version.
- `add`, `addMany`, `if`, `switch`, `all`, `any`, `and`, `or`, `not` decide how the root logical operator behaves.
- Short-hands in `src/builder/short-hand.ts` (`Ops`, `Compare`, `MathOps`, `Logic`, `Str`, `Arr`, `Is`, `Obj`, `DateTime`, `bin`, `iff`, `when`, `$`, `BuilderFactory`) keep schemas readable without touching raw JSON.
- Builders can be cloned (`clone()`), loaded from existing schemas (`fromSchema`), validated strictly via the bundled `@fajarnugraha37/validator` schema, and serialized (`toJSON`, `summary`).

## Analyzer, validator, and debugger

- `ExpressionAnalyzer` extracts variables, literals, references, calculates a weighted complexity score, detects circular references, and can emit human-readable summaries.
- `ExpressionValidator` catches malformed operations early (unknown operators, invalid arity, missing metadata, etc.) and also warns when expressions become too complex.
- `ExpressionDebugger` pretty-prints nested operations and generates trace strings for logging or UI previews.
- `ExpressionOptimizer` contains constant-folding stubs—extend it in your project to rewrite expressions before you publish them.

## Evaluator

The evaluator sits on top of [`json-logic-engine`](https://github.com/CacheControl/json-logic-engine) and exposes:

- LRU+TTL caching for compiled functions (`@fajarnugraha37/cache`), with per-expression cache keys that include version plus a hash of the schema payload.
- Timeouts, recursion depth limits, async/sync mode, debug logging, and metadata (execution time, operation count, cache hits/misses).
- Module and keyword injection: `addKeyword`, `addSyncModule`, and `addAsyncModule` let you expose custom helpers to expressions without recompiling everything.

`evaluate`, `evaluateMany`, and `evaluateOrThrow` accept an `ExecutionContext` (`data`, `variables`, `functions`, `metadata`, `parent`) so you can pass user-defined helpers to expressions safely.

## Errors

Custom errors live in `src/error` and extend `@fajarnugraha37/common`'s `HttpError`:

- `ExpressionValidationError` – builder/validator feedback.
- `EvaluationError` – runtime issues surfaced by the evaluator.
- `TimeoutError` – thrown when evaluation exceeds the configured timeout.

## Scripts

| Command | Description |
| --- | --- |
| `bun run build` | Clean `dist/`, run `tsc`, then bundle via `tsup`. |
| `bun run test` | Execute `packages/expression/tests/*.test.ts`. |
| `bun run test:watch` | Watch mode for rapid iteration. |
| `bun run coverage:view` | Open the Bun coverage report (ensure a test run has generated `coverage/`). |

This package depends on `@fajarnugraha37/common`, `@fajarnugraha37/validator`, `@fajarnugraha37/cache`, and `json-logic-engine`. When hacking on it inside the monorepo, change those dependencies first and re-run the expression tests to verify the full pipeline.
