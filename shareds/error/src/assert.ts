import { AppError, type AppErrorOptions } from "./app-error.js";

/**
 * Assertion utilities
 */
export const assert = {
  /**
   * Assert a condition is true, throwing AppError if false
   */
  ok(
    condition: unknown,
    code: string,
    message?: string,
    data?: unknown
  ): asserts condition {
    if (!condition) {
      throw new AppError(code, message || "Assertion failed", {
        data,
        severity: "error",
      });
    }
  },

  /**
   * Assert value is defined (not null or undefined)
   */
  defined<T>(
    value: T,
    code: string,
    message?: string
  ): asserts value is NonNullable<T> {
    if (value === null || value === undefined) {
      throw new AppError(code, message || "Value must be defined", {
        severity: "error",
      });
    }
  },

  /**
   * Assert value is of expected type
   */
  type<T>(
    value: unknown,
    type: string,
    code: string,
    message?: string
  ): asserts value is T {
    const actualType = typeof value;
    if (actualType !== type) {
      throw new AppError(
        code,
        message || `Expected type ${type}, got ${actualType}`,
        {
          data: { expected: type, actual: actualType },
          severity: "error",
        }
      );
    }
  },

  /**
   * Fail with an AppError
   */
  fail(code: string, message?: string, options?: AppErrorOptions): never {
    throw new AppError(code, message, options);
  },
};
