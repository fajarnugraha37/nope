import type { ErrLike, ErrFn } from "./guard.js";
import { toErr } from "./guard.js";

export function assert(cond: unknown, err?: ErrLike | ErrFn): asserts cond {
  if (!cond)
    throw toErr(err) instanceof Error
      ? toErr(err)
      : new Error(String(toErr(err)));
}

export function unreachable(_x: never, err?: ErrLike | ErrFn): never {
  throw toErr(err) instanceof Error
    ? toErr(err)
    : new Error(String(toErr(err)));
}

export function assertUnreachable(x: never, err?: ErrLike | ErrFn): never {
  throw toErr(err) instanceof Error
    ? toErr(err)
    : new Error(String(toErr(err)));
}