import type { RRuleTriggerOptions } from "../api.js";
import { coerceDate } from "../util/parse.js";
import type { TriggerPlan } from "./plan.js";
import { createTimeFieldExtractor, type TimeFields } from "./tz.js";
import { createCalendarFilter } from "./calendars.js";

type Frequency = "DAILY" | "WEEKLY" | "MONTHLY";

interface RRuleSpec {
  freq: Frequency;
  interval: number;
  until?: Date;
  count?: number;
  byDay?: number[];
  byMonthDay?: number[];
  byMonth?: number[];
  bySetPos?: number[];
  byHour?: number[];
  byMinute?: number[];
  bySecond?: number[];
  dtstart?: Date;
}

const WEEKDAYS: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

export const createRRulePlan = (options: RRuleTriggerOptions & { kind: "rrule" }): TriggerPlan => {
  const spec = parseRRule(options.rrule);
  const startAt = options.startAt ? coerceDate(options.startAt) : spec.dtstart ?? new Date();
  const endAt = options.endAt ? coerceDate(options.endAt) : spec.until;
  const maxRuns = Math.min(options.maxRuns ?? Number.POSITIVE_INFINITY, spec.count ?? Number.POSITIVE_INFINITY);
  const extractor = createTimeFieldExtractor(options.timezone);
  const allowDate = createCalendarFilter(options.calendars, options.timezone);
  const excluded = new Set((options.exdates ?? []).map((value) => coerceDate(value).getTime()));
  const startDay = startOfDay(startAt);
  const template = {
    hour: startAt.getUTCHours(),
    minute: startAt.getUTCMinutes(),
    second: startAt.getUTCSeconds(),
    ms: startAt.getUTCMilliseconds(),
  };

  let emitted = 0;
  let cursor: Date | undefined;

  return {
    kind: "rrule",
    timezone: options.timezone,
    description: options.rrule,
    options,
    next(after) {
      if (emitted >= maxRuns) {
        return undefined;
      }

      const searchStart = new Date(Math.max(after.getTime() + 1, startAt.getTime()));
      let dayCursor = startOfDay(cursor ? new Date(cursor.getTime() + 1) : searchStart);
      const limit = 200_000;
      let iterations = 0;

      while (iterations++ < limit) {
        if (endAt && dayCursor > endAt) {
          return undefined;
        }
        if (!isIntervalAlignedDay(dayCursor, startDay, startAt, spec)) {
          dayCursor = addDays(dayCursor, 1);
          continue;
        }

        const candidates = enumerateDayCandidates(dayCursor, spec, template);
        for (const candidate of candidates) {
          if (candidate <= after || candidate < startAt) {
            continue;
          }
          if (endAt && candidate > endAt) {
            return undefined;
          }
          if (excluded.has(candidate.getTime())) {
            continue;
          }
          const fields = extractor(candidate);
          if (matchesSpec(fields, spec) && allowDate(candidate, fields)) {
            cursor = candidate;
            emitted += 1;
            return candidate;
          }
        }

        dayCursor = addDays(dayCursor, 1);
      }

      throw new Error("Unable to find next RRULE occurrence within iteration limit");
    },
  };
};

const parseRRule = (input: string): RRuleSpec => {
  const parts = input.split(";").map((entry) => entry.trim());
  const spec: Partial<RRuleSpec> = {};

  for (const part of parts) {
    if (!part) continue;
    const [rawKey, rawValue] = part.split("=");
    const key = rawKey!.toUpperCase();
    const value = rawValue ?? "";
    switch (key) {
      case "FREQ":
        if (!["DAILY", "WEEKLY", "MONTHLY"].includes(value.toUpperCase())) {
          throw new Error(`Unsupported RRULE frequency '${value}'`);
        }
        spec.freq = value.toUpperCase() as Frequency;
        break;
      case "INTERVAL":
        spec.interval = Math.max(1, Number(value));
        break;
      case "COUNT":
        spec.count = Math.max(1, Number(value));
        break;
      case "UNTIL":
        spec.until = parseDateToken(value);
        break;
      case "BYDAY":
        spec.byDay = value.split(",").map(parseWeekday);
        break;
      case "BYMONTHDAY":
        spec.byMonthDay = value
          .split(",")
          .map((entry) => Number(entry))
          .filter((num) => Number.isInteger(num));
        break;
      case "BYMONTH":
        spec.byMonth = value
          .split(",")
          .map((entry) => Number(entry))
          .filter((num) => Number.isInteger(num));
        break;
      case "BYSETPOS":
        spec.bySetPos = value
          .split(",")
          .map((entry) => Number(entry))
          .filter((num) => Number.isInteger(num) && num !== 0);
        break;
      case "BYHOUR":
        spec.byHour = value
          .split(",")
          .map((entry) => Number(entry))
          .filter((num) => Number.isInteger(num) && num >= 0 && num <= 23);
        break;
      case "BYMINUTE":
        spec.byMinute = value
          .split(",")
          .map((entry) => Number(entry))
          .filter((num) => Number.isInteger(num) && num >= 0 && num <= 59);
        break;
      case "BYSECOND":
        spec.bySecond = value
          .split(",")
          .map((entry) => Number(entry))
          .filter((num) => Number.isInteger(num) && num >= 0 && num <= 59);
        break;
      case "DTSTART":
        spec.dtstart = parseDateToken(value);
        break;
      default:
        throw new Error(`Unsupported RRULE property '${key}'`);
    }
  }

  if (!spec.freq) {
    throw new Error("RRULE must include FREQ");
  }

  return {
    freq: spec.freq,
    interval: spec.interval ?? 1,
    until: spec.until,
    count: spec.count,
    byDay: spec.byDay,
    byMonthDay: spec.byMonthDay,
    byMonth: spec.byMonth,
    bySetPos: spec.bySetPos,
    byHour: spec.byHour,
    byMinute: spec.byMinute,
    bySecond: spec.bySecond,
    dtstart: spec.dtstart,
  };
};

