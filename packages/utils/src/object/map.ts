export function mapGetOrSet<K, V>(m: Map<K, V>, k: K, init: () => V): V {
  if (m.has(k)) return m.get(k)!;
  const v = init();
  m.set(k, v);
  return v;
}
export const mapEnsure = mapGetOrSet;

export function mapUpsert<K, V>(
  m: Map<K, V>,
  k: K,
  f: (prev: V | undefined) => V
): V {
  const next = f(m.get(k));
  m.set(k, next);
  return next;
}

export function mapMapValues<K, A, B>(
  m: Map<K, A>,
  f: (v: A, k: K) => B
): Map<K, B> {
  const out = new Map<K, B>();
  for (const [k, v] of m) out.set(k, f(v, k));
  return out;
}

export function mapFilter<K, V>(
  m: Map<K, V>,
  p: (v: V, k: K) => boolean
): Map<K, V> {
  const out = new Map<K, V>();
  for (const [k, v] of m) if (p(v, k)) out.set(k, v);
  return out;
}

export function mergeMaps<K, V>(
  target: Map<K, V>,
  src: Map<K, V>,
  resolve: (a: V | undefined, b: V) => V = (_a, b) => b
): Map<K, V> {
  for (const [k, v] of src) target.set(k, resolve(target.get(k), v));
  return target;
}

/* ---------- object <-> Map ---------- */
export function objectToMap<V>(o: Record<PropertyKey, V>): Map<PropertyKey, V> {
  const m = new Map<PropertyKey, V>();
  for (const [k, v] of Object.entries(o)) m.set(k, v);
  return m;
}
export function mapToObject<K extends PropertyKey, V>(
  m: Map<K, V>
): Record<K, V> {
  const o = {} as Record<K, V>;
  for (const [k, v] of m) (o as any)[k] = v;
  return o;
}

/* ---------- group/index -> Map ---------- */
export function mapGroupBy<T, K>(
  xs: Iterable<T>,
  key: (t: T) => K
): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const x of xs) mapEnsure(m, key(x), () => []).push(x);
  return m;
}
export function mapIndexBy<T, K>(xs: Iterable<T>, key: (t: T) => K): Map<K, T> {
  const m = new Map<K, T>();
  for (const x of xs) m.set(key(x), x);
  return m;
}

/* ---------- MultiMap ---------- */
export class MultiMap<K, V> {
  private m = new Map<K, V[]>();
  add(k: K, v: V) {
    mapEnsure(this.m, k, () => []).push(v);
  }
  get(k: K): V[] {
    return this.m.get(k) ?? [];
  }
  delete(k: K, v?: V) {
    if (v === undefined) return this.m.delete(k);
    const arr = this.m.get(k);
    if (!arr) return false;
    const i = arr.indexOf(v);
    if (i >= 0) arr.splice(i, 1);
    if (arr.length === 0) this.m.delete(k);
    return i >= 0;
  }
  keys() {
    return this.m.keys();
  }
  entries() {
    return this.m.entries();
  }
  clear() {
    this.m.clear();
  }
}
