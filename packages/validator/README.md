# nope-utils
> Like a Swiss Army knife, except the blades are TypeScript generics and one of them yells "nope" when you reach for `any`.

`nope-utils` is the pile of helpers I kept copy-pasting between repos until the linter staged an intervention. It targets modern Node.js and Bun, ships both ESM and CJS bundles, and sprinkles type definitions everywhere so your editor can whisper sweet completions while you refactor questionable life choices.

## Why the "nope"?
- Because each utility exists to avoid muttering "nope, not rewriting that for the fifth time."
- Because many helpers guard you from footguns (see: proxy wrappers, guard builders, retry helpers).
- Because `yes-utils` sounded suspiciously optimistic.

## Install (choose your fighter)
```sh
# npm
npm install @fajarnugraha37/nope-utils

# bun
bun add @fajarnugra37/nope-utils

# pnpm (for the workspace enjoyers)
pnpm add @fajarnugra37/nope-utils
```

## Lightning demo
```ts
import {
  nanoid,
  deepClone,
  flattenObject,
  sleep,
  TimeUnit,
  convertRoleArnToAssumedRoleArn,
  isAssumedRoleArn,
} from "@fajarnugraha37/nope-utils";

const user = { id: nanoid(), roles: ["admin", "coffee-dealer"] };
const copy = deepClone(user); // same vibes, different reference

const flat = flattenObject({ meta: { region: "us-east-1", env: "prod" } });
// { "meta.region": "us-east-1", "meta.env": "prod" }

await sleep(500, TimeUnit.Milliseconds); // good night, event loop

const sessionArn = convertRoleArnToAssumedRoleArn(
  "arn:aws:iam::123456789012:role/Admin",
  "cli-session"
);
console.log(isAssumedRoleArn(sessionArn)); // true, obviously
```

## Validator toolkit (`@nope/validator`)
The validator package graduated from "AJV wrapper" to a full schema orchestration layer. It now ships a fluent builder, JSON import/export helpers, and an opt-in LRU cache (powered by `@nope/cache`) so you can hydrate schemas from a database, keep hot ones in memory, and spit them back out as JSON when you need to persist them again.

### Feature highlights
- Fluent builder (`Validator.builder()` / `validatorBuilder()`) with chainable options, schema registration, JSON ingestion, caching, and lazy loaders.
- Fluent JSON Schema builder (`SchemaBuilder`) plus helpers like `defineSchemas`/`buildSchemaMap` for crafting schemas in code.
- JSON import/export (`importSchemasFromJSON`, `exportSchemas`, `exportSchemasToJSON`) for piping schemas in/out of storage or migrations.
- Async validation APIs (`validateAsync`, `validateStrictAsync`, `validateManyAsync`) that automatically pull schemas via a user-provided loader.
- Built-in LRU caching so dynamic schemas fetched from a DB or config service only pay the compilation cost once.
- Shortcut helpers (`createValidatorFromJSON`, `createTypeValidatorFromJSON`) for one-liners in scripts/tests.

### Fluent builder in action
```ts
import { Validator } from "@nope/validator";

const validator = Validator.builder()
  .withOptions({ coerceTypes: true })
  .withCache({ maxEntries: 500, ttlMs: 5 * 60 * 1000 })
  .fromJSON({
    "expression-schema": {
      type: "object",
      required: ["type", "value"],
      properties: {
        type: { type: "string", enum: ["literal", "ref"] },
        value: { type: ["string", "number", "boolean", "object"] }
      }
    }
  })
  .build();

const data = await validator.validateStrictAsync("expression-schema", payload);
```

### Import/export workflows
```ts
const snapshot = validator.exportSchemas(["expression-schema"]);
await saveToDb(snapshot); // persist object form

const jsonDump = validator.exportSchemasToJSON(undefined, 0);
await saveToDb({ jsonDump }); // or persist the JSON string

validator.importSchemasFromJSON(jsonDump); // load it back later
```