const parseDateToken = (value: string): Date => {
  if (/^\d{8}$/.test(value)) {
    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(4, 6)) - 1;
    const day = Number(value.slice(6, 8));
    return new Date(Date.UTC(year, month, day));
  }
  return coerceDate(value);
};

const parseWeekday = (token: string): number => {
  const normalized = token.toUpperCase();
  const weekday = WEEKDAYS[normalized];
  if (typeof weekday !== "number") {
    throw new Error(`Unsupported RRULE weekday '${token}'`);
  }
  return weekday;
};

const matchesSpec = (fields: TimeFields, spec: RRuleSpec): boolean => {
  if (spec.byMonth && spec.byMonth.length > 0 && !spec.byMonth.includes(fields.month)) {
    return false;
  }
  if (spec.byMonthDay && spec.byMonthDay.length > 0 && !spec.byMonthDay.includes(fields.day)) {
    return false;
  }
  if (spec.byDay && spec.byDay.length > 0 && !spec.byDay.includes(fields.dayOfWeek)) {
    return false;
  }
  if (spec.bySetPos && spec.bySetPos.length > 0 && !matchesSetPos(fields, spec)) {
    return false;
  }
  if (spec.byHour && spec.byHour.length > 0 && !spec.byHour.includes(fields.hour)) {
    return false;
  }
  if (spec.byMinute && spec.byMinute.length > 0 && !spec.byMinute.includes(fields.minute)) {
    return false;
  }
  if (spec.bySecond && spec.bySecond.length > 0 && !spec.bySecond.includes(fields.second)) {
    return false;
  }
  return true;
};

const startOfDay = (value: Date): Date => {
  const next = new Date(value);
  next.setUTCHours(0, 0, 0, 0);
  return next;
};

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const isIntervalAlignedDay = (day: Date, startDay: Date, startAt: Date, spec: RRuleSpec): boolean => {
  const diffMs = day.getTime() - startDay.getTime();
  if (diffMs < 0) {
    return false;
  }
  const dayDiff = Math.floor(diffMs / 86_400_000);
  switch (spec.freq) {
    case "DAILY":
      return dayDiff % spec.interval === 0;
    case "WEEKLY":
      return Math.floor(dayDiff / 7) % spec.interval === 0;
    case "MONTHLY": {
      const months =
        (day.getUTCFullYear() - startAt.getUTCFullYear()) * 12 +
        (day.getUTCMonth() - startAt.getUTCMonth());
      return months % spec.interval === 0;
    }
    default:
      return true;
  }
};

const matchesSetPos = (fields: TimeFields, spec: RRuleSpec): boolean => {
  if (!spec.bySetPos || spec.bySetPos.length === 0) {
    return true;
  }
  switch (spec.freq) {
    case "MONTHLY":
      return matchesMonthlySetPos(fields, spec);
    case "WEEKLY":
      return matchesWeeklySetPos(fields, spec);
    default:
      return false;
  }
};

const matchesMonthlySetPos = (fields: TimeFields, spec: RRuleSpec): boolean => {
  if (!spec.bySetPos) {
    return true;
  }
  const date = new Date(Date.UTC(fields.year, fields.month - 1, fields.day, 12, 0, 0, 0));
  const daysInMonth = getDaysInMonth(date);
  const occurrence = Math.floor((fields.day - 1) / 7) + 1;
  const remaining = Math.floor((daysInMonth - fields.day) / 7);
  const negOccurrence = -(remaining + 1);

  return spec.bySetPos.some((target) => {
    if (target > 0) {
      return occurrence === target;
    }
    return negOccurrence === target;
  });
};

const matchesWeeklySetPos = (fields: TimeFields, spec: RRuleSpec): boolean => {
  if (!spec.bySetPos || !spec.byDay || spec.byDay.length === 0) {
    return false;
  }
  const sortedDays = [...spec.byDay].sort((a, b) => a - b);
  const index = sortedDays.indexOf(fields.dayOfWeek);
  if (index === -1) {
    return false;
  }
  const total = sortedDays.length;
  return spec.bySetPos.some((target) => {
    if (target > 0) {
      return index + 1 === target;
    }
    return index === total + target;
  });
};

const getDaysInMonth = (date: Date): number => {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
};

const enumerateDayCandidates = (
  dayStart: Date,
  spec: RRuleSpec,
  template: { hour: number; minute: number; second: number; ms: number }
): Date[] => {
  const hours = spec.byHour ? [...Array(24).keys()] : [template.hour];
  const minutes = spec.byMinute ? [...Array(60).keys()] : [template.minute];
  const seconds = spec.bySecond && spec.bySecond.length > 0 ? spec.bySecond : [template.second];
  const candidates: Date[] = [];
  for (const hour of hours) {
    for (const minute of minutes) {
      for (const second of seconds) {
        const candidate = new Date(dayStart);
        candidate.setUTCHours(hour, minute, second, template.ms);
        candidates.push(candidate);
      }
    }
  }
  return candidates.sort((a, b) => a.getTime() - b.getTime());
};
