import type { AtTriggerOptions } from "../api.js";
import { coerceDate } from "../util/parse.js";
import type { TriggerPlan } from "./plan.js";

export const createAtPlan = (options: AtTriggerOptions & { kind: "at" }): TriggerPlan => {
  const runAt = coerceDate(options.runAt);
  const startAt = options.startAt ? coerceDate(options.startAt) : undefined;
  const endAt = options.endAt ? coerceDate(options.endAt) : undefined;

  return {
    kind: "at",
    timezone: options.timezone,
    description: `at ${runAt.toISOString()}`,
    options,
    next: (after) => {
      const afterMs = after.getTime();
      if (startAt && afterMs < startAt.getTime()) {
        return startAt <= runAt ? runAt : undefined;
      }
      if (endAt && runAt.getTime() > endAt.getTime()) {
        return undefined;
      }
      if (afterMs <= runAt.getTime()) {
        return runAt;
      }
      return undefined;
    },
  };
};
