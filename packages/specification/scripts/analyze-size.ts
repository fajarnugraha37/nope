#!/usr/bin/env bun
/**
 * Bundle size analyzer for @fajarnugraha37/specification
 * 
 * Analyzes the gzipped sizes of different entry points and exports.
 * Run with: bun run scripts/analyze-size.ts
 */

import { gzipSync } from "node:zlib";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

interface BundleInfo {
  name: string;
  path: string;
  raw: number;
  gzipped: number;
  limit: number;
  status: "✓" | "✗";
}

const KB = 1024;
const distPath = join(import.meta.dir, "..", "dist");

const bundles: Array<Omit<BundleInfo, "raw" | "gzipped" | "status">> = [
  {
    name: "Core (full import)",
    path: "index.mjs",
    limit: 15 * KB,
  },
  {
    name: "Core types only",
    path: "core/types.mjs",
    limit: 1 * KB,
  },
  {
    name: "Base specification",
    path: "core/base-spec.mjs",
    limit: 5 * KB,
  },
  {
    name: "Combinators",
    path: "core/combinators.mjs",
    limit: 5 * KB,
  },
  {
    name: "DSL Builder",
    path: "dsl/spec-builder.mjs",
    limit: 12 * KB,
  },
  {
    name: "Humanizer",
    path: "dsl/humanizer.mjs",
    limit: 4 * KB,
  },
  {
    name: "Built-in operators",
    path: "ops/builtins.mjs",
    limit: 9 * KB,
  },
  {
    name: "Prisma Adapter",
    path: "adapters/prisma.mjs",
    limit: 8 * KB,
  },
  {
    name: "MongoDB Adapter",
    path: "adapters/mongo.mjs",
    limit: 8 * KB,
  },
  {
    name: "AST Serializer",
    path: "ast/serializer.mjs",
    limit: 8 * KB,
  },
  {
    name: "Geo Plugin",
    path: "plugins/geo.mjs",
    limit: 6 * KB,
  },
  {
    name: "String Plugin",
    path: "plugins/string.mjs",
    limit: 6 * KB,
  },
];

function analyzeBundle(config: typeof bundles[0]): BundleInfo {
  const fullPath = join(distPath, config.path);
  
  try {
    const content = readFileSync(fullPath);
    const stats = statSync(fullPath);
    const gzipped = gzipSync(content);
    
    return {
      ...config,
      raw: stats.size,
      gzipped: gzipped.length,
      status: gzipped.length <= config.limit ? "✓" : "✗",
    };
  } catch (error) {
    return {
      ...config,
      raw: 0,
      gzipped: 0,
      status: "✗",
    };
  }
}

function formatSize(bytes: number): string {
  return `${(bytes / KB).toFixed(2)} KB`;
}

function formatPercent(actual: number, limit: number): string {
  const percent = (actual / limit) * 100;
  return `${percent.toFixed(1)}%`;
}

console.log("\n📦 Bundle Size Analysis\n");
console.log("=".repeat(90));
console.log(
  `${"Name".padEnd(25)} ${"Raw".padStart(10)} ${"Gzipped".padStart(10)} ${"Limit".padStart(10)} ${"Usage".padStart(10)} ${"Status".padStart(8)}`
);
console.log("=".repeat(90));

const results = bundles.map(analyzeBundle);
let passed = 0;
let failed = 0;

for (const result of results) {
  const name = result.name.padEnd(25);
  const raw = formatSize(result.raw).padStart(10);
  const gzipped = formatSize(result.gzipped).padStart(10);
  const limit = formatSize(result.limit).padStart(10);
  const usage = formatPercent(result.gzipped, result.limit).padStart(10);
  const status = result.status.padStart(8);
  
  console.log(`${name} ${raw} ${gzipped} ${limit} ${usage} ${status}`);
  
  if (result.status === "✓") {
    passed++;
  } else {
    failed++;
  }
}

console.log("=".repeat(90));
console.log(`\n✅ Passed: ${passed}/${results.length}`);
if (failed > 0) {
  console.log(`❌ Failed: ${failed}/${results.length}`);
}

// Calculate total bundle size
const totalGzipped = results.reduce((sum, r) => sum + r.gzipped, 0);
console.log(`\n📊 Total gzipped size: ${formatSize(totalGzipped)}`);

// Core bundle size (just the main index)
const coreBundle = results.find(r => r.name === "Core (full import)");
if (coreBundle) {
  console.log(`🎯 Core bundle: ${formatSize(coreBundle.gzipped)} (${coreBundle.status === "✓" ? "PASS" : "FAIL"})`);
}

console.log("\n💡 Tips:");
console.log("  - Import only what you need for better tree-shaking");
console.log("  - Use adapters/plugins separately if not needed");
console.log("  - Consider code splitting for large applications\n");

process.exit(failed > 0 ? 1 : 0);
