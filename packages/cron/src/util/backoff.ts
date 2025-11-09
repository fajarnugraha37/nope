export interface BackoffStrategy {
  nextDelay(attempt: number): number;
}

export interface FixedBackoffOptions {
  delayMs: number;
  jitterRatio?: number;
}

export interface ExponentialBackoffOptions {
  baseDelayMs: number;
  factor?: number;
  maxDelayMs?: number;
  jitterRatio?: number;
}

const applyJitter = (delay: number, jitterRatio = 0): number => {
  if (jitterRatio <= 0) {
    return delay;
  }
  const jitter = delay * jitterRatio;
  const min = delay - jitter;
  const max = delay + jitter;
  return Math.max(0, Math.random() * (max - min) + min);
};

export const fixedBackoff = (options: FixedBackoffOptions): BackoffStrategy => {
  const delay = Math.max(0, options.delayMs);
  return {
    nextDelay: () => applyJitter(delay, options.jitterRatio),
  };
};

export const exponentialBackoff = (options: ExponentialBackoffOptions): BackoffStrategy => {
  const factor = options.factor ?? 2;
  const maxDelay = options.maxDelayMs ?? Number.MAX_SAFE_INTEGER;
  return {
    nextDelay: (attempt) => {
      const exp = options.baseDelayMs * Math.pow(factor, attempt - 1);
      const bounded = Math.min(exp, maxDelay);
      return applyJitter(bounded, options.jitterRatio);
    },
  };
};

export const customBackoff = (fn: (attempt: number) => number): BackoffStrategy => ({
  nextDelay: (attempt) => Math.max(0, fn(attempt)),
});
