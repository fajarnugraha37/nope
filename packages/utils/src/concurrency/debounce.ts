import type { Fn } from "./concurrency.js";

export function debounce<A extends any[], R>(
  fn: Fn<A, R>,
  wait: number,
  opts: {
    leading?: boolean;
    trailing?: boolean;
    maxWait?: number;
    signal?: AbortSignal;
  } = {}
) {
  const { leading = false, trailing = true, maxWait, signal } = opts;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastCallTime: number | undefined;
  let lastInvokeTime = 0;
  let lastArgs: A | undefined;
  let lastThis: any;
  let result: R | void;

  const invoke = (time: number) => {
    lastInvokeTime = time;
    const thisArg = lastThis;
    const args = lastArgs!;
    lastArgs = undefined;
    lastThis = undefined;
    result = fn.apply(thisArg, args);
    return result;
  };

  const startTimer = (ms: number) => {
    const timeout = Math.max(0, ms);
    return setTimeout(timerExpired, timeout);
  };

  const remainingWait = (time: number) => {
    if (lastCallTime === undefined) return wait;
    const sinceLastCall = time - lastCallTime;
    const timeWaiting = wait - sinceLastCall;
    if (maxWait == null) return timeWaiting;
    const sinceLastInvoke = lastInvokeTime ? time - lastInvokeTime : 0;
    const maxWaitRemaining = maxWait - sinceLastInvoke;
    return Math.min(timeWaiting, maxWaitRemaining);
  };

  const shouldInvoke = (time: number) => {
    if (lastCallTime === undefined) return true;
    const sinceLastCall = time - lastCallTime;
    if (sinceLastCall >= wait || sinceLastCall < 0) return true;
    if (maxWait == null) return false;
    if (!lastInvokeTime) return false;
    return time - lastInvokeTime >= maxWait;
  };

  const trailingEdge = (time: number) => {
    timer = null;
    if (trailing && lastArgs) {
      return invoke(time);
    }
    lastArgs = lastThis = undefined;
    return result;
  };

  const timerExpired = () => {
    const time = Date.now();
    if (!lastArgs) {
      timer = null;
      return;
    }
    if (shouldInvoke(time)) {
      return trailingEdge(time);
    }
    timer = startTimer(remainingWait(time));
  };

  const leadingEdge = (time: number) => {
    lastInvokeTime = time;
    timer = startTimer(wait);
    if (leading) {
      return invoke(time);
    }
    return result;
  };

  const debounced = function (this: any, ...args: A) {
    if (signal?.aborted) return;
    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastArgs = args;
    lastThis = this;
    lastCallTime = time;

    if (isInvoking) {
      if (!timer) {
        return leadingEdge(time);
      }
      if (maxWait != null) {
        clearTimeout(timer);
        timer = startTimer(wait);
        return invoke(time);
      }
    }

    if (!timer) {
      timer = startTimer(wait);
    }
    return result;
  } as Fn<A, void>;

  const cancel = () => {
    lastArgs = undefined;
    lastThis = undefined;
    lastCallTime = undefined;
    lastInvokeTime = 0;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const flush = () => {
    if (!timer) {
      return result;
    }
    clearTimeout(timer);
    return trailingEdge(Date.now());
  };

  (debounced as any).cancel = cancel;
  (debounced as any).flush = flush;

  return debounced as Fn<A, void> & { cancel(): void; flush(): R | void };
}
