/** element-wise guard: every(item) satisfies pred */
export const isArrayOf =
  <T>(pred: (x: unknown) => x is T) =>
  (xs: unknown): xs is T[] =>
    Array.isArray(xs) && xs.every(pred);

/** record guard: own-keys only, every value satisfies pred (keys must be strings) */
export const isRecordOf =
  <T>(pred: (x: unknown) => x is T) =>
  (x: unknown): x is Record<string, T> =>
    typeof x === "object" &&
    x !== null &&
    !Array.isArray(x) &&
    Object.keys(x).every(
      (k) => Object.prototype.hasOwnProperty.call(x, k) && pred((x as any)[k])
    );

/** tuple guard (fixed-length, per-slot predicates) */
export const isTuple =
  <A>(a: (x: unknown) => x is A) =>
  (xs: unknown): xs is [A] =>
    Array.isArray(xs) && xs.length === 1 && a(xs[0]);

export const isTuple2 =
  <A, B>(a: (x: unknown) => x is A, b: (x: unknown) => x is B) =>
  (xs: unknown): xs is [A, B] =>
    Array.isArray(xs) && xs.length === 2 && a(xs[0]) && b(xs[1]);

export const isTuple3 =
  <A, B, C>(
    a: (x: unknown) => x is A,
    b: (x: unknown) => x is B,
    c: (x: unknown) => x is C
  ) =>
  (xs: unknown): xs is [A, B, C] =>
    Array.isArray(xs) && xs.length === 3 && a(xs[0]) && b(xs[1]) && c(xs[2]);

/** union combiner: any predicate passes */
export const isUnion =
  <A, B>(a: (x: unknown) => x is A, b: (x: unknown) => x is B) =>
  (x: unknown): x is A | B =>
    a(x) || b(x);

export const isUnion3 =
  <A, B, C>(
    a: (x: unknown) => x is A,
    b: (x: unknown) => x is B,
    c: (x: unknown) => x is C
  ) =>
  (x: unknown): x is A | B | C =>
    a(x) || b(x) || c(x);

/** async predicate adapter: wrap sync guard into a Promise guard (useful for pipelines) */
export const toAsync =
  <T>(pred: (x: unknown) => x is T) =>
  async (x: unknown) =>
    pred(x);

// /** logical all/any for async guards */
export const asyncEvery =
  <T>(preds: Array<(x: unknown) => x is T>) =>
  async (x: unknown) =>
    (await Promise.all(preds.map((p) => p(x)))).every(Boolean) as boolean;

// export const asyncSome =
<T>(preds: Array<(x: unknown) => x is T>) =>
  async (x: unknown) =>
    (await Promise.all(preds.map((p) => p(x)))).some(Boolean) as boolean;
