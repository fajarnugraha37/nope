import type { AppError } from "./app-error.js";
import { fromUnknown } from "./app-error.js";

/**
 * Result type for representing success or failure
 */
export type Result<T, E = AppError> =
  | { ok: true; value: T; error: null }
  | { ok: false; value: null; error: E };

/**
 * Create a success result
 */
export function ok<T>(value: T): ResultWrapper<T, never> {
  return new ResultWrapper({ ok: true, value, error: null } as Result<
    T,
    never
  >);
}

/**
 * Create an error result
 */
export function err<E = AppError>(error: E): ResultWrapper<never, E> {
  return new ResultWrapper({ ok: false, value: null, error } as Result<
    never,
    E
  >);
}

/**
 * Fluent API wrapper for Result
 */
export class ResultWrapper<T, E = AppError> {
  constructor(private readonly result: Result<T, E>) {}

  /**
   * Get the underlying result
   */
  unwrapResult(): Result<T, E> {
    return this.result;
  }

  /**
   * Check if result is success
   */
  isOk(): boolean {
    return this.result.ok === true;
  }

  /**
   * Check if result is error
   */
  isErr(): boolean {
    return this.result.ok === false;
  }

  /**
   * Map over success value
   */
  map<U>(fn: (value: T) => U): ResultWrapper<U, E> {
    if (this.result.ok) {
      return new ResultWrapper({
        ok: true,
        value: fn(this.result.value),
        error: null,
      } as Result<U, E>);
    }
    return new ResultWrapper(this.result as Result<U, E>);
  }

  /**
   * Map over success value asynchronously
   */
  async mapAsync<U>(
    fn: (value: T) => Promise<U>
  ): Promise<ResultWrapper<U, E>> {
    if (this.result.ok) {
      try {
        const value = await fn(this.result.value);
        return new ResultWrapper({ ok: true, value, error: null } as Result<
          U,
          E
        >);
      } catch (error) {
        return new ResultWrapper({
          ok: false,
          value: null,
          error: fromUnknown(error) as E,
        } as Result<U, E>);
      }
    }
    return new ResultWrapper(this.result as Result<U, E>);
  }

  /**
   * Map over error value
   */
  mapErr<F>(fn: (error: E) => F): ResultWrapper<T, F> {
    if (!this.result.ok) {
      return new ResultWrapper({
        ok: false,
        value: null,
        error: fn(this.result.error),
      } as Result<T, F>);
    }
    return new ResultWrapper(this.result as Result<T, F>);
  }

  /**
   * FlatMap/Chain - map and flatten nested Results
   */
  flatMap<U, F>(fn: (value: T) => ResultWrapper<U, F>): ResultWrapper<U, E | F> {
    if (this.result.ok) {
      return fn(this.result.value) as ResultWrapper<U, E | F>;
    }
    return new ResultWrapper(this.result as Result<U, E | F>);
  }

  /**
   * Execute function if result is success
   */
  tap(fn: (value: T) => void): ResultWrapper<T, E> {
    if (this.result.ok) {
      fn(this.result.value);
    }
    return this;
  }

  /**
   * Execute function if result is error
   */
  tapErr(fn: (error: E) => void): ResultWrapper<T, E> {
    if (!this.result.ok) {
      fn(this.result.error);
    }
    return this;
  }

  /**
   * Unwrap value or throw error
   */
  unwrap(): T {
    if (this.result.ok) {
      return this.result.value;
    }
    throw this.result.error;
  }

  /**
   * Unwrap error or throw
   */
  unwrapErr(): E {
    if (!this.result.ok) {
      return this.result.error;
    }
    throw new Error("Called unwrapErr on an Ok result");
  }

  /**
   * Get value or default
   */
  unwrapOr(defaultValue: T): T {
    return this.result.ok ? this.result.value : defaultValue;
  }

  /**
   * Get value or compute default from error
   */
  unwrapOrElse(fn: (error: E) => T): T {
    return this.result.ok ? this.result.value : fn(this.result.error);
  }

  /**
   * Match on result with handlers
   */
  match<U>(handlers: { ok: (value: T) => U; err: (error: E) => U }): U {
    return this.result.ok
      ? handlers.ok(this.result.value)
      : handlers.err(this.result.error);
  }

  /**
   * Convert to promise
   */
  toPromise(): Promise<T> {
    return this.result.ok
      ? Promise.resolve(this.result.value)
      : Promise.reject(this.result.error);
  }

  /**
   * Combine with another result (both must succeed)
   */
  and<U, F>(other: ResultWrapper<U, F>): ResultWrapper<[T, U], E | F> {
    if (this.result.ok && other.result.ok) {
      return new ResultWrapper({
        ok: true,
        value: [this.result.value, other.result.value] as [T, U],
        error: null,
      } as Result<[T, U], E | F>);
    }
    if (!this.result.ok) {
      return new ResultWrapper(this.result as Result<[T, U], E | F>);
    }
    return new ResultWrapper(other.result as Result<[T, U], E | F>);
  }

  /**
   * Use this result if error, otherwise use other
   */
  or<F>(other: ResultWrapper<T, F>): ResultWrapper<T, E | F> {
    if (this.result.ok) {
      return this as ResultWrapper<T, E | F>;
    }
    return other as ResultWrapper<T, E | F>;
  }
}

/**
 * Safely await a promise, returning [error, result] tuple
 */
export async function safeAwait<T>(
  promise: PromiseLike<T>
): Promise<ResultWrapper<T, AppError>> {
  try {
    const value = await promise;
    return ok(value);
  } catch (error) {
    return err(fromUnknown(error));
  }
}

/**
 * Safely execute a function, returning a Result
 * @param fn
 * @returns
 */
export function safeFunc<T, A extends any[]>(
  fn: (...args: A) => T,
  ...args: A
): ResultWrapper<T, AppError> {
  try {
    const value = fn(...args);
    return ok(value);
  } catch (error) {
    return err(fromUnknown(error));
  }
}

/**
 * Check if result is success
 */
export function isOk<T, E>(
  result: Result<T, E>
): result is { ok: true; value: T; error: null } {
  return result.ok === true;
}

/**
 * Check if result is error
 */
export function isErr<T, E>(
  result: Result<T, E>
): result is { ok: false; value: null; error: E } {
  return result.ok === false;
}

/**
 * Unwrap a result, throwing if error
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) {
    return result.value;
  }
  throw result.error;
}

/**
 * Unwrap a result error, throwing if success
 */
export function unwrapErr<T, E>(result: Result<T, E>): E {
  if (!result.ok) {
    return result.error;
  }
  throw new Error("Called unwrapErr on an Ok result");
}

/**
 * Get value or default
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  return result.ok ? result.value : defaultValue;
}

/**
 * Map over success value
 */
export function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  return result.ok
    ? ({ ok: true, value: fn(result.value), error: null } as Result<U, E>)
    : (result as Result<U, E>);
}

/**
 * Map over error value
 */
export function mapErr<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> {
  return result.ok
    ? (result as Result<T, F>)
    : ({ ok: false, value: null, error: fn(result.error) } as Result<T, F>);
}
