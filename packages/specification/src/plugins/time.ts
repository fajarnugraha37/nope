import { createPlugin } from "./create-plugin.js";
import { createFieldOperator } from "../ops/factory.js";

const withinWindow = createFieldOperator({
  kind: "withinWindow",
  reason: (input) =>
    `{${input.path}} must fall between ${input.start ?? "?"} and ${input.end ?? "?"}`,
  predicate: ({ actual, input }) => {
    if (!actual) return false;
    const value = new Date(actual as string | number).getTime();
    const start = input.start ? new Date(input.start as string).getTime() : undefined;
    const end = input.end ? new Date(input.end as string).getTime() : undefined;
    if (Number.isNaN(value) || (start && Number.isNaN(start)) || (end && Number.isNaN(end))) {
      return false;
    }
    if (start && value < start) return false;
    if (end && value > end) return false;
    return true;
  },
});

export const timePlugin = createPlugin({
  name: "time",
  version: "1.0.0",
  register(registry) {
    registry.addOperator(withinWindow);
  },
});
