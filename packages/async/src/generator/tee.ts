export function tee<T>(src: Iterable<T>, n = 2): Iterable<T>[] {
  const it = src[Symbol.iterator]();
  const buffers: T[][] = Array.from({ length: n }, () => []);
  let done = false;
  function fill(i: number) {
    if (done) return;
    const r = it.next();
    if (r.done) {
      done = true;
      return;
    }
    for (const b of buffers) b.push(r.value);
  }
  return buffers.map(
    (buf, i) =>
      ({
        [Symbol.iterator](): Iterator<T> {
          return {
            next(): IteratorResult<T> {
              if (buf.length === 0 && !done) fill(i);
              if (buf.length) return { value: buf.shift()!, done: false };
              return { value: undefined as any, done: true };
            },
          };
        },
      } as Iterable<T>)
  );
}
