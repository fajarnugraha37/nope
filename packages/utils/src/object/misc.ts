import { getIn, setIn } from "./extras.ts";
import { entries } from "./record.js";

/* ---------- invert, compact, merge ---------- */
export function invert<K extends PropertyKey, V extends PropertyKey>(
  r: Record<K, V>
): Record<V, K> {
  const out = {} as Record<V, K>;
  for (const [k, v] of entries(r)) (out as any)[v] = k as any;
  return out;
}

export function compact<T extends object>(o: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of entries(o)) if (v != null) (out[k] = v);
  return out;
}

/** deep-merge plain objects (no arrays/dates/sets) */
export function mergeDeep<T extends object, U extends object>(a: T, b: U): T & U {
  const out: any = { ...a };
  for (const [k, v] of Object.entries(b as any)) {
    const av = (out as any)[k];
    if (isPlain(av) && isPlain(v)) (out as any)[k] = mergeDeep(av, v as any);
    else (out as any)[k] = v;
  }
  return out;
}
const isPlain = (x: any) => x && typeof x === "object" && Object.getPrototypeOf(x) === Object.prototype;

/* ---------- deep get/set (immutable) ---------- */
type PathKey = string | number | symbol;
// export function getIn<T, D = undefined>(obj: T, path: readonly PathKey[], def = undefined as D): any | D {
//   let cur: any = obj;
//   for (const p of path) {
//     if (cur == null) return def;
//     cur = cur[p as any];
//   }
//   return cur ?? def;
// }

// export function setIn<T extends object>(obj: T, path: readonly PathKey[], value: any): T {
//   if (path.length === 0) return value as T;
//   const [h, ...rest] = path;
//   const clone = Array.isArray(obj) ? obj.slice() as any : { ...obj } as any;
//   clone[h!] = rest.length ? setIn((obj as any)?.[h!] ?? (typeof rest[0] === "number" ? [] : {}), rest, value) : value;
//   return clone;
// }

export function updateIn<T extends object, R>(
  obj: T, path: readonly PathKey[], f: (x: any) => R
): T {
  const cur = getIn(obj, path);
  return setIn(obj, path, f(cur));
}