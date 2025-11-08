import { describe, expect, it } from "bun:test";
import { createRegistry } from "../src/core/registry";
import { builtInOperators } from "../src/ops";
import { geoPlugin } from "../src/plugins/geo";
import { stringPlugin } from "../src/plugins/string";

interface LocationModel {
  coords: [number, number];
}

describe("plugins", () => {
  it("registers geo operator", () => {
    const registry = createRegistry({ operators: builtInOperators });
    geoPlugin.register(registry);
    const operator = registry.getOperator("withinRadius");
    expect(operator).toBeTruthy();
    const rule = operator!.create({ path: "coords", center: [0, 0], km: 10 });
    expect(rule.isSatisfiedBy({ coords: [0, 0] })).toBe(true);
    expect(rule.isSatisfiedBy({ coords: [1, 1] })).toBe(false);
  });

  it("registers string like operator", () => {
    const registry = createRegistry({ operators: builtInOperators });
    stringPlugin.register(registry);
    const operator = registry.getOperator("like");
    expect(operator).toBeTruthy();
    const rule = operator!.create({ path: "name", pattern: "adm*", caseInsensitive: true });
    expect(rule.isSatisfiedBy({ name: "Admin" })).toBe(true);
    expect(rule.isSatisfiedBy({ name: "viewer" })).toBe(false);
  });
});
