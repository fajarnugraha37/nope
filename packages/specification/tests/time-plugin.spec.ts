import { describe, expect, test } from "bun:test";
import { createRegistry } from "../src/core/registry";
import { builtInOperators } from "../src/ops";
import { timePlugin } from "../src/plugins/time";

describe("time plugin", () => {
  test("registers withinWindow operator", () => {
    const registry = createRegistry({ operators: builtInOperators });
    timePlugin.register(registry);
    const operator = registry.getOperator("withinWindow");
    expect(operator).toBeTruthy();
    const rule = operator!.create({ path: "date", start: "2024-01-01", end: "2024-12-31" });
    expect(rule.isSatisfiedBy({ date: "2024-06-15" })).toBe(true);
    expect(rule.isSatisfiedBy({ date: "2025-01-01" })).toBe(false);
  });
});
