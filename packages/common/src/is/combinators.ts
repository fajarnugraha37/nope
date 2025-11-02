import { isObj } from "./primitives.js";

/** match literal values: isOneOf(x, 'a', 'b', 'c') */
export const isOneOf = <T extends readonly unknown[]>(
  x: unknown,
  ...vals: T
): x is T[number] => vals.includes(x);

/** runtime-safe type guards using user-supplied predicate per key */
export function isShape<T extends Record<string, (x: any) => boolean>>(
  obj: unknown,
  shape: T
): obj is {
  [K in keyof T]: T[K] extends (x: any) => x is infer U ? U : unknown;
} {
  if (!isObj(obj)) return false;
  return Object.entries(shape).every(([k, pred]) => pred((obj as any)[k]));
}