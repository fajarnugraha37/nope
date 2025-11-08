export interface TimedResult<T> {
  durationMs: number;
  result: T;
}

export const timeIt = <T>(fn: () => T): TimedResult<T> => {
  const start = performance.now();
  const result = fn();
  const durationMs = performance.now() - start;
  return { result, durationMs };
};

export const timeItAsync = async <T>(fn: () => Promise<T>): Promise<TimedResult<T>> => {
  const start = performance.now();
  const result = await fn();
  const durationMs = performance.now() - start;
  return { result, durationMs };
};
