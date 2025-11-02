export const hasOwn = <T extends object, K extends PropertyKey>(
  o: T,
  k: K
): k is Extract<K, keyof T> => Object.prototype.hasOwnProperty.call(o, k);

export const keys = <T extends object>(o: T) =>
  Object.keys(o) as Array<keyof T>;
export const entries = <T extends object>(o: T) =>
  Object.entries(o) as Array<[keyof T, T[keyof T]]>;
export const values = <T extends object>(o: T) =>
  Object.values(o) as Array<T[keyof T]>;

/* =========================
   object / record helpers
   ========================= */
export function pick<T extends object, K extends keyof T>(
  o: T,
  ks: readonly K[]
): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of ks) if (hasOwn(o, k)) out[k] = o[k];
  return out;
}

export function omit<T extends object, K extends keyof T>(
  o: T,
  ks: readonly K[]
): Omit<T, K> {
  const drop = new Set<PropertyKey>(ks as readonly PropertyKey[]);
  const out = {} as Omit<T, K>;
  for (const [k, v] of entries(o)) if (!drop.has(k)) (out as any)[k] = v;
  return out;
}

export function mapValues<T extends object, U>(
  o: T,
  f: (v: T[keyof T], k: keyof T, src: T) => U
): { [K in keyof T]: U } {
  const out: any = {};
  for (const k of keys(o)) out[k] = f(o[k], k, o);
  return out;
}

export function mapKeys<T extends object, K extends PropertyKey>(
  o: T,
  f: (k: keyof T, v: T[keyof T]) => K
): Record<K, T[keyof T]> {
  const out = {} as Record<K, T[keyof T]>;
  for (const [k, v] of entries(o)) out[f(k, v)] = v;
  return out;
}

export function filterObject<T extends object>(
  o: T,
  p: (v: T[keyof T], k: keyof T) => boolean
): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of entries(o)) if (p(v, k)) out[k] = v;
  return out;
}

export function reduceObject<T extends object, U>(
  o: T,
  f: (acc: U, v: T[keyof T], k: keyof T) => U,
  init: U
): U {
  let acc = init;
  for (const [k, v] of entries(o)) acc = f(acc, v, k);
  return acc;
}
