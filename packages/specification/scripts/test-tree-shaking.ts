/**
 * Tree-shaking Analysis
 * 
 * This script analyzes the existing built files to demonstrate
 * the impact of different import patterns on bundle size.
 * 
 * Run with: bun run scripts/test-tree-shaking.ts
 */

import { readFileSync, existsSync } from "fs";
import { gzipSync } from "zlib";
import { join } from "path";

const distDir = join(process.cwd(), "dist");

interface Module {
  name: string;
  description: string;
  files: string[];
}

const modules: Module[] = [
  {
    name: "Core (full import)",
    description: "Everything via main index",
    files: ["index.mjs"],
  },
  {
    name: "DSL Builder",
    description: "Fluent API + combinators",
    files: ["dsl/spec-builder.mjs"],
  },
  {
    name: "Base Specs",
    description: "Core specification classes",
    files: ["core/base-spec.mjs", "core/combinators.mjs"],
  },
  {
    name: "Operators",
    description: "All built-in operators",
    files: ["ops/builtins.mjs"],
  },
  {
    name: "Serialization",
    description: "AST to/from JSON",
    files: ["ast/serializer.mjs", "ast/schema.mjs"],
  },
  {
    name: "Prisma Adapter",
    description: "Database query generation",
    files: ["adapters/prisma.mjs"],
  },
  {
    name: "MongoDB Adapter",
    description: "MongoDB query generation",
    files: ["adapters/mongo.mjs"],
  },
  {
    name: "Humanizer",
    description: "Human-readable messages",
    files: ["dsl/humanizer.mjs"],
  },
];

interface Result {
  name: string;
  description: string;
  raw: number;
  gzipped: number;
}

function formatBytes(bytes: number): string {
  return (bytes / 1024).toFixed(2) + " KB";
}

function analyzeModule(module: Module): Result {
  let totalRaw = 0;
  let totalGzipped = 0;

  for (const file of module.files) {
    const filePath = join(distDir, file);
    if (!existsSync(filePath)) {
      console.warn(`⚠️  File not found: ${file}`);
      continue;
    }

    const content = readFileSync(filePath);
    totalRaw += content.length;
    totalGzipped += gzipSync(content, { level: 9 }).length;
  }

  return {
    name: module.name,
    description: module.description,
    raw: totalRaw,
    gzipped: totalGzipped,
  };
}

function main() {
  console.log("🌳 Tree-Shaking Analysis\n");
  console.log("Analyzing built module sizes to demonstrate import impact...\n");

  if (!existsSync(distDir)) {
    console.error("❌ dist/ directory not found. Run `bun run build` first.");
    process.exit(1);
  }

  // Analyze all modules
  const results: Result[] = modules.map(analyzeModule);

  // Sort by gzipped size
  const sorted = results.sort((a, b) => a.gzipped - b.gzipped);

  // Print results
  console.log("=".repeat(80));
  console.log("Module Sizes:\n");

  const maxDescLen = Math.max(...sorted.map((r) => r.description.length));

  for (const result of sorted) {
    const desc = result.description.padEnd(maxDescLen);
    const raw = formatBytes(result.raw).padStart(10);
    const gzipped = formatBytes(result.gzipped).padStart(10);
    console.log(`${desc}  ${raw} raw  ${gzipped} gzipped`);
  }

  console.log("\n" + "=".repeat(80));

  // Find core module
  const coreModule = results.find((r) => r.name === "Core (full import)");
  if (!coreModule) {
    console.error("❌ Core module not found");
    process.exit(1);
  }

  console.log("\nImport Strategy Recommendations:\n");

  // Calculate what percentage each module contributes to core
  for (const result of sorted) {
    if (result.name === "Core (full import)") continue;

    const pct = ((result.gzipped / coreModule.gzipped) * 100).toFixed(1);
    const icon = parseFloat(pct) < 20 ? "✅" : parseFloat(pct) < 40 ? "⚠️ " : "❌";
    console.log(`${icon} ${result.description.padEnd(maxDescLen)}  ${pct}% of core bundle`);
  }

  console.log("\n" + "=".repeat(80));
  console.log("\nOptimization Examples:\n");

  console.log("✅ **Minimal Usage** (Use DSL Builder only):");
  console.log("   import { spec } from '@fajarnugraha37/specification';");
  const dslModule = results.find((r) => r.name === "DSL Builder");
  if (dslModule) {
    console.log(`   Bundle size: ~${formatBytes(dslModule.gzipped)} gzipped\n`);
  }

  console.log("✅ **Standard Usage** (DSL + adapters loaded on demand):");
  console.log("   import { spec, all, any } from '@fajarnugraha37/specification';");
  console.log("   const adapter = await import('@fajarnugraha37/specification/adapters/prisma');");
  const prisma = results.find((r) => r.name === "Prisma Adapter");
  if (dslModule && prisma) {
    console.log(`   Bundle size: ~${formatBytes(dslModule.gzipped + prisma.gzipped)} gzipped\n`);
  }

  console.log("⚠️  **Full Import** (Everything from main index):");
  console.log("   import * as Spec from '@fajarnugraha37/specification';");
  console.log(`   Bundle size: ${formatBytes(coreModule.gzipped)} gzipped`);
  console.log("   ⚠️  Pulls all modules even if unused\n");

  console.log("=".repeat(80));
  console.log("\n💡 **Best Practice**: Import specific modules instead of using the main index");
  console.log("📖 See docs/performance.md for detailed optimization strategies\n");
}

main();
