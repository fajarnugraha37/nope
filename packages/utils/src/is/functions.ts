import { isObj } from "./primitives.js";

export const isFunc = (x: unknown): x is (...args: any[]) => any =>
  typeof x === "function";

export const isAsyncFunc = (
  x: unknown
): x is (...args: any[]) => Promise<any> =>
  isFunc(x) && x.constructor.name === "AsyncFunction";

export const isPromise = <T = unknown>(x: unknown): x is Promise<T> =>
  isObj(x) && isFunc((x as any).then) && isFunc((x as any).catch);
