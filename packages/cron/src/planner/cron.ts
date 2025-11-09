import type { CronTriggerOptions } from "../api.js";
import type { TriggerPlan } from "./plan.js";
import { createCalendarFilter } from "./calendars.js";
import { createTimeFieldExtractor, type TimeFields } from "./tz.js";

const NICKNAMES: Record<string, string> = {
  "@yearly": "0 0 0 1 1 ? *",
  "@annually": "0 0 0 1 1 ? *",
  "@monthly": "0 0 0 1 * ? *",
  "@weekly": "0 0 0 ? * 1 *",
  "@daily": "0 0 0 * * ? *",
};

type CronField = {
  name: string;
  min: number;
  max: number;
  allowWildcard: boolean;
};

const CRON_FIELDS: CronField[] = [
  { name: "seconds", min: 0, max: 59, allowWildcard: true },
  { name: "minutes", min: 0, max: 59, allowWildcard: true },
  { name: "hours", min: 0, max: 23, allowWildcard: true },
  { name: "dayOfMonth", min: 1, max: 31, allowWildcard: true },
  { name: "month", min: 1, max: 12, allowWildcard: true },
  { name: "dayOfWeek", min: 0, max: 7, allowWildcard: true }, // Quartz allows 0 or 7 for Sunday
  { name: "year", min: 1970, max: 2099, allowWildcard: true },
];

type StandardField = number[] | "*";

interface DayOfMonthMatcher {
  any: boolean;
  ignore: boolean;
  values: Set<number>;
  nearestWeekdays: number[];
  lastDayOffsets: number[];
  lastWeekday: boolean;
}

interface DayOfWeekMatcher {
  any: boolean;
  ignore: boolean;
  values: Set<number>;
  lastInMonth: number[];
  nthInMonth: Array<{ day: number; nth: number }>;
}

interface CronSpec {
  seconds: StandardField;
  minutes: StandardField;
  hours: StandardField;
  months: StandardField;
  years: StandardField;
  dayOfMonth: DayOfMonthMatcher;
  dayOfWeek: DayOfWeekMatcher;
}

const normalizeExpression = (expression: string): string => {
  const trimmed = expression.trim();
  if (NICKNAMES[trimmed]) {
    return NICKNAMES[trimmed];
  }
  return trimmed;
};

const parseStandardField = (value: string, field: CronField): StandardField => {
  if (value === "*" || value === "?") {
    if (!field.allowWildcard && value === "*") {
      throw new Error(`Field ${field.name} does not allow wildcard`);
    }
    if (value === "?" && field.name !== "dayOfMonth" && field.name !== "dayOfWeek") {
      throw new Error(`'?' is only supported in day-of-month or day-of-week fields`);
    }
    return "*";
  }

  const values = new Set<number>();
  for (const token of value.split(",")) {
    expandToken(token, field).forEach((entry) => values.add(entry));
  }
  return Array.from(values).sort((a, b) => a - b);
};

const expandToken = (token: string, field: CronField): number[] => {
  let rangePart = token;
  let step = 1;
  if (token.includes("/")) {
    const [rawRange, rawStep] = token.split("/");
    rangePart = rawRange!;
    step = Number(rawStep);
    if (!Number.isInteger(step) || step <= 0) {
      throw new Error(`Invalid step '${rawStep}' in cron field ${field.name}`);
    }
  }

  const values: number[] = [];
  if (rangePart === "*") {
    for (let i = field.min; i <= field.max; i += step) {
      values.push(normalizeFieldValue(i, field));
    }
    return values;
  }

  if (rangePart.includes("-")) {
    const [startStr, endStr] = rangePart.split("-");
    const start = Number(startStr);
    const end = Number(endStr);
    if (Number.isNaN(start) || Number.isNaN(end)) {
      throw new Error(`Invalid range '${rangePart}' in cron field ${field.name}`);
    }
    if (end < start) {
      throw new Error(`Range end '${end}' is less than start '${start}' for field ${field.name}`);
    }
    for (let i = start; i <= end; i += step) {
      values.push(normalizeFieldValue(i, field));
    }
    return values;
  }

  const literal = Number(rangePart);
  if (Number.isNaN(literal)) {
    throw new Error(`Invalid literal '${rangePart}' in cron field ${field.name}`);
  }
  values.push(normalizeFieldValue(literal, field));
  return values;
};

const normalizeFieldValue = (value: number, field: CronField) => {
  if (value < field.min || value > field.max) {
    throw new Error(`Value ${value} is out of range for field ${field.name}`);
  }
  if (field.name === "dayOfWeek" && value === 7) {
    return 0;
  }
  return value;
};

