/**
 * Stack normalization across runtimes (Bun, Node, Browser)
 */

const MAX_STACK_FRAMES = 50;
const INTERNAL_PATTERNS = [
  /at Object\.<anonymous>/,
  /at Module\._compile/,
  /at Module\.load/,
  /at Function\.Module\._load/,
  /at Module\.require/,
  /at require \(node:internal/,
  /node_modules/,
  /@fajarnugraha37\/error\/dist/,
];

interface Runtime {
  type: "bun" | "node" | "browser" | "unknown";
  version?: string;
}

/**
 * Detect current runtime
 */
function detectRuntime(): Runtime {
  // Check for Bun
  if (typeof globalThis !== "undefined" && "Bun" in globalThis) {
    return { type: "bun", version: (globalThis as any).Bun?.version };
  }

  // Check for Node.js
  if (typeof process !== "undefined" && process.versions?.node) {
    return { type: "node", version: process.versions.node };
  }

  // Check for browser
  if (typeof window !== "undefined") {
    return { type: "browser" };
  }

  return { type: "unknown" };
}

/**
 * Normalize stack trace
 */
export function normalizeStack(stack: string): string {
  const runtime = detectRuntime();

  // Normalize line endings
  let normalized = stack.replace(/\r\n/g, "\n");

  // Split into lines
  const lines = normalized.split("\n");
  const filteredLines: string[] = [];

  let frameCount = 0;
  for (const line of lines) {
    // Keep error message line (first line typically)
    if (!line.trim().startsWith("at ")) {
      filteredLines.push(line);
      continue;
    }

    // Skip internal frames
    if (INTERNAL_PATTERNS.some((pattern) => pattern.test(line))) {
      continue;
    }

    // Limit frame count
    if (frameCount >= MAX_STACK_FRAMES) {
      filteredLines.push("    ... (truncated)");
      break;
    }

    filteredLines.push(line);
    frameCount++;
  }

  normalized = filteredLines.join("\n");

  // Apply source map support if available
  if (runtime.type === "browser" || runtime.type === "bun") {
    normalized = applySourceMaps(normalized);
  }

  return normalized;
}

/**
 * Apply source maps if available
 */
function applySourceMaps(stack: string): string {
  // Check for Bun's stack trace mapper
  if (typeof globalThis !== "undefined" && "__stackTraceMapper" in globalThis) {
    try {
      const mapper = (globalThis as any).__stackTraceMapper;
      if (typeof mapper === "function") {
        return mapper(stack) || stack;
      }
    } catch {
      // Ignore errors
    }
  }

  // Browser source map support would require additional libraries
  // For now, return as-is
  return stack;
}

/**
 * Truncate stack to max length
 */
export function truncateStack(stack: string, maxLength = 1000): string {
  if (stack.length <= maxLength) {
    return stack;
  }
  return stack.slice(0, maxLength) + "\n... (truncated)";
}
