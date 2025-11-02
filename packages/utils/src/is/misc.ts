import { isStr } from "./primitives.js";

export const isBrowser = (): boolean =>
  typeof window !== "undefined" && typeof document !== "undefined";

export const isNode = (): boolean =>
  typeof process !== "undefined" && !!(process.versions as any)?.node;

export const isJson = (x: string): boolean => {
  if (!isStr(x)) return false;
  try {
    JSON.parse(x);
    return true;
  } catch {
    return false;
  }
};


export const isReadableStreamWeb = (x: unknown): x is ReadableStream<any> =>
  typeof (globalThis as any).ReadableStream !== "undefined" &&
  x instanceof (globalThis as any).ReadableStream;

export const isReadableStreamNode = (x: unknown): x is import("stream").Readable => {
  try {
    const { Readable } = require("stream") as typeof import("stream");
    return x instanceof Readable;
  } catch {
    return false;
  }
};

/** does a path exist (node only). resolves false in non-node envs */
export const isPathExists = async (p: unknown) => {
  if (typeof p !== "string") return false;
  try {
    const fs = require("fs/promises") as typeof import("fs/promises");
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
};

/** is a regular file (node only) */
export const isFile = async (p: unknown) => {
  if (typeof p !== "string") return false;
  try {
    const fs = require("fs/promises") as typeof import("fs/promises");
    const s = await fs.stat(p);
    return s.isFile();
  } catch {
    return false;
  }
};

/** reads & validates JSON file shape using a value guard (node only) */
export const isJsonFile =
  <T>(valueGuard: (x: unknown) => x is T) =>
  async (p: unknown) => {
    if (!(await isFile(p))) return false;
    try {
      const fs = require("fs/promises") as typeof import("fs/promises");
      const raw = await fs.readFile(p as string, "utf8");
      const data = JSON.parse(raw);
      return valueGuard(data);
    } catch {
      return false;
    }
  };

/** async iterable checks */
export const isAsyncIterable = <T = unknown>(x: unknown): x is AsyncIterable<T> =>
  x != null && typeof (x as any)[Symbol.asyncIterator] === "function";

export const isIterable = <T = unknown>(x: unknown): x is Iterable<T> =>
  x != null && typeof (x as any)[Symbol.iterator] === "function";

/** arraybuffer / typedarray guards */
export const isArrayBuffer = (x: unknown): x is ArrayBuffer => x instanceof ArrayBuffer;
export const isTypedArray = (x: unknown): x is
  | Int8Array | Uint8Array | Uint8ClampedArray
  | Int16Array | Uint16Array
  | Int32Array | Uint32Array
  | Float32Array | Float64Array
  | BigInt64Array | BigUint64Array =>
  ArrayBuffer.isView(x) && !(x instanceof DataView);

/** blob/file (web), fallback-safe */
export const isBlob = (x: unknown): x is Blob =>
  typeof (globalThis as any).Blob !== "undefined" && x instanceof (globalThis as any).Blob;

export const isWebFile = (x: unknown): x is File =>
  typeof (globalThis as any).File !== "undefined" && x instanceof (globalThis as any).File;