# @fajarnugraha37/common

> Shared TypeScript helpers that underpin every package in the `nope` workspace: typed errors, guards, ULID utilities, regex/string helpers, object proxies, and time/file helpers.

## Modules at a glance

- **Errors (`src/error`)**
  - `HttpError`, `NotFoundError`, `ConflictError`, `InvalidDataError`, `ValidationError`.
  - `ValidationResult` + `ValidationErrorInfo` interfaces consumed by `@fajarnugraha37/validator` and `@fajarnugraha37/expression`.

- **Guard helpers (`src/guard`)**
  - `ensure*` functions that throw friendly errors when values are missing/malformed (`ensureNotNil`, `ensureArrayNonEmpty`, `ensureShape`, `coalesce*`, `unwrap`).
  - Core guard utilities (`Guard`, `toErr`) plus structural helpers (`assignIfDef`, `coalesceProps`).

- **Type guards (`src/is`)**
  - Dozens of narrowers: primitives, async checks, `isArrayOf`, tuple/union combinators, async guard helpers, `isPromiseLike`, `isAsyncFunction`, etc.
  - Works with both sync and async code paths (see `async.ts`).

- **ID + string helpers (`src/id`, `src/string`)**
  - ULID generation/validation, Crockford base32 encoding/decoding, ULID↔UUID conversion, random string helpers, ARN & AWS principal parsers, char/range utilities.

- **Object utilities (`src/object`)**
  - Deep clone/produce helpers (`limu` based), map/reduce extras, flatteners, nested property helpers, aggregation, pair utilities.
  - Proxy helpers: `observeProxy`, `readonlyProxy`, `defaultsProxy`, `validateProxy`, `lazyProxy`, `virtualRecord`, `chainProxy`, `pathTracker`.

- **Regex helpers (`src/regex`)**
  - `matchAll`, `replaceAllFn`, `splitKeep`, `anyOf`, tagged template literal `re`, curated regex collections (`rx`) and AMQP-specific patterns.

- **String utilities (`src/string`)**
  - Base encoders/decoders, random generators, Crockford constants, AWS ARN parsing/building, ASCII helpers.

- **File utilities (`src/file`)**
  - `readRelativeFile` variants (ESM, CJS) that locate fixtures relative to module URLs or `import.meta`.

- **Time utilities (`src/time`)**
  - Simple `sleep`, `nowWall`, `nowMono`, `TimeUnit` conversions.

Everything is exported from `src/index.ts`, so consumers can cherry pick:

```ts
import {
  ValidationError,
  ensureNotNil,
  observeProxy,
  wordFinder,
  ulidToUUID,
  sleep
} from "@fajarnugraha37/common";
```

## Example

```ts
import { ULID, factory as ulidFactory, ulidToUUID } from "@fajarnugraha37/common/id/ulid";
import { ensureShape } from "@fajarnugraha37/common/guard/ensure";
import { matchAll, rx } from "@fajarnugraha37/common/regex";
import { observeProxy } from "@fajarnugraha37/common/object/proxy";
import { ValidationError } from "@fajarnugraha37/common/error";

const ulid: ULID = ulidFactory();
const id = ulid();

const payload = ensureShape(
  { id, email: "user@example.com" },
  {
    id: (v): v is string => rx.uuid.test(ulidToUUID(String(v))),
    email: (v): v is string => rx.emailSimple.test(String(v)),
  },
  () => new ValidationError("Invalid payload")
);

const observed = observeProxy(payload, {
  onSet(path, value) {
    console.log("changed", path.join("."), value);
  },
});

observed.email = "new@example.com";

const tags = matchAll("alpha beta 42", /\b\w+\b/).map((hit) => hit.match);
console.log(tags);
```

## Scripts

| Command | Description |
| --- | --- |
| `bun run build` | Build ESM/CJS bundles. |
| `bun run test` | Run the suite under `shareds/common/tests`. |
| `bun run test:watch` | Watch mode. |
| `bun run coverage:view` | Inspect the coverage report. |

This package has zero runtime dependencies except [`limu`](https://github.com/tnfe/limu) and `nanoid`, so it is safe to depend on anywhere inside or outside the repo.
