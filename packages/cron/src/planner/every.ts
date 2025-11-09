import type { EveryTriggerOptions } from "../api.js";
import { parseHumanDuration } from "../util/parse.js";
import type { TriggerPlan } from "./plan.js";

export const createEveryPlan = (options: EveryTriggerOptions & { kind: "every" }): TriggerPlan => {
  const intervalMs = Math.max(1, parseHumanDuration(options.every));
  const startAt = options.startAt ? new Date(options.startAt) : new Date();
  const offsetMs = options.offset ?? 0;
  const endAt = options.endAt ? new Date(options.endAt) : undefined;
  const maxRuns = options.maxRuns ?? Number.POSITIVE_INFINITY;
  let emitted = 0;

  const anchorMs = startAt.getTime() + offsetMs;

  return {
    kind: "every",
    timezone: options.timezone,
    description: `every ${options.every}`,
    options,
    next: (after) => {
      if (emitted >= maxRuns) {
        return undefined;
      }
      const afterMs = Math.max(after.getTime(), anchorMs);
      const delta = afterMs - anchorMs;
      const steps = delta <= 0 ? 0 : Math.ceil(delta / intervalMs);
      const nextAtMs = anchorMs + steps * intervalMs;
      if (endAt && nextAtMs > endAt.getTime()) {
        return undefined;
      }
      emitted += 1;
      return new Date(nextAtMs);
    },
  };
};
