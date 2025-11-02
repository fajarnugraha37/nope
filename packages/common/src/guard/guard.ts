export type Guard<T> = (x: unknown) => x is T;
export type ErrLike = string | Error;
export type ErrFn = () => ErrLike;

export const toErr = (e?: ErrLike | ErrFn) =>
  (typeof e === "function" ? (e as ErrFn)() : e) ?? "invariant failed";
