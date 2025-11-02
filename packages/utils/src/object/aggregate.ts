export function groupBy<T, K extends PropertyKey>(
  xs: Iterable<T>,
  key: (t: T) => K
): Record<K, T[]> {
  const out = {} as Record<K, T[]>;
  for (const x of xs) {
    const k = key(x);
    (out[k] ??= []).push(x);
  }
  return out;
}

export function indexBy<T, K extends PropertyKey>(
  xs: Iterable<T>,
  key: (t: T) => K
): Record<K, T> {
  const out = {} as Record<K, T>;
  for (const x of xs) out[key(x)] = x;
  return out;
}

export function countBy<T, K extends PropertyKey>(
  xs: Iterable<T>,
  key: (t: T) => K
): Record<K, number> {
  const out = {} as Record<K, number>;
  for (const x of xs) out[key(x)] = (out[key(x)] ?? 0) + 1;
  return out;
}
