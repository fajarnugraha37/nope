import { describe, test, expect } from "bun:test";
import { normalizeStack, truncateStack } from "../src/normalize-stack";

describe("normalizeStack", () => {
  test("normalizes basic stack trace", () => {
    const stack = `Error: test error
    at test (file.ts:10:5)
    at run (file.ts:20:10)`;
    
    const normalized = normalizeStack(stack);
    expect(normalized).toContain("Error: test error");
    expect(normalized).toContain("at test");
    expect(normalized).toContain("at run");
  });

  test("filters internal patterns - node_modules", () => {
    const stack = `Error: test
    at test (file.ts:10:5)
    at Module._compile (node_modules/something:1:1)
    at run (file.ts:20:10)`;
    
    const normalized = normalizeStack(stack);
    expect(normalized).toContain("at test");
    expect(normalized).toContain("at run");
    expect(normalized).not.toContain("node_modules");
  });

  test("filters internal patterns - Object.<anonymous>", () => {
    const stack = `Error: test
    at test (file.ts:10:5)
    at Object.<anonymous> (internal.ts:1:1)
    at run (file.ts:20:10)`;
    
    const normalized = normalizeStack(stack);
    expect(normalized).toContain("at test");
    expect(normalized).toContain("at run");
    expect(normalized).not.toContain("Object.<anonymous>");
  });

  test("filters internal patterns - Module functions", () => {
    const stack = `Error: test
    at test (file.ts:10:5)
    at Module._compile (internal.js:1:1)
    at Module.load (internal.js:2:1)
    at Function.Module._load (internal.js:3:1)
    at Module.require (internal.js:4:1)
    at run (file.ts:20:10)`;
    
    const normalized = normalizeStack(stack);
    expect(normalized).toContain("at test");
    expect(normalized).toContain("at run");
    expect(normalized).not.toContain("Module._compile");
    expect(normalized).not.toContain("Module.load");
    expect(normalized).not.toContain("Module._load");
    expect(normalized).not.toContain("Module.require");
  });

  test("filters package internal frames", () => {
    const stack = `Error: test
    at test (file.ts:10:5)
    at something (@fajarnugraha37/error/dist/index.js:1:1)
    at run (file.ts:20:10)`;
    
    const normalized = normalizeStack(stack);
    expect(normalized).toContain("at test");
    expect(normalized).toContain("at run");
    expect(normalized).not.toContain("@fajarnugraha37/error/dist");
  });

  test("limits to MAX_STACK_FRAMES", () => {
    // Create a stack with more than 50 frames
    const lines = ["Error: test"];
    for (let i = 0; i < 60; i++) {
      lines.push(`    at func${i} (file.ts:${i}:5)`);
    }
    const stack = lines.join("\n");
    
    const normalized = normalizeStack(stack);
    const normalizedLines = normalized.split("\n");
    
    // Should have error message + max 50 frames + truncation message
    expect(normalizedLines.length).toBeLessThanOrEqual(52);
    expect(normalized).toContain("... (truncated)");
  });

  test("normalizes Windows line endings", () => {
    const stack = "Error: test\r\nat test (file.ts:10:5)\r\nat run (file.ts:20:10)";
    const normalized = normalizeStack(stack);
    expect(normalized).not.toContain("\r\n");
    expect(normalized).toContain("\n");
  });

  test("preserves error message line", () => {
    const stack = `CustomError: custom message
    at test (file.ts:10:5)`;
    
    const normalized = normalizeStack(stack);
    expect(normalized).toContain("CustomError: custom message");
  });

  test("handles empty stack", () => {
    const normalized = normalizeStack("");
    expect(normalized).toBe("");
  });

  test("handles stack with only error message", () => {
    const stack = "Error: test error";
    const normalized = normalizeStack(stack);
    expect(normalized).toBe("Error: test error");
  });
});

describe("truncateStack", () => {
  test("returns stack as-is when under max length", () => {
    const stack = "Error: test\n    at test (file.ts:10:5)";
    const truncated = truncateStack(stack, 1000);
    expect(truncated).toBe(stack);
  });

  test("truncates stack when over max length", () => {
    const stack = "a".repeat(2000);
    const truncated = truncateStack(stack, 1000);
    expect(truncated.length).toBe(1000 + "\n... (truncated)".length);
    expect(truncated).toEndWith("\n... (truncated)");
  });

  test("uses default max length of 1000", () => {
    const stack = "a".repeat(2000);
    const truncated = truncateStack(stack);
    expect(truncated.length).toBe(1000 + "\n... (truncated)".length);
  });

  test("handles custom max length", () => {
    const stack = "a".repeat(1000);
    const truncated = truncateStack(stack, 500);
    expect(truncated.length).toBe(500 + "\n... (truncated)".length);
  });

  test("preserves exact length stack", () => {
    const stack = "a".repeat(1000);
    const truncated = truncateStack(stack, 1000);
    expect(truncated).toBe(stack);
  });
});
