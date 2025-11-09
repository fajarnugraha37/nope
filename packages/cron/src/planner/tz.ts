export interface TimeFields {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  dayOfWeek: number;
}

export type TimeFieldExtractor = (date: Date) => TimeFields;

const WEEKDAY_TO_INDEX: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

const REQUIRED_PARTS = new Set<keyof Omit<TimeFields, "dayOfWeek">>(["year", "month", "day", "hour", "minute", "second"]);

const createUtcExtractor = (): TimeFieldExtractor => {
  return (date) => ({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds(),
    dayOfWeek: date.getUTCDay(),
  });
};

const parseWeekday = (value?: string): number => {
  if (!value) {
    throw new Error("Intl formatter did not provide weekday part");
  }
  const key = value.slice(0, 3).toLowerCase();
  const mapped = WEEKDAY_TO_INDEX[key];
  if (typeof mapped !== "number") {
    throw new Error(`Unsupported weekday value '${value}' from Intl formatter`);
  }
  return mapped;
};

export const createTimeFieldExtractor = (timezone?: string): TimeFieldExtractor => {
  if (!timezone) {
    return createUtcExtractor();
  }

  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
  } catch (error) {
    throw new Error(`Invalid timezone '${timezone}': ${(error as Error).message}`);
  }

  return (date) => {
    const parts = formatter.formatToParts(date);
    const bucket: Partial<Record<string, string>> = {};

    for (const part of parts) {
      if (part.type === "literal") {
        continue;
      }
      bucket[part.type] = part.value;
    }

    for (const key of REQUIRED_PARTS) {
      if (!bucket[key]) {
        throw new Error(`Intl formatter missing '${key}' part for timezone '${timezone}'`);
      }
    }

    return {
      year: Number(bucket.year),
      month: Number(bucket.month),
      day: Number(bucket.day),
      hour: Number(bucket.hour),
      minute: Number(bucket.minute),
      second: Number(bucket.second),
      dayOfWeek: parseWeekday(bucket.weekday),
    };
  };
};
