import { defineConfig } from "tsup";

export default defineConfig([
  // Core entry
  {
    entry: {
      index: "src/index.ts",
      result: "src/result.ts",
      assert: "src/assert.ts",
      format: "src/format.ts",
      problem: "src/problem.ts",
      validation: "src/validation.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    splitting: false,
    treeshake: true,
    outDir: "dist",
    tsconfig: "./tsconfig.json",
  },
  // Browser bundle for core
  {
    entry: { "index.browser": "src/index.ts" },
    format: ["esm"],
    dts: false,
    platform: "browser",
    outDir: "dist",
    tsconfig: "./tsconfig.json",
  },
  // Adapters
  {
    entry: {
      "adapters/web": "src/adapters/web.ts",
      "adapters/express": "src/adapters/express.ts",
      "adapters/fastify": "src/adapters/fastify.ts",
      "adapters/koa": "src/adapters/koa.ts",
      "adapters/hono": "src/adapters/hono.ts",
      "adapters/h3": "src/adapters/h3.ts",
      "adapters/elysia": "src/adapters/elysia.ts",
      "adapters/graphql": "src/adapters/graphql.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    outDir: "dist",
    tsconfig: "./tsconfig.json",
  },
  // Observability
  {
    entry: {
      "observability/otel": "src/observability/otel.ts",
      "observability/sentry": "src/observability/sentry.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    outDir: "dist",
    tsconfig: "./tsconfig.json",
  },
]);