### Runtime loaders + helpers
```ts
import {
  createValidatorFromJSON,
  createTypeValidatorFromJSON,
  createValidatorFromBuilders,
  createTypeValidatorFromBuilders,
  defineSchemas,
  validatorBuilder,
  SchemaBuilder
} from "@nope/validator";

// Loader-driven validator with caching baked in
const loaderBacked = validatorBuilder()
  .withCache({ maxEntries: 200, ttlMs: 60_000 })
  .withSchemaLoader(async (type) => fetchSchemaFromDatabase(type))
  .build();

const dynamic = await loaderBacked.validateAsync("form-schema", input);

// One-liners when your schemas already live in JSON
const adHocValidator = createValidatorFromJSON(schemaDump, {
  cache: { maxEntries: 50 },
  options: { removeAdditional: "failing" }
});

const expressionValidator = createTypeValidatorFromJSON(
  "expression-schema",
  schemaDump
);

// Fluent schema builder DX
const schemas = defineSchemas({
  "expression-schema": SchemaBuilder.object()
    .title("Expression")
    .description("Composable expression definition")
    .property("type", SchemaBuilder.string().enum(["literal", "ref"]), {
      required: true
    })
    .property(
      "value",
      SchemaBuilder.create().anyOf(
        SchemaBuilder.string(),
        SchemaBuilder.number(),
        SchemaBuilder.boolean(),
        SchemaBuilder.object().property("path", SchemaBuilder.string(), {
          required: true
        })
      )
    )
    .additionalProperties(false),
  "form-schema": SchemaBuilder.object()
    .property("id", SchemaBuilder.string(), { required: true })
    .property(
      "steps",
      SchemaBuilder.array()
        .items(SchemaBuilder.object().property("title", SchemaBuilder.string()))
        .minItems(1),
      { required: true }
    )
    .additionalProperties(false)
});

const validator = createValidatorFromBuilders(schemas, {
  cache: { maxEntries: 250, ttlMs: 30_000 }
});

const formValidator = createTypeValidatorFromBuilders(
  "form-schema",
  schemas
);
```

## Import cheat sheet
The package publishes both a bundled entry point and per-folder subpaths. Thanks to the `exports` map in `package.json`, you can import just what you need without spelunking through `dist/`.

| Import path | What you get | Headliners |
| --- | --- | --- |
| `@fajarnugra37/nope-utils` | Core exports wired up in `src/index.ts` | Object helpers, string helpers, time helpers |
| `@fajarnugra37/nope-utils/object` | Everything from `src/object/index.ts` | `deepClone`, `flattenObject`, `groupBy`, smart proxy builders (`observeProxy`, `defaultsProxy`, `lazyProxy`, `trackPaths`) |
| `@fajarnugra37/nope-utils/string` | `src/string/index.ts` exports | ARN surgery (`splitArnParts`), principal detection (`isAssumedRoleArn`, `isServicePrincipal`), converters |
| `@fajarnugra37/nope-utils/time` | `src/time/index.ts` exports | `TimeUnit`, `fromMills`, `toMills`, abortable `sleep`, `nowMono` |
| `@fajarnugra37/nope-utils/cache` | `src/cache/index.ts` exports | `LruTtlCache`, `Singleflight`, keyed locks, idempotency wrappers, loading caches, memoize with SWR, write-through adapters |
| `@fajarnugra37/nope-utils/concurrency` | `src/concurrency/index.ts` exports | Async `Channel`, `defer` helpers, debouncers, throttlers, `JobQueue`, `Mutex`, `Semaphore`, worker `ThreadPool` |
| `@fajarnugra37/nope-utils/emitter` | `src/emitter/index.ts` exports | Tiny event emitter, typed event bus, factory helpers |
| `@fajarnugra37/nope-utils/error` | `src/error/index.ts` exports | HTTP-ish error classes (`HttpError`, `NotFoundError`, `ConflictError`, `ValidationError`) |
| `@fajarnugra37/nope-utils/file` | `src/file/index.ts` exports | `readRelativeFile` helpers for ESM, CJS, and mixed environments |
| `@fajarnugra37/nope-utils/is` | `src/is/index.ts` exports | Predicate builders for async checks, combinators (`every`, `some`), primitive guards, function introspection |
| `@fajarnugra37/nope-utils/regex` | `src/regex/index.ts` exports | AMQP pattern builders, named capture helpers, wildcard utilities, frequently-used expressions |
| `@fajarnugra37/nope-utils/try` | `src/try/index.ts` exports | Result-style wrappers, async retry with backoff, timeout combinators, safe collection helpers |
| `@fajarnugra37/nope-utils/cache/memoize` | Direct file export via wildcard mapping | Promise-aware memoizer with TTL, jitter, stale-while-revalidate, optional error caching |
| `@fajarnugra37/nope-utils/cache/loading-cache` | Direct file export | Async `LoadingCache` wrapper with stampede protection |
| `@fajarnugra37/nope-utils/guard/ensure` | Guard helpers (index is intentionally empty, import the files you need) | Fail-fast `ensureArray`, `ensureNonEmptyString`, `ensureShape`, etc. |
| `@fajarnugra37/nope-utils/guard/asserts` | Assertion helpers pairing with the guard types | Type-narrowing assertions with custom error factories |
| `@fajarnugra37/nope-utils/generator/basics` | Streaming helpers for iterables | Range generators, chunking, take/drop utilities |
| `@fajarnugra37/nope-utils/generator/collectors` | Generator collectors | `toArray`, `toSet`, `toMap` pipes |
| `@fajarnugra37/nope-utils/generator/tee` | Generator splitters | Clone async generators without weeping |

