export function reduceG<T, U>(
  src: Iterable<T>,
  f: (acc: U, x: T, i: number) => U,
  init: U
): U {
  let acc = init,
    i = 0;
  for (const x of src) acc = f(acc, x, i++);
  return acc;
}
export const toArray = <T>(src: Iterable<T>) => Array.from(src);
export const toSet = <T>(src: Iterable<T>) => new Set(src);
export function toMap<T, K, V>(
  src: Iterable<T>,
  kf: (x: T) => K,
  vf: (x: T) => V
): Map<K, V> {
  const m = new Map<K, V>();
  for (const x of src) m.set(kf(x), vf(x));
  return m;
}
