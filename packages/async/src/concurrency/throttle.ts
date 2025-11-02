import type { Fn } from "./concurrency.js";

export function throttle<A extends any[], R>(
  fn: Fn<A, R>,
  interval: number,
  opts: { leading?: boolean; trailing?: boolean; signal?: AbortSignal } = {}
) {
  const { leading = true, trailing = false, signal } = opts;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: A | undefined;
  let lastThis: any;
  let lastInvokeTime: number | undefined;

  const invoke = (time: number) => {
    lastInvokeTime = time;
    const args = lastArgs!;
    const ctx = lastThis;
    lastArgs = undefined;
    lastThis = undefined;
    return fn.apply(ctx, args);
  };

  const remainingWait = (time: number) => {
    if (lastInvokeTime === undefined) {
      return 0;
    }
    const timeSinceLastCall = time - lastInvokeTime;
    return timeSinceLastCall >= interval ? 0 : interval - timeSinceLastCall;
  };

  const trailingEdge = () => {
    timer = undefined;
    if (!signal?.aborted && trailing && lastArgs) {
      invoke(Date.now());
    } else {
      lastArgs = undefined;
      lastThis = undefined;
    }
  };

  const throttled = function (this: any, ...args: A) {
    if (signal?.aborted) {
      (throttled as any).cancel();
      return;
    }
    const time = Date.now();

    if (lastInvokeTime === undefined && !leading) {
      lastInvokeTime = time;
    }

    lastArgs = args;
    lastThis = this;

    const wait = remainingWait(time);

    if (wait === 0) {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      invoke(time);
    } else if (trailing && timer === undefined) {
      timer = setTimeout(trailingEdge, wait);
    }
  } as Fn<A, void>;

  (throttled as any).cancel = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    lastArgs = undefined;
    lastThis = undefined;
    lastInvokeTime = undefined;
  };

  return throttled as Fn<A, void> & { cancel(): void };
}