> Tip: any file under `src/` is consumable through the wildcard export map. If a folder does not re-export everything via an `index.ts` (looking at you, `guard` and `generator`), import the specific file path instead.

## Folder safari (aka "what lives where")
- `src/cache` - In-memory caches with TTL, LRU eviction, singleflight dedupe, memoizers, write-through shims, and keyed locks for fine-grained exclusion.
- `src/concurrency` - Channels, lightweight mutex/semaphore primitives, throttling/debouncing, promise deferrers, job queues, and a tiny worker pool.
- `src/emitter` - Zero-dependency event emitters and buses with typed factories for strongly-typed payloads.
- `src/error` - Opinionated error classes with status codes and helpers that play nice with HTTP handlers.
- `src/file` - `readRelativeFile` variants that Just Work whether you are in ESM, CJS, Bun, or something cursed in between.
- `src/generator` - Utility belts for sync/async iterables: create ranges, fork streams, sort lazily, and collect results without temporary arrays.
- `src/guard` - Guard builders (`ensure`, `asserts`, `guard.ts`) that pair with the predicates in `src/is` for ergonomic runtime validation.
- `src/is` - A full zoo of predicates: async versions, logical combinators, function guards, primitive checks, and structural shape testers.
- `src/object` - Cloners (deep, shallow, structured), LRU-friendly serializers, flatten/unflatten pairs, aggregation helpers, and nine different Proxy traps for your inner control freak.
- `src/regex` - Composable regex fragments, wildcard globbers, AMQP routing key utilities, and matching helpers with named group extraction.
- `src/string` - AWS-focused text helpers including ARN parsing, principal detection, and assumed-role converters (plus some ID utilities hiding in the wings).
- `src/time` - `TimeUnit` math, monotonic timestamps, and abortable sleeps that respect `AbortSignal`.
- `src/try` - Result-style utilities, retry/backoff wrappers, timeout combinators, and collection helpers built around `tryCatch`.

### Usage Examples
For detailed usage examples of all utility functions, refer to the comprehensive test suite in the `/tests` folder. Each test file demonstrates real-world usage patterns:

- `tests/cache.test.ts` - LRU/TTL cache usage, memoization patterns, loading cache examples
- `tests/concurrency.test.ts` - Channel operations, mutex/semaphore usage, job queue examples  
- `tests/object.test.ts` - Deep cloning, object flattening, proxy wrapper examples
- `tests/string.test.ts` - ARN parsing, principal validation, ID generation examples
- `tests/time.test.ts` - Time unit conversions, sleep functions, timestamp utilities
- `tests/error.test.ts` - HTTP error handling patterns and validation examples
- `tests/file.test.ts` - Cross-platform file reading for ESM/CJS environments
- `tests/generator.test.ts` - Iterator helpers, streaming operations, collection examples
- `tests/is_guard.test.ts` - Runtime validation, type assertions, shape checking examples
- `tests/regex.test.ts` - Pattern building, wildcard matching, AMQP routing examples
- `tests/try.test.ts` - Error-safe wrappers, retry logic, timeout handling examples

The test files serve as both validation and documentation, showing practical implementation patterns for each utility.
## Scripts worth remembering
- `bun run build` - Generate fresh CJS and ESM bundles under `dist/`.
- `bun run build:cjs` / `bun run build:esm` - Focus on one output format if you are iterating.

## Test Coverage
This project maintains comprehensive test coverage across all utility modules. Coverage reports are generated and stored in the `coverage/` directory.

