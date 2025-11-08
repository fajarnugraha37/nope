# nope

_Normalized Ops & Predicate Ecosystem_

> Bun-first toolchain for building, validating, and executing portable expressions with a supporting set of async, caching, and reactive utilities.

## Highlights
- Multi-package Bun workspace where `@fajarnugraha37/expression` sits on top of reusable validators, caches, and shared helpers.
- Batteries-included developer UX: Bun test runner, tsup builds, Changesets for releases, and workspace linking by default.
- Every package ships typed source, ESM/CJS bundles, and `bun test` coverage so you can embed pieces individually or wire them together.
- Shared utilities avoid duplication: `@fajarnugraha37/validator` uses the caching primitives, the expression builder reuses the validator, and the reactive helpers lean on `@fajarnugraha37/common`.

## Packages
| Name | npm | Folder | Purpose |
| --- | --- | --- | --- |
| `@fajarnugraha37/expression` | [![npm](https://img.shields.io/npm/v/@fajarnugraha37/expression.svg)](https://www.npmjs.com/package/@fajarnugraha37/expression) | `packages/expression` | Expression schema types, fluent builders, analyzers, and the json-logic powered evaluator with caching plus debugging helpers. |
| `@fajarnugraha37/validator` | [![npm](https://img.shields.io/npm/v/@fajarnugraha37/validator.svg)](https://www.npmjs.com/package/@fajarnugraha37/validator) | `packages/validator` | AJV-based schema registry with a fluent builder DSL, JSON import/export helpers, cache-aware schema loading, and shortcuts for type-specific validators. |
| `@fajarnugraha37/pattern-matching` | [![npm](https://img.shields.io/npm/v/@fajarnugraha37/pattern-matching.svg)](https://www.npmjs.com/package/@fajarnugraha37/pattern-matching) | `packages/pattern-matching` | Type-safe pattern matching primitives with ergonomic collection guards and recursive helpers. |
| `@fajarnugraha37/common` | [![npm](https://img.shields.io/npm/v/@fajarnugraha37/common.svg)](https://www.npmjs.com/package/@fajarnugraha37/common) | `shareds/common` | Typed errors, ULID helpers, guards, regex/string utilities, and structural object helpers shared everywhere else. |
| `@fajarnugraha37/cache` | [![npm](https://img.shields.io/npm/v/@fajarnugraha37/cache.svg)](https://www.npmjs.com/package/@fajarnugraha37/cache) | `shareds/cache` | LRU+TTL caches, singleflight, memoization, idempotent execution helpers, and read-through/write-through adapters. |
| `@fajarnugraha37/async` | [![npm](https://img.shields.io/npm/v/@fajarnugraha37/async.svg)](https://www.npmjs.com/package/@fajarnugraha37/async) | `shareds/async` | Concurrency primitives (channels, semaphores, thread pools), event emitters, async iterators, and resilient `try/retry` utilities. |
| `@fajarnugraha37/reactive` | [![npm](https://img.shields.io/npm/v/@fajarnugraha37/reactive.svg)](https://www.npmjs.com/package/@fajarnugraha37/reactive) | `shareds/reactive` | Observable/Stream implementation with plugins, operators (map/combine/throttle/…), and immutable state helpers on top of `limu`. |
| `apps/*` | — | `apps` | Reserved for demo or integration apps that consume the workspace packages. |

## Repository layout
| Path | Notes |
| --- | --- |
| `packages/` | Feature-facing packages (currently `expression` and `validator`). |
| `shareds/` | Foundational libraries that are versioned just like packages but grouped under a single folder. |
| `apps/` | Example/front-end consumers (empty today). |
| `scripts/` | Reusable automation (CI, release, validation). |
| `.github/` | Actions workflows for validation/publish (mirrors the `action:*` scripts). |
| `tsconfig.json`, `tsup.config.ts`, `bunfig.toml` | Shared TypeScript + build configuration. |

## Installation

Each package is published to npm and can be installed individually:

```bash
# Node.js with npm
npm install @fajarnugraha37/expression
npm install @fajarnugraha37/validator
npm install @fajarnugraha37/pattern-matching
npm install @fajarnugraha37/common
npm install @fajarnugraha37/cache
npm install @fajarnugraha37/async
npm install @fajarnugraha37/reactive

# Node.js with pnpm
pnpm add @fajarnugraha37/expression

# Node.js with yarn
yarn add @fajarnugraha37/expression

# Bun
bun add @fajarnugraha37/expression

# Deno
deno add npm:@fajarnugraha37/expression
```

See individual package READMEs for detailed usage instructions.

## Quick start (for contributors)
1. Install [Bun ≥ 1.1](https://bun.sh) and Node ≥ 18 (Node is only required for some tooling).
2. Install dependencies once from the repo root:

   ```bash
   bun install
   ```

3. Pick a package, then run its scripts either with `bun run --filter` or by `cd`-ing into the folder.

   ```bash
   # Build and test the expression engine
   bun run --filter @fajarnugraha37/expression build
   bun run --filter @fajarnugraha37/expression test

   # Same idea for the validator
   cd packages/validator && bun run test
   ```

## Developing packages
- **Build:** `bun run --filter <package> build` runs `tsc` + `tsup` for that workspace (each package publishes ESM, CJS, and `.d.ts` files).
- **Test:** `bun run --filter <package> test` executes the Bun test suite under `tests/`. Use `bun run --filter <package> test:watch` for focused runs.
- **Coverage:** open the HTML report with `bun run --filter <package> coverage:view` after a test run.
- **Cross-package links:** Bun automatically links workspace dependencies (for example `@fajarnugraha37/expression` depends on `@fajarnugraha37/validator`, which in turn depends on `@fajarnugraha37/cache` and `@fajarnugraha37/common`).

When making sweeping changes it is handy to run every test suite:

```bash
bun workspaces run test        # Bun ≥ 1.1
# or manually iterate
for pkg in packages/* shareds/*; do (cd "$pkg" && bun test); done
```

## Release & publishing
This repo uses [Changesets](https://github.com/changesets/changesets):

```bash
bunx changeset          # choose the packages to bump
bun run version         # applies the version + changelog updates
bun run release         # publishes (CI uses the same action)
```

CI workflows live in `.github/workflows` and can be executed locally with the `action:*` scripts via [`act`](https://github.com/nektos/act).

## Conventions
- All source is TypeScript (`"type": "module"` everywhere) and compiled through `tsup`.
- Tests live next to the package under `tests/*.test.ts` and use Bun's `bun:test` runner.
- Keep README files in sync with the code (this document summarizes the whole workspace; each package ships its own README for deep dives).
- Prefer the shared helpers in `@fajarnugraha37/common`, `@fajarnugraha37/cache`, and `@fajarnugraha37/async` instead of re-implementing them inside feature packages.




