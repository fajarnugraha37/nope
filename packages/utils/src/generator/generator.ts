export type MaybeAsync<T> = T | Promise<T>;
export type Pred<T> = (x: T, i: number) => boolean;
export type MapFn<T, U> = (x: T, i: number) => U;
export type Cmp<T> = (a: T, b: T) => number;