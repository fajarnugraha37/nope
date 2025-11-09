import type { CalendarRule } from "../api.js";
import type { TimeFieldExtractor, TimeFields } from "./tz.js";
import { createTimeFieldExtractor } from "./tz.js";

type CalendarKey = string;

interface CalendarPattern {
  year?: number;
  month?: number;
  day?: number;
}

const normalizeEntry = (value: string): { key?: CalendarKey; pattern?: CalendarPattern } => {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4}|\*)-(\d{2}|\*)-(\d{2}|\*)$/);
  if (!match) {
    throw new Error(`Unsupported calendar entry '${value}'. Use YYYY-MM-DD with optional '*' wildcards.`);
  }
  const [year, month, day] = match.slice(1) as [string, string, string];
  const parts = {
    year: year === "*" ? undefined : Number(year),
    month: month === "*" ? undefined : Number(month),
    day: day === "*" ? undefined : Number(day),
  };
  if (parts.month && (parts.month < 1 || parts.month > 12)) {
    throw new Error(`Invalid month in calendar entry '${value}'`);
  }
  if (parts.day && (parts.day < 1 || parts.day > 31)) {
    throw new Error(`Invalid day in calendar entry '${value}'`);
  }
  if (parts.year !== undefined || parts.month !== undefined || parts.day !== undefined) {
    if (year !== "*" && month !== "*" && day !== "*") {
      const key = `${year}-${month}-${day}`;
      return { key };
    }
  }
  return { pattern: parts };
};

const dateKey = (fields: TimeFields): CalendarKey => {
  const month = String(fields.month).padStart(2, "0");
  const day = String(fields.day).padStart(2, "0");
  return `${fields.year}-${month}-${day}`;
};

const matchesPattern = (fields: TimeFields, pattern: CalendarPattern): boolean => {
  if (pattern.year !== undefined && pattern.year !== fields.year) {
    return false;
  }
  if (pattern.month !== undefined && pattern.month !== fields.month) {
    return false;
  }
  if (pattern.day !== undefined && pattern.day !== fields.day) {
    return false;
  }
  return true;
};

export const createCalendarFilter = (
  rules: CalendarRule[] | undefined,
  timezone?: string
): ((date: Date, fields?: TimeFields) => boolean) => {
  if (!rules || rules.length === 0) {
    return () => true;
  }

  const includes = new Set<CalendarKey>();
  const includePatterns: CalendarPattern[] = [];
  const excludes = new Set<CalendarKey>();
  const excludePatterns: CalendarPattern[] = [];

  for (const rule of rules) {
    if (rule.include) {
      for (const entry of rule.include) {
        const parsed = normalizeEntry(entry);
        if (parsed.key) {
          includes.add(parsed.key);
        } else if (parsed.pattern) {
          includePatterns.push(parsed.pattern);
        }
      }
    }
    if (rule.exclude) {
      for (const entry of rule.exclude) {
        const parsed = normalizeEntry(entry);
        if (parsed.key) {
          excludes.add(parsed.key);
        } else if (parsed.pattern) {
          excludePatterns.push(parsed.pattern);
        }
      }
    }
  }

  const extractor = createTimeFieldExtractor(timezone);
  const hasIncludes = includes.size > 0 || includePatterns.length > 0;

  return (date: Date, providedFields?: TimeFields): boolean => {
    const fields = providedFields ?? extractor(date);
    const key = dateKey(fields);
    if (excludes.has(key) || excludePatterns.some((pattern) => matchesPattern(fields, pattern))) {
      return false;
    }
    if (!hasIncludes) {
      return true;
    }
    return includes.has(key) || includePatterns.some((pattern) => matchesPattern(fields, pattern));
  };
};