### Running Tests
The test configuration is defined in `bunfig.toml` with coverage enabled by default:

```sh
# Run all tests with coverage (configured in bunfig.toml)
bun test
```

### Coverage Overview
```shell
------------------------------------|---------|---------|-------------------
File                                | % Funcs | % Lines | Uncovered Line #s
------------------------------------|---------|---------|-------------------
All files                           |   97.65 |   98.25 |
 src\cache\cache.ts                 |   95.24 |  100.00 | 
 src\cache\idempotency.ts           |  100.00 |  100.00 | 
 src\cache\keyed-lock.ts            |   85.71 |  100.00 | 
 src\cache\loading-cache.ts         |  100.00 |  100.00 | 
 src\cache\memoize.ts               |   84.62 |   96.67 | 12,80
 src\cache\write-through.ts         |  100.00 |  100.00 | 
 src\concurrency\autocloseable.ts   |   91.18 |   92.24 | 5-9,37-39
 src\concurrency\channel.ts         |   91.67 |   96.52 | 7-9
 src\concurrency\concurrency.ts     |  100.00 |  100.00 | 
 src\concurrency\debounce.ts        |  100.00 |   89.22 | 59-60,67-68,97-102
 src\concurrency\defer.ts           |   88.00 |  100.00 | 
 src\concurrency\job-queue.ts       |  100.00 |  100.00 | 
 src\concurrency\latch.ts           |  100.00 |  100.00 | 
 src\concurrency\mutex.ts           |   87.50 |  100.00 | 
 src\concurrency\priority-queue.ts  |  100.00 |  100.00 | 
 src\concurrency\semaphore.ts       |  100.00 |  100.00 | 
 src\concurrency\thread-pool.ts     |   95.00 |   98.31 | 78-79
 src\concurrency\throttle.ts        |  100.00 |   93.33 | 35-36,59-60
 src\emitter\emitter.ts             |  100.00 |   95.65 | 
 src\emitter\event-bus.ts           |  100.00 |  100.00 | 
 src\emitter\event-emitter.ts       |  100.00 |   97.37 | 
 src\emitter\factories.ts           |   88.89 |   92.31 | 51-53
 src\error\conflict.error.ts        |  100.00 |  100.00 | 
 src\error\http.error.ts            |  100.00 |  100.00 | 
 src\error\not-found.error.ts       |  100.00 |  100.00 | 
 src\error\validation.error.ts      |  100.00 |  100.00 | 
 src\file\read-relative-file.esm.ts |  100.00 |   92.65 | 36,60-61,84
 src\generator\basics.ts            |  100.00 |  100.00 | 
 src\generator\collectors.ts        |  100.00 |  100.00 | 
 src\generator\creators.ts          |  100.00 |  100.00 | 
 src\generator\sort.ts              |  100.00 |   92.86 | 
 src\generator\tee.ts               |  100.00 |  100.00 | 
 src\guard\asserts.ts               |  100.00 |  100.00 | 
 src\guard\ensure.ts                |  100.00 |  100.00 | 
 src\guard\guard.ts                 |  100.00 |  100.00 | 
 src\is\async.ts                    |   95.65 |   96.00 | 66-67
 src\is\combinators.ts              |  100.00 |  100.00 | 
 src\is\functions.ts                |  100.00 |  100.00 | 
 src\is\index.ts                    |  100.00 |  100.00 | 
 src\is\misc.ts                     |  100.00 |   93.22 | 28,40,52
 src\is\primitives.ts               |  100.00 |  100.00 | 
 src\object\aggregate.ts            |  100.00 |  100.00 | 
 src\object\clone.ts                |  100.00 |   94.25 | 3,6,16,19
 src\object\extras.ts               |   94.12 |   93.05 | 45-46,166,174-175,186-187,190-191,205-206,223-224
 src\object\flatten.ts              |  100.00 |  100.00 | 
 src\object\map.ts                  |   84.21 |   98.70 | 
 src\object\misc.ts                 |  100.00 |  100.00 | 
 src\object\nested.ts               |  100.00 |   92.59 | 33-34
 src\object\pairs.ts                |  100.00 |  100.00 | 
 src\object\proxy.ts                |   84.31 |   94.47 | 49,52,126,175,178,191,202,254-255,258-259
 src\object\record.ts               |  100.00 |  100.00 | 
 src\regex\amqp-extras.ts           |  100.00 |   97.94 | 119
 src\regex\amqp.ts                  |  100.00 |   98.90 | 
 src\regex\common.ts                |  100.00 |  100.00 | 
 src\regex\extras.ts                |   84.85 |   87.29 | 13,15-16,68-71,110-113,137,200,239,241-243,286-291
 src\regex\groups.ts                |  100.00 |  100.00 | 
 src\regex\match.ts                 |  100.00 |  100.00 | 
 src\regex\wildcards.ts             |  100.00 |  100.00 | 
 src\string\arn.ts                  |  100.00 |   92.73 | 66,74,76
 src\string\ids.ts                  |  100.00 |  100.00 | 
 src\string\principals.ts           |  100.00 |  100.00 | 
 src\time\common.ts                 |  100.00 |  100.00 | 
 src\try\async.ts                   |   89.19 |   92.47 | 69-73,94-97,108,128-129,166-167
 src\try\collections.ts             |   96.15 |   95.35 | 56,81,92
 src\try\misc.ts                    |  100.00 |  100.00 | 
 src\try\wrappers.ts                |  100.00 |  100.00 | 
 tests\cache.test.ts                |   98.41 |   99.18 | 90-91
 tests\concurrency.test.ts          |   97.61 |   99.11 | 159,476,495,530,578
 tests\emitter.test.ts              |  100.00 |   99.61 | 
 tests\error.test.ts                |  100.00 |  100.00 | 
 tests\file.test.ts                 |  100.00 |  100.00 | 
 tests\generator.test.ts            |  100.00 |  100.00 | 
 tests\guard.ensure.test.ts         |   95.65 |  100.00 | 
 tests\is_guard.test.ts             |   91.43 |   99.28 | 
 tests\object.proxy.test.ts         |  100.00 |  100.00 | 
 tests\object.test.ts               |   99.03 |  100.00 | 
 tests\regex.test.ts                |   93.33 |   98.08 | 115-121
 tests\string.test.ts               |  100.00 |  100.00 | 
 tests\time.test.ts                 |  100.00 |  100.00 | 
 tests\try.async.test.ts            |   97.78 |   99.20 | 
 tests\try.test.ts                  |  100.00 |  100.00 | 
------------------------------------|---------|---------|-------------------

 270 pass
 0 fail
 604 expect() calls
Ran 270 tests across 15 files. [1.92s]
```

