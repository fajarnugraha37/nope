import type { MapFn, Pred } from "./generator.js";

export function* mapG<T, U>(src: Iterable<T>, f: MapFn<T, U>) {
  let i = 0;
  for (const x of src) yield f(x, i++);
}
export function* filterG<T>(src: Iterable<T>, p: Pred<T>) {
  let i = 0;
  for (const x of src) if (p(x, i++)) yield x;
}
export function* take<T>(src: Iterable<T>, n: number) {
  if (n <= 0) return;
  let i = 0;
  for (const x of src) {
    yield x;
    if (++i >= n) break;
  }
}
export function* drop<T>(src: Iterable<T>, n: number) {
  let i = 0;
  for (const x of src) {
    if (i++ < n) continue;
    yield x;
  }
}
export function* takeWhile<T>(src: Iterable<T>, p: Pred<T>) {
  let i = 0;
  for (const x of src) {
    if (!p(x, i++)) break;
    yield x;
  }
}
export function* dropWhile<T>(src: Iterable<T>, p: Pred<T>) {
  let i = 0;
  let pass = false;
  for (const x of src) {
    pass ||= !p(x, i++);
    if (pass) yield x;
  }
}
export function* enumerate<T>(
  src: Iterable<T>,
  start = 0
): Generator<[number, T]> {
  let i = start;
  for (const x of src) yield [i++, x];
}
export function* chunk<T>(src: Iterable<T>, size: number) {
  if (size <= 0) throw new Error("chunk size must be > 0");
  let buf: T[] = [];
  for (const x of src) {
    buf.push(x);
    if (buf.length === size) {
      yield buf;
      buf = [];
    }
  }
  if (buf.length) yield buf;
}
export function* slidingWindow<T>(src: Iterable<T>, size: number, step = 1) {
  if (size <= 0 || step <= 0) throw new Error("size/step must be > 0");
  const buf: T[] = [];
  for (const x of src) {
    buf.push(x);
    if (buf.length >= size) {
      yield buf.slice(buf.length - size);
      buf.splice(0, step);
    }
  }
}
export function* flatten<T>(src: Iterable<Iterable<T>>) {
  for (const it of src) for (const x of it) yield x;
}
export function* flatMap<T, U>(src: Iterable<T>, f: MapFn<T, Iterable<U>>) {
  let i = 0;
  for (const x of src) for (const y of f(x, i++)) yield y;
}
export function* zip<T>(...iters: Iterable<T>[]) {
  const its = iters.map((i) => i[Symbol.iterator]());
  while (true) {
    const next = its.map((it) => it.next());
    if (next.some((n) => n.done)) return;
    yield next.map((n) => n.value) as T[];
  }
}
export function* interleave<T>(...iters: Iterable<T>[]) {
  const its = iters.map((i) => i[Symbol.iterator]());
  while (its.length) {
    for (let k = 0; k < its.length; k++) {
      const r = its[k]!.next();
      if (r.done) {
        its.splice(k--, 1);
        continue;
      }
      yield r.value;
    }
  }
}
export function* uniqueBy<T, K>(src: Iterable<T>, key: (x: T) => K) {
  const seen = new Set<K>();
  for (const x of src) {
    const k = key(x);
    if (!seen.has(k)) {
      seen.add(k);
      yield x;
    }
  }
}
