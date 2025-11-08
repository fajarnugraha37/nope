import { describe, expect, test } from "bun:test";
import { generateFailureReason } from "../src/utils/explain";
import type { ExplainNode } from "../src/core/types";

describe("Explain Utils - generateFailureReason", () => {
  test("returns original reason when pass is true", () => {
    const node: ExplainNode = { id: "1", pass: true, reason: "passed" };
    expect(generateFailureReason(node)).toBe("passed");
  });

  test("returns original reason when pass is unknown", () => {
    const node: ExplainNode = { id: "1", pass: "unknown", reason: "unknown state" };
    expect(generateFailureReason(node)).toBe("unknown state");
  });

  test("returns original reason when no operator", () => {
    const node: ExplainNode = { id: "1", pass: false, reason: "custom reason" };
    expect(generateFailureReason(node)).toBe("custom reason");
  });

  test("generates reason for ne operator", () => {
    const node: ExplainNode = { id: "1", pass: false, operator: "ne", path: "status", actualValue: "active", expectedValue: "inactive" };
    const reason = generateFailureReason(node);
    expect(reason).toContain("status");
    expect(reason).toContain("active");
  });

  test("generates reason for gt operator", () => {
    const node: ExplainNode = { id: "1", pass: false, operator: "gt", path: "score", actualValue: 50, expectedValue: 75 };
    const reason = generateFailureReason(node);
    expect(reason).toContain(">");
    expect(reason).toContain("75");
  });

  test("generates reason for lte operator", () => {
    const node: ExplainNode = { id: "1", pass: false, operator: "lte", path: "count", actualValue: 100, expectedValue: 50 };
    const reason = generateFailureReason(node);
    expect(reason).toContain("<=");
  });

  test("generates reason for nin (not in) operator", () => {
    const node: ExplainNode = { id: "1", pass: false, operator: "nin", path: "role", actualValue: "admin", expectedValue: ["viewer", "editor"] };
    const reason = generateFailureReason(node);
    expect(reason).toContain("none of");
  });

  test("generates reason for startsWith operator", () => {
    const node: ExplainNode = { id: "1", pass: false, operator: "startsWith", path: "name", actualValue: "John", expectedValue: "Dr" };
    const reason = generateFailureReason(node);
    expect(reason).toContain("start with");
  });

  test("generates reason for endsWith operator", () => {
    const node: ExplainNode = { id: "1", pass: false, operator: "endsWith", path: "email", actualValue: "user@test", expectedValue: ".com" };
    const reason = generateFailureReason(node);
    expect(reason).toContain("end with");
  });

  test("generates reason for regex operator", () => {
    const node: ExplainNode = { id: "1", pass: false, operator: "regex", path: "code", actualValue: "abc", expectedValue: "/\\d+/" };
    const reason = generateFailureReason(node);
    expect(reason).toContain("match pattern");
  });

  test("generates reason for missing operator", () => {
    const node: ExplainNode = { id: "1", pass: false, operator: "missing", path: "optional", actualValue: "value" };
    const reason = generateFailureReason(node);
    expect(reason).toContain("missing");
  });

  test("generates reason for and operator", () => {
    const node: ExplainNode = { id: "1", pass: false, operator: "and", path: "conditions" };
    const reason = generateFailureReason(node);
    expect(reason).toContain("Not all conditions met");
  });

  test("generates reason for or operator", () => {
    const node: ExplainNode = { id: "1", pass: false, operator: "or", path: "options" };
    const reason = generateFailureReason(node);
    expect(reason).toContain("No conditions met");
  });

  test("generates reason for not operator", () => {
    const node: ExplainNode = { id: "1", pass: false, operator: "not", path: "check" };
    const reason = generateFailureReason(node);
    expect(reason).toContain("Negation failed");
  });

  test("handles unknown operator", () => {
    const node: ExplainNode = { id: "1", pass: false, operator: "customOp", path: "field" };
    const reason = generateFailureReason(node);
    expect(reason).toContain("customOp");
    expect(reason).toContain("failed");
  });

  test("formats undefined value", () => {
    const node: ExplainNode = { id: "1", pass: false, operator: "eq", actualValue: undefined, expectedValue: "test" };
    const reason = generateFailureReason(node);
    expect(reason).toContain("undefined");
  });

  test("formats null value", () => {
    const node: ExplainNode = { id: "1", pass: false, operator: "eq", actualValue: null, expectedValue: "test" };
    const reason = generateFailureReason(node);
    expect(reason).toContain("null");
  });

  test("formats array values", () => {
    const node: ExplainNode = { id: "1", pass: false, operator: "in", actualValue: "x", expectedValue: ["a", "b", "c"] };
    const reason = generateFailureReason(node);
    expect(reason).toContain("[");
    expect(reason).toContain("]");
  });

  test("truncates long arrays", () => {
    const node: ExplainNode = { id: "1", pass: false, operator: "in", actualValue: "x", expectedValue: [1, 2, 3, 4, 5, 6, 7, 8] };
    const reason = generateFailureReason(node);
    expect(reason).toContain("...");
    expect(reason).toContain("8 items");
  });

  test("formats object values", () => {
    const node: ExplainNode = { id: "1", pass: false, operator: "eq", actualValue: { a: 1 }, expectedValue: { b: 2 } };
    const reason = generateFailureReason(node);
    expect(reason).toMatch(/\{.*\}/);
  });

  test("truncates large objects", () => {
    const node: ExplainNode = { id: "1", pass: false, operator: "eq", actualValue: { a: 1, b: 2, c: 3, d: 4, e: 5 }, expectedValue: "test" };
    const reason = generateFailureReason(node);
    expect(reason).toContain("...");
  });
});
