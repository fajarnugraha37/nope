# @fajarnugraha37/error

> Runtime-agnostic error handling library with structured errors, adapters, and validation support for Bun, Node.js, and browsers.

[![npm version](https://badge.fury.io/js/@fajarnugraha37%2Ferror.svg)](https://www.npmjs.com/package/@fajarnugraha37/error)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

✅ **Runtime Agnostic** – Works seamlessly on Bun, Node.js (18+), and modern browsers  
✅ **Zero Dependencies** – Core library has no dependencies  
✅ **Tree-Shakable** – Only bundle what you use  
✅ **Small Bundle** – < 3.5 KB gzipped for core  
✅ **Type-Safe** – Full TypeScript support with strict types  
✅ **Rich Metadata** – Error codes, severity, status, tags, data, and more  
✅ **RFC 9457** – Problem Details for HTTP APIs support  
✅ **Validation** – Built-in validation error handling with Zod, TypeBox, AJV adapters  
✅ **Result Type** – Functional error handling with `Result<T, E>`  
✅ **Framework Adapters** – Express, Fastify, Koa, Hono, H3, Elysia, GraphQL  
✅ **Observability** – OpenTelemetry and Sentry bridges  
✅ **Security** – Built-in redaction for sensitive data  
✅ **Stack Normalization** – Consistent stack traces across runtimes

---

## Quick Start

### Installation

```bash
# Bun
bun add @fajarnugraha37/error

# npm
npm install @fajarnugraha37/error

# pnpm
pnpm add @fajarnugraha37/error

# yarn
yarn add @fajarnugraha37/error
```

### 60-Second Examples

#### Bun + Hono

```typescript
import { Hono } from "hono";
import { error } from "@fajarnugraha37/error";
import { honoErrorHandler } from "@fajarnugraha37/error/adapters/hono";

const app = new Hono();

app.get("/boom", () => {
  throw error("db/timeout", "Database connection timed out", {
    status: 503,
    retryable: true,
    data: { host: "db.example.com" },
  });
});

app.onError(honoErrorHandler());

export default app;
```

#### Node.js + Express

```typescript
import express from "express";
import { wrap } from "@fajarnugraha37/error";
import { expressErrorHandler } from "@fajarnugraha37/error/adapters/express";

const app = express();

app.get("/users/:id", async (req, res, next) => {
  try {
    const user = await getUser(req.params.id);
    res.json(user);
  } catch (e) {
    next(wrap(e, "user/fetch-failed", { status: 500 }));
  }
});

app.use(expressErrorHandler());
```

#### Browser + Fetch

```typescript
import { error } from "@fajarnugraha37/error";
import { toResponse } from "@fajarnugraha37/error/adapters/web";

async function handleRequest(request: Request): Promise<Response> {
  const token = request.headers.get("Authorization");

  if (!token) {
    const err = error("auth/missing-token", "Authorization token required", {
      status: 401,
    });
    return toResponse(err);
  }

  // ... rest of logic
}
```

---

## Core API

### AppError

```typescript
import { error, wrap, fromUnknown, isAppError } from "@fajarnugraha37/error";

// Create structured error
const err = error("payment/declined", "Card was declined", {
  status: 402,
  severity: "error",
  retryable: true,
  tags: ["payment", "stripe"],
  data: { cardLast4: "1234", code: "card_declined" },
});

// Wrap existing errors
try {
  await riskyOperation();
} catch (e) {
  throw wrap(e, "operation/failed", { status: 500 });
}

// Convert unknown to AppError
const appErr = fromUnknown(unknownError);

// Type guard
if (isAppError(err)) {
  console.log(err.code); // "payment/declined"
}
```

### AppError Fields

| Field       | Type                                 | Description                          |
| ----------- | ------------------------------------ | ------------------------------------ |
| `code`      | `string`                             | Machine-readable error code          |
| `message`   | `string`                             | Human-readable error message         |
| `id`        | `string`                             | UUID v7 (time-ordered)               |
| `timestamp` | `number`                             | Unix timestamp (ms)                  |
| `severity`  | `'info' \| 'warn' \| 'error' \| 'fatal'` | Error severity level                 |
| `status`    | `number?`                            | HTTP status code                     |
| `retryable` | `boolean`                            | Whether operation can be retried     |
| `tags`      | `string[]`                           | Tags for categorization/filtering    |
| `data`      | `unknown?`                           | Additional error context             |
| `cause`     | `unknown?`                           | Original error (for wrapping)        |
| `stack`     | `string?`                            | Normalized stack trace               |

### Result Type

```typescript
import { ok, err, safeAwait, unwrap } from "@fajarnugraha37/error";

// Manual result creation
const success = ok(42);
const failure = err(error("calculation/failed"));

// Safe async operations
async function fetchUser(id: string) {
  const [err, user] = await safeAwait(fetch(`/users/${id}`));

  if (err) {
    console.error("Failed to fetch user:", err.message);
    return null;
  }

  return user;
}

// Unwrap or throw
const value = unwrap(result); // throws if error
```

### Assert

```typescript
import { assert } from "@fajarnugraha37/error";

// Throws AppError if condition is false
assert.ok(user.age >= 18, "user/underage", "User must be 18 or older");

assert.defined(config.apiKey, "config/missing", "API key is required");

assert.type(value, "string", "validation/type", "Expected string value");

assert.fail("not-implemented", "This feature is not yet implemented");
```

### Pattern Matching

```typescript
import { match } from "@fajarnugraha37/error";

const result = match(error, {
  "db/timeout": (err) => retry(err),
  "db/connection": (err) => reconnect(err),
  "auth/expired": (err) => refreshToken(err),
  _: (err) => logAndThrow(err), // fallback
});
```

### Formatting

```typescript
import { format, formatOneLine } from "@fajarnugraha37/error";

// Short format
console.log(formatOneLine(err));
// [payment/declined] Card was declined

// Verbose format
console.log(format(err, { stack: true }));
// AppError: payment/declined
// Message: Card was declined
// ID: 01234567-89ab-cdef-0123-456789abcdef
// Severity: error
// ...
```

---

## Problem Details (RFC 9457)

```typescript
import { toProblem, fromProblem } from "@fajarnugraha37/error";

const err = error("not-found", "Resource not found", { status: 404 });

// Convert to Problem Details
const problem = toProblem(err);
// {
//   type: "urn:error:not-found",
//   title: "not-found",
//   status: 404,
//   detail: "Resource not found",
//   instance: "01234567-...",
//   severity: "error"
// }

// Convert from Problem Details
const restored = fromProblem(problem);
```

### HTTP Response Mapping

| Severity | Default Status | Use Case                     |
| -------- | -------------- | ---------------------------- |
| `info`   | 200            | Informational responses      |
| `warn`   | 400            | Client warnings              |
| `error`  | 500            | Server errors                |
| `fatal`  | 500            | Critical failures            |

Custom status codes override defaults via the `status` option.

---

## Validation

```typescript
import {
  makeValidationError,
  fromZodError,
  type ValidationIssue,
} from "@fajarnugraha37/error/validation";

// Manual validation errors
const issues: ValidationIssue[] = [
  {
    path: ["user", "email"],
    code: "invalid_email",
    message: "Invalid email format",
  },
  {
    path: ["user", "age"],
    code: "too_small",
    message: "Age must be at least 18",
  },
];

const err = makeValidationError(issues, { status: 422 });

// Zod integration
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  age: z.number().min(18),
});

try {
  schema.parse(data);
} catch (zodError) {
  throw fromZodError(zodError);
}
```

### Validation Adapters

- **Zod**: `fromZodError(zodError)`
- **TypeBox**: `fromTypeboxError(errors)`
- **AJV**: `fromAjvError(errors)`

All converters produce `AppError` with `code: "validation/failed"` and normalized issues.

---

## Framework Adapters

### Express

```typescript
import { expressErrorHandler, asyncHandler } from "@fajarnugraha37/error/adapters/express";

app.get("/users/:id", asyncHandler(async (req, res) => {
  const user = await getUser(req.params.id);
  res.json(user);
}));

app.use(expressErrorHandler());
```

### Fastify

```typescript
import { fastifyErrorHandler } from "@fajarnugraha37/error/adapters/fastify";

const fastify = Fastify();
fastifyErrorHandler(fastify);
```

### Koa

```typescript
import { koaErrorMiddleware } from "@fajarnugraha37/error/adapters/koa";

app.use(koaErrorMiddleware());
```

### Hono

```typescript
import { honoErrorHandler } from "@fajarnugraha37/error/adapters/hono";

app.onError(honoErrorHandler());
```

### H3 (Nuxt/Nitro)

```typescript
import { h3ErrorHandler } from "@fajarnugraha37/error/adapters/h3";

export default defineEventHandler((event) => {
  return h3ErrorHandler()(event);
});
```

### Elysia

```typescript
import { elysiaErrorHandler } from "@fajarnugraha37/error/adapters/elysia";

new Elysia()
  .onError(elysiaErrorHandler())
  .listen(3000);
```

### GraphQL

```typescript
import { toGraphQLError } from "@fajarnugraha37/error/adapters/graphql";

const resolvers = {
  Query: {
    user: (_, { id }) => {
      try {
        return getUser(id);
      } catch (e) {
        throw toGraphQLError(fromUnknown(e));
      }
    },
  },
};
```

---

## Observability

### OpenTelemetry

```typescript
import { trace } from "@opentelemetry/api";
import { recordException } from "@fajarnugraha37/error/observability/otel";

const span = trace.getActiveSpan();

try {
  await operation();
} catch (e) {
  const err = fromUnknown(e);
  recordException(span, err, { "service.name": "api" });
  throw err;
}
```

### Sentry

```typescript
import * as Sentry from "@sentry/node";
import { toSentryEvent, getSentryFingerprint } from "@fajarnugraha37/error/observability/sentry";

try {
  await operation();
} catch (e) {
  const err = fromUnknown(e);
  const event = toSentryEvent(err);
  event.fingerprint = getSentryFingerprint(err);
  Sentry.captureEvent(event);
}
```

---

## Security & Redaction

```typescript
import { redact, safeStringify } from "@fajarnugraha37/error";

const data = {
  username: "alice",
  password: "secret123",
  apiToken: "xyz",
};

const safe = redact(data);
// { username: "alice", password: "[REDACTED]", apiToken: "[REDACTED]" }

const json = safeStringify(data);
// Handles circular refs, truncates large objects, redacts sensitive keys
```

**Default sensitive patterns:**
- `/pass(word)?/i`
- `/token/i`
- `/secret/i`
- `/authorization/i`
- `/api[_-]?key/i`
- `/private[_-]?key/i`

Custom redaction:

```typescript
const redacted = redact(data, (keyPath) => {
  const key = keyPath[keyPath.length - 1];
  return key === "ssn" || key === "creditCard";
});
```

---

## Exports Map

The library uses conditional exports for optimal tree-shaking:

```javascript
// Core
import { error } from "@fajarnugraha37/error";
import { ok, err } from "@fajarnugraha37/error/result";
import { assert } from "@fajarnugraha37/error/assert";
import { format } from "@fajarnugraha37/error/format";
import { toProblem } from "@fajarnugraha37/error/problem";
import { makeValidationError } from "@fajarnugraha37/error/validation";

// Adapters
import { toResponse } from "@fajarnugraha37/error/adapters/web";
import { expressErrorHandler } from "@fajarnugraha37/error/adapters/express";
import { fastifyErrorHandler } from "@fajarnugraha37/error/adapters/fastify";
import { koaErrorMiddleware } from "@fajarnugraha37/error/adapters/koa";
import { honoErrorHandler } from "@fajarnugraha37/error/adapters/hono";
import { h3ErrorHandler } from "@fajarnugraha37/error/adapters/h3";
import { elysiaErrorHandler } from "@fajarnugraha37/error/adapters/elysia";
import { toGraphQLError } from "@fajarnugraha37/error/adapters/graphql";

// Observability
import { recordException } from "@fajarnugraha37/error/observability/otel";
import { toSentryEvent } from "@fajarnugraha37/error/observability/sentry";
```

### ESM / CJS / Browser

The library supports all module systems:

```typescript
// ESM (preferred)
import { error } from "@fajarnugraha37/error";

// CommonJS
const { error } = require("@fajarnugraha37/error");

// Browser (via bundler - Vite, Webpack, etc.)
import { error } from "@fajarnugraha37/error";
```

---

## FAQ

### Why a single package instead of multiple packages?

- **Simpler dependency management** – One version to track
- **Better tree-shaking** – Bundlers can eliminate unused code
- **Consistent types** – No version mismatches between packages
- **Easier maintenance** – Single source of truth

### How do I use this with TypeScript strict mode?

The library is built with `strict: true` and all public APIs are fully typed with no `any`. Enable strict mode in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

### Do I need to install peer dependencies?

No! Adapters use type-only imports and runtime checks. Install only what you use:

```bash
# Only if using Express adapter
bun add express

# Only if using Zod validation
bun add zod
```

### How does stack normalization work?

The library detects the runtime (Bun/Node/Browser) and:
- Normalizes line endings
- Filters internal frames (node_modules, library internals)
- Limits stack frames (default: 50)
- Applies source maps (Bun, browser)

### Can I extend AppError?

Yes, but you'll lose the freezing behavior. Better approach:

```typescript
function createPaymentError(code: string, message: string, data?: unknown) {
  return error(`payment/${code}`, message, {
    status: 402,
    tags: ["payment"],
    data,
  });
}
```

### How do I debug errors in production?

Use the error `id` (UUID v7) for correlation:

```typescript
const err = error("api/failed", "Request failed");
console.error(`Error ${err.id} occurred at ${new Date(err.timestamp)}`);

// In logs/monitoring, search by ID
logger.error({ errorId: err.id, ...err.toJSON() });
```

---

## Performance Notes

- **Lazy stack capture**: Set `captureStack: false` for high-volume errors
- **Redaction bounds**: Max depth 10, max size 1000 items
- **Stack truncation**: Limits to 50 frames by default
- **Frozen instances**: Prevents accidental mutations

---

## License

MIT © Fajar Nugraha

---

## Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

---

## Links

- [GitHub Repository](https://github.com/fajarnugraha37/nope)
- [npm Package](https://www.npmjs.com/package/@fajarnugraha37/error)
- [Issues](https://github.com/fajarnugraha37/nope/issues)

---

**Made with ❤️ for developers who care about error handling.**