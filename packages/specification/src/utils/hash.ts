import type { JsonValue } from "./types.js";

const DEFAULT_KEY = "__root__";

export const stableStringify = (value: JsonValue): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item as JsonValue)).join(",")}]`;
  }

  const entries = Object.entries(value)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, val]) => `"${key}":${stableStringify(val as JsonValue)}`)
    .join(",");

  return `{${entries}}`;
};

export const defaultHasher = (value: unknown): string => {
  return stableStringify({ [DEFAULT_KEY]: value as JsonValue });
};
