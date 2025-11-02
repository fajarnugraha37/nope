export function* range(
  start: number,
  end?: number,
  step = 1
): Generator<number> {
  if (end === undefined) {
    end = start;
    start = 0;
  }
  if (step === 0) throw new Error("step cannot be 0");
  const forward = step > 0;
  for (let i = start; forward ? i < end : i > end; i += step) yield i;
}
export function* count(start = 0, step = 1): Generator<number> {
  for (let i = start; ; i += step) yield i;
}
export function* repeat<T>(value: T, times?: number) {
  if (times == null) while (true) yield value;
  else for (let i = 0; i < times; i++) yield value;
}
export function* cycle<T>(src: Iterable<T>) {
  const cache: T[] = [];
  for (const x of src) {
    cache.push(x);
    yield x;
  }
  if (cache.length === 0) return;
  while (true) for (const x of cache) yield x;
}
