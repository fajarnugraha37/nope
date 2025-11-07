import { Observable } from "./observable.js";
import type { Stream } from "./stream.js";

export const checkStreamOrObservableInput = (arg$: any, isArray = false) => {
  if (isArray) {
    return (
      Array.isArray(arg$) && arg$.every((arg) => arg instanceof Observable)
    );
  } else {
    return arg$ instanceof Observable;
  }
};

export const useUnsubscribeCallback = (stream$: Stream, length: number) => {
  let unsubscribeCount = 0;
  const unsubscribeCallback = () => {
    unsubscribeCount += 1;
    if (unsubscribeCount === length) {
      setTimeout(() => {
        stream$.unsubscribe();
      });
    }
  };
  return { unsubscribeCallback };
};

export const getGlobalFluthFactory = () => {
  if (typeof globalThis !== "undefined") {
    // @ts-expect-error globalThis is not defined in browser
    return globalThis.__fluth_global_factory__;
  } else if (typeof window !== "undefined") {
    // @ts-expect-error window is not defined in node
    return window.__fluth_global_factory__;
  } else if (typeof global !== "undefined") {
    // @ts-expect-error global is not defined in browser
    return global.__fluth_global_factory__;
  } else if (typeof self !== "undefined") {
    // @ts-expect-error self is not defined in browser
    return self.__fluth_global_factory__;
  } else {
    return undefined;
  }
};
