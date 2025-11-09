import type { TriggerOptions } from "../api.js";
import { coerceDate } from "../util/parse.js";
import { createAtPlan } from "./at.js";
import { createCronPlan } from "./cron.js";
import { createEveryPlan } from "./every.js";
import { createRRulePlan } from "./rrule.js";

export type TriggerPlanKind = "cron" | "every" | "at" | "rrule";

export interface TriggerPlan {
  readonly kind: TriggerPlanKind;
  readonly timezone?: string;
  readonly description: string;
  readonly options: TriggerOptions;
  next(after: Date): Date | undefined;
}

export interface PlanContext {
  startAt?: Date;
  endAt?: Date;
  maxRuns?: number;
}

export const createPlan = (options: TriggerOptions): TriggerPlan => {
  const normalized: TriggerOptions = {
    ...options,
    startAt: options.startAt ? coerceDate(options.startAt) : undefined,
    endAt: options.endAt ? coerceDate(options.endAt) : undefined,
  };
  switch (options.kind) {
    case "cron":
      return createCronPlan(normalized as any);
    case "every":
      return createEveryPlan(normalized as any);
    case "at":
      return createAtPlan(normalized as any);
    case "rrule":
      return createRRulePlan(normalized as any);
    default:
      throw new Error(`Unknown trigger kind ${(options as { kind: string }).kind}`);
  }
};
