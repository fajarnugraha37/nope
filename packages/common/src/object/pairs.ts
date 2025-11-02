import { entries } from "./record.js";

/* ---------- pairs / (de)serialization ---------- */
export type Pair<K extends PropertyKey = string, V = unknown> = [K, V];

export function toPairs<T extends object>(o: T) {
  return entries(o) as Array<Pair<keyof T, T[keyof T]>>;
}
export function fromPairs<K extends PropertyKey, V>(
  ps: Iterable<[K, V]>
): Record<K, V> {
  const out = {} as Record<K, V>;
  for (const [k, v] of ps) (out as any)[k] = v;
  return out;
}
