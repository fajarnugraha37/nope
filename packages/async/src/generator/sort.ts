import type { Cmp } from "./generator.js";

export function* mergeSorted<T>(cmp: Cmp<T>, ...iters: Iterable<T>[]) {
  const its = iters.map((i) => i[Symbol.iterator]());
  const heads = its.map((it) => it.next());
  while (true) {
    let minIdx = -1;
    for (let i = 0; i < heads.length; i++) {
      if (heads[i]?.done) continue;
      if (minIdx === -1 || cmp(heads[i]?.value, heads[minIdx]?.value) < 0)
        minIdx = i;
    }
    if (minIdx === -1) return;
    yield heads[minIdx]?.value;
    heads[minIdx] = its[minIdx]!.next();
  }
}
