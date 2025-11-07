# @nope/validator

> A typed façade over [AJV](https://ajv.js.org/) that brings schema builders, caching, and loader pipelines to the `nope` workspace.

## Features
- **Fluent builder:** `Validator.builder()` wires together AJV options, schema maps, schema loaders, and LRU caches in one chain.
- **SchemaBuilder DSL:** Compose JSON Schema objects programmatically (`SchemaBuilder.object().property("id", SchemaBuilder.string(), { required: true })`).
- **JSON import/export:** Register schemas from literal JSON/objects, then export them for persistence or tooling via `exportSchemas*`.
- **Type-specific validators:** `createTypeValidator` returns a narrowed API with strict/async variants plus batched validation (`validateMany`).
- **Cache-aware loaders:** Plug a loader (sync or async) that resolves schemas on demand while `@nope/cache` keeps compiled copies warm.
- **Shortcuts:** Helpers in `short-hand.ts` (`defineSchemas`, `buildSchemaMap`, `createValidatorFromBuilders`, …) bridge JSON, builders, and runtime validators.

## Installation

```bash
bun add @nope/validator
# or
pnpm add @nope/validator
```

The package exports both ESM and CJS builds from `dist/`.

## Quick start

```ts
import {
  SchemaBuilder,
  Validator,
  validatorBuilder,
  defineSchemas,
  buildSchemaMap,
  createValidatorFromBuilders,
} from "@nope/validator";

// 1) Describe schemas with the DSL
const schemas = defineSchemas({
  "expression-schema": SchemaBuilder.object()
    .title("Expression")
    .description("Minimal expression schema used by @nope/expression")
    .property("id", SchemaBuilder.string(), { required: true })
    .property("name", SchemaBuilder.string(), { required: true })
    .property(
      "operations",
      SchemaBuilder.array()
        .items(SchemaBuilder.object())
        .minItems(1),
      { required: true }
    )
    .additionalProperties(false),
  "form-schema": SchemaBuilder.object()
    .property("slug", SchemaBuilder.string().pattern("^[a-z0-9-]+$"), {
      required: true,
    })
    .property(
      "steps",
      SchemaBuilder.array()
        .items(
          SchemaBuilder.object()
            .property("title", SchemaBuilder.string(), { required: true })
            .property("fields", SchemaBuilder.array().items(SchemaBuilder.object()))
        )
        .minItems(1),
      { required: true }
    )
    .additionalProperties(false),
});

// 2) Build a validator with caching + options
const validator = validatorBuilder()
  .withOptions({ allErrors: true, useDefaults: true })
  .withCache({ maxEntries: 50, ttlMs: 5 * 60_000 })
  .withSchemaBuilders(schemas)
  .build();

const data = {
  slug: "signup",
  steps: [{ title: "Profile", fields: [] }],
};

// 3) Validate synchronously or asynchronously
const result = validator.validate("form-schema", data);
if (!result.valid) {
  throw result.errors;
}

const strictPayload = validator.validateStrict("form-schema", data);
console.log(strictPayload); // typed data

// 4) Export/import schemas when needed
const plainMap = buildSchemaMap(schemas);
const dump = validator.exportSchemasToJSON();
const cloned = createValidatorFromBuilders(schemas);
```

### Loading schemas on demand

```ts
const loaderBacked = Validator.builder()
  .withSchemaLoader(async (type) => {
    if (type === "step-schema") {
      return await fetchSchemaFromStore();
    }
  })
  .enableSchemaCache({ maxEntries: 20, ttlMs: 60_000 })
  .build();

await loaderBacked.validateStrictAsync("step-schema", payload);
```

### Type-specific validators

```ts
const expressionValidator = validator.createTypeValidator("expression-schema");
const validated = await expressionValidator.validateStrictAsync(payload);

// Or create one straight from JSON definitions
const typeValidator = createTypeValidatorFromJSON(
  "form-schema",
  {
    "form-schema": plainMap["form-schema"],
  }
);

typeValidator.validateStrict({ slug: "checkout", steps: [{ title: "Start" }] });
```

## Helper exports

- `SchemaBuilder.*` – `object`, `array`, `string`, `number`, `boolean`, `definitions`, `allOf/anyOf/oneOf`, conditional schemas, metadata (`title`, `description`, `examples`, …).
- `Validator` – register schemas/builders, enable caches, provide loaders, import/export JSON, validate arrays (`validateMany*`), add ad-hoc keywords (`addCustomValidation`).
- `defineSchemas`, `buildSchemaMap`, `createValidatorFromJSON`, `createValidatorFromBuilders`, `createTypeValidatorFromJSON`, `createTypeValidatorFromBuilders`, `validatorBuilder` – ergonomic helpers defined in `src/short-hand.ts`.
- `defaultValidator` – a ready-to-use validator with a small cache for lightweight scenarios.

Internally the package uses `@nope/cache`'s `LruTtlCache` to store raw schemas and compiled AJV validators, and surfaces failures through `ValidationError` from `@nope/common`.

## Scripts

| Command | Description |
| --- | --- |
| `bun run build` | `tsc` + `tsup` build. |
| `bun run test` | Execute `tests/validator.test.ts`. |
| `bun run test:watch` | Watch mode. |
| `bun run coverage:view` | Open the HTML coverage report (after running tests). |

When consumed from other packages (for example `@nope/expression`) import the builder/short-hand helpers instead of talking to AJV directly to keep schemas consistent across the workspace.