Coverage reports can be found in `coverage/lcov.info` and help ensure reliability across all supported runtime environments.

## Development
- Target runtimes: Node.js 18.18+ or Bun 1.1.0+.
- TypeScript all the way down; `bun run build` runs the dual compilation and the `postbuild` packaging script.
- Generated artifacts live in `dist/` and stay out of git so you can ship clean diffs.

### Quality Gates & Automated Workflow

This project enforces quality gates to ensure all code changes maintain high standards:

#### Pre-commit Validation
Husky Git hooks automatically run tests before allowing commits and pushes:

```sh
# Husky hooks are automatically installed via the "prepare" script
# No manual setup required - just clone and install dependencies

# Pre-commit: runs tests on every commit
git commit -m "your changes"  # Tests must pass or commit is rejected

# Pre-push: runs full test suite + build validation before push
git push  # Full validation runs before push to remote
```

#### Build Process Validation
The build process includes automatic test validation:

- `bun run build` - Runs tests first (via `prebuild` hook), then builds if tests pass
- `prebuild` script ensures tests pass before any build artifacts are generated  
- `prepublishOnly` script runs both tests and build before publishing

#### Available Scripts
```sh
# Development
bun test              # Run all tests with coverage
bun run test:watch    # Run tests in watch mode

# Building  
bun run build         # Run tests + build both CJS and ESM
bun run build:cjs     # Build CommonJS only  
bun run build:esm     # Build ES modules only

# Git hooks (managed by Husky)
bun run prepare       # Install Husky Git hooks (auto-runs on npm install)
```

#### Continuous Integration
The project includes GitHub Actions workflows that:

- **Run tests** on multiple Bun versions for every PR and push
- **Generate coverage reports** and upload to Codecov
- **Build validation** ensures artifacts generate correctly
- **Automated publishing** to NPM on main branch (when configured)

All commits and builds will be rejected if any tests fail, ensuring the codebase remains reliable and regression-free.

## License
Released under the [MIT License](./LICENSE), which is basically the software equivalent of "Have fun, do not sue."
