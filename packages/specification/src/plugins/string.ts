import { createPlugin } from "./create-plugin.js";
import { createFieldOperator } from "../ops/factory.js";

const likeOperator = createFieldOperator({
  kind: "like",
  reason: (input) => `{${input.path}} must match pattern ${input.pattern}`,
  predicate: ({ actual, input }) => {
    if (typeof actual !== "string" || typeof input.pattern !== "string") return false;
    const pattern = input.caseInsensitive ? input.pattern.toLowerCase() : input.pattern;
    const target = input.caseInsensitive ? actual.toLowerCase() : actual;
    const regex = new RegExp(
      "^" +
        pattern
          .replace(/[.+^${}()|[\]\\]/g, "\\$&")
          .replace(/\*/g, ".*")
          .replace(/\?/g, ".") +
        "$",
    );
    return regex.test(target);
  },
});

export const stringPlugin = createPlugin({
  name: "string",
  version: "1.0.0",
  register(registry) {
    registry.addOperator(likeOperator);
  },
});
