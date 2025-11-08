export type Primitive = string | number | boolean | bigint | symbol | null | undefined;

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type MaybePromise<T> = T | Promise<T>;

export const isPromise = <T>(value: MaybePromise<T>): value is Promise<T> => {
  return typeof (value as Promise<T>)?.then === "function";
};
