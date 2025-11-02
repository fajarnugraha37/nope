export const isNil = (x: unknown): x is null | undefined =>
  x === null || x === undefined;

export const isDef = <T>(x: T | null | undefined): x is T =>
  x !== null && x !== undefined;

export const isBool = (x: unknown): x is boolean => typeof x === "boolean";

export const isNum = (x: unknown): x is number =>
  typeof x === "number" && !Number.isNaN(x);

export const isInt = (x: unknown): x is number =>
  isNum(x) && Number.isInteger(x);

export const isFiniteNum = (x: unknown): x is number =>
  isNum(x) && Number.isFinite(x);

export const isStr = (x: unknown): x is string => typeof x === "string";

export const isBigInt = (x: unknown): x is bigint => typeof x === "bigint";

export const isSym = (x: unknown): x is symbol => typeof x === "symbol";

/** -------- objects & arrays -------- */

export const isObj = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);

export const isArr = Array.isArray as <T = unknown>(x: unknown) => x is T[];

export const isDate = (x: unknown): x is Date =>
  x instanceof Date && !Number.isNaN(x.getTime());

export const isRegExp = (x: unknown): x is RegExp => x instanceof RegExp;

export const isMap = (x: unknown): x is Map<unknown, unknown> =>
  x instanceof Map;

export const isSet = (x: unknown): x is Set<unknown> => x instanceof Set;

export const isEmpty = (x: unknown): boolean => {
  if (isNil(x)) return true;
  if (isStr(x) || isArr(x)) return x.length === 0;
  if (isMap(x) || isSet(x)) return x.size === 0;
  if (isObj(x)) return Object.keys(x).length === 0;
  return false;
};
