const UNIT_TO_MS: Record<string, number> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
};

export const parseHumanDuration = (input: string | number): number => {
  if (typeof input === "number" && Number.isFinite(input)) {
    return input;
  }

  const value = String(input).trim().toLowerCase();
  if (value === "") {
    throw new Error("Duration cannot be empty");
  }

  if (/^\d+$/.test(value)) {
    return Number(value);
  }

  const match = value.match(/^(\d+)(ms|s|m|h|d|w)$/);
  if (!match) {
    throw new Error(`Unsupported duration: ${input}`);
  }

  const magnitude = Number(match[1]);
  const unit = match[2]!;
  return magnitude * UNIT_TO_MS[unit]!;
};

export const coerceDate = (value: Date | number | string): Date => {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "number") {
    return new Date(value);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date value: ${value}`);
  }
  return parsed;
};