const parseDayOfMonthField = (value: string): DayOfMonthMatcher => {
  if (value === "*" || value === "?") {
    return {
      any: true,
      ignore: value === "?",
      values: new Set(),
      nearestWeekdays: [],
      lastDayOffsets: [],
      lastWeekday: false,
    };
  }

  const values = new Set<number>();
  const nearestWeekdays: number[] = [];
  const lastDayOffsets: number[] = [];
  let lastWeekday = false;

  for (const token of value.split(",")) {
    if (token === "L") {
      lastDayOffsets.push(0);
      continue;
    }
    if (token.startsWith("L-")) {
      const offset = Number(token.slice(2));
      if (!Number.isInteger(offset) || offset < 0) {
        throw new Error(`Invalid L-offset '${token}' in day-of-month field`);
      }
      lastDayOffsets.push(offset);
      continue;
    }
    if (token === "LW") {
      lastWeekday = true;
      continue;
    }
    if (token.endsWith("W")) {
      const base = Number(token.slice(0, -1));
      if (!Number.isInteger(base) || base < 1 || base > 31) {
        throw new Error(`Invalid weekday token '${token}' in day-of-month field`);
      }
      nearestWeekdays.push(base);
      continue;
    }
    expandToken(token, CRON_FIELDS[3]!).forEach((entry) => values.add(entry));
  }

  return {
    any: false,
    ignore: false,
    values,
    nearestWeekdays,
    lastDayOffsets,
    lastWeekday,
  };
};

const parseDayOfWeekField = (value: string): DayOfWeekMatcher => {
  if (value === "*" || value === "?") {
    return { any: true, ignore: value === "?", values: new Set(), lastInMonth: [], nthInMonth: [] };
  }

  const values = new Set<number>();
  const lastInMonth: number[] = [];
  const nthInMonth: Array<{ day: number; nth: number }> = [];

  for (const token of value.split(",")) {
    if (token.includes("#")) {
      const [dayStr, nthStr] = token.split("#");
      const day = normalizeFieldValue(Number(dayStr), CRON_FIELDS[5]!);
      const nth = Number(nthStr);
      if (!Number.isInteger(nth) || nth < 1 || nth > 5) {
        throw new Error(`Invalid '#' modifier '${token}' in day-of-week field`);
      }
      nthInMonth.push({ day, nth });
      continue;
    }
    if (token.endsWith("L") && token.length > 1) {
      const day = normalizeFieldValue(Number(token.slice(0, -1)), CRON_FIELDS[5]!);
      lastInMonth.push(day);
      continue;
    }
    if (token === "L") {
      // Quartz treats bare 'L' in DOW as 7th day? We'll treat as Saturday?
      throw new Error("Bare 'L' is not supported in day-of-week field; use '<day>L'");
    }
    expandToken(token, CRON_FIELDS[5]!).forEach((entry) => values.add(entry));
  }

  return { any: false, ignore: false, values, lastInMonth, nthInMonth };
};

const buildSpec = (expression: string): CronSpec => {
  const normalized = normalizeExpression(expression);
  const parts = normalized.split(/\s+/);
  if (parts.length < 5 || parts.length > 7) {
    throw new Error(`Cron expression must have 5, 6, or 7 parts. Got ${parts.length}`);
  }

  const filled = parts.length === 5 ? ["0", ...parts, "*"] : parts.length === 6 ? [...parts, "*"] : parts;
  const [seconds, minutes, hours, dom, month, dow, year] = filled;

  return {
    seconds: parseStandardField(seconds!, CRON_FIELDS[0]!),
    minutes: parseStandardField(minutes!, CRON_FIELDS[1]!),
    hours: parseStandardField(hours!, CRON_FIELDS[2]!),
    dayOfMonth: parseDayOfMonthField(dom!),
    months: parseStandardField(month!, CRON_FIELDS[4]!),
    dayOfWeek: parseDayOfWeekField(dow!),
    years: parseStandardField(year!, CRON_FIELDS[6]!),
  };
};

const matchesField = (value: number, field: StandardField) => {
  if (field === "*") {
    return true;
  }
  return field.includes(value);
};

const getDaysInMonth = (year: number, monthIndex: number) => {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
};

const nearestWeekday = (year: number, monthIndex: number, targetDay: number): number => {
  const daysInMonth = getDaysInMonth(year, monthIndex);
  const day = Math.min(Math.max(targetDay, 1), daysInMonth);
  let date = new Date(Date.UTC(year, monthIndex, day));
  const dow = date.getUTCDay();
  if (dow >= 1 && dow <= 5) {
    return day;
  }

  if (dow === 6) {
    // Saturday -> previous Friday unless it's day 1, then move forward
    if (day === 1) {
      return day + 2;
    }
    return day - 1;
  }
  // Sunday -> next Monday unless at month end
  if (day === daysInMonth) {
    return day - 2;
  }
  return day + 1;
};

const computeLastWeekday = (year: number, monthIndex: number): number => {
  let day = getDaysInMonth(year, monthIndex);
  let date = new Date(Date.UTC(year, monthIndex, day));
  let dow = date.getUTCDay();
  if (dow === 6) {
    day -= 1;
  }
  if (dow === 0) {
    day -= 2;
  }
  return day;
};

const matchesDayOfMonth = (fields: TimeFields, matcher: DayOfMonthMatcher): boolean => {
  if (matcher.any) {
    return true;
  }
  const day = fields.day;
  if (matcher.values.has(day)) {
    return true;
  }

  const year = fields.year;
  const monthIndex = fields.month - 1;
  const daysInMonth = getDaysInMonth(year, monthIndex);

  for (const offset of matcher.lastDayOffsets) {
    const expected = Math.max(1, daysInMonth - offset);
    if (day === expected) {
      return true;
    }
  }

  if (matcher.lastWeekday && day === computeLastWeekday(year, monthIndex)) {
    return true;
  }

  for (const target of matcher.nearestWeekdays) {
    if (day === nearestWeekday(year, monthIndex, target)) {
      return true;
    }
  }

  return false;
};

const matchesDayOfWeek = (fields: TimeFields, matcher: DayOfWeekMatcher): boolean => {
  if (matcher.any) {
    return true;
  }
  const dow = fields.dayOfWeek;
  if (matcher.values.has(dow)) {
    return true;
  }

  const year = fields.year;
  const monthIndex = fields.month - 1;
  const day = fields.day;

  for (const target of matcher.lastInMonth) {
    if (dow !== target) {
      continue;
    }
    const nextWeekSameDow = day + 7;
    if (nextWeekSameDow > getDaysInMonth(year, monthIndex)) {
      return true;
    }
  }

  for (const entry of matcher.nthInMonth) {
    if (dow !== entry.day) {
      continue;
    }
    const occurrence = Math.floor((day - 1) / 7) + 1;
    if (occurrence === entry.nth) {
      return true;
    }
  }

  return false;
};

const candidateMatches = (fields: TimeFields, spec: CronSpec): boolean => {
  const sec = fields.second;
  const min = fields.minute;
  const hour = fields.hour;
  const dom = fields.day;
  const month = fields.month;
  const year = fields.year;

  const domMatches = matchesDayOfMonth(fields, spec.dayOfMonth);
  const dowMatches = matchesDayOfWeek(fields, spec.dayOfWeek);
  const domActive = !spec.dayOfMonth.ignore;
  const dowActive = !spec.dayOfWeek.ignore;
  let dayMatches: boolean;

  if (domActive && dowActive) {
    dayMatches = domMatches || dowMatches;
  } else if (domActive) {
    dayMatches = domMatches;
  } else if (dowActive) {
    dayMatches = dowMatches;
  } else {
    dayMatches = true;
  }

  return (
    matchesField(sec, spec.seconds) &&
    matchesField(min, spec.minutes) &&
    matchesField(hour, spec.hours) &&
    matchesField(month, spec.months) &&
    dayMatches &&
    matchesField(year, spec.years)
  );
};

export const createCronPlan = (options: CronTriggerOptions & { kind: "cron" }): TriggerPlan => {
  const spec = buildSpec(options.expression);
  const maxRuns = options.maxRuns ?? Number.POSITIVE_INFINITY;
  const endAt = options.endAt ? new Date(options.endAt) : undefined;
  let emitted = 0;
  const extractFields = createTimeFieldExtractor(options.timezone);
  const allowDate = createCalendarFilter(options.calendars, options.timezone);

  return {
    kind: "cron",
    timezone: options.timezone,
    description: options.expression,
    options,
    next: (after) => {
      if (emitted >= maxRuns) {
        return undefined;
      }

      let candidate = new Date(after.getTime() + 1_000);
      const limit = 500_000;
      let iterations = 0;

      while (iterations < limit) {
        if (endAt && candidate > endAt) {
          return undefined;
        }
        const fields = extractFields(candidate);
        if (candidateMatches(fields, spec) && allowDate(candidate, fields)) {
          emitted += 1;
          return candidate;
        }
        candidate = new Date(candidate.getTime() + 1_000);
        iterations += 1;
      }

      throw new Error("Unable to find next cron occurrence within iteration limit");
    },
  };
};
