import type { AppError } from "./app-error.js";
import { isAppError } from "./app-error.js";

export type ErrorHandler<T = unknown> = (err: AppError) => T;
export type ErrorHandlers<T = unknown> = Record<string, ErrorHandler<T>> & {
  _?: ErrorHandler<T>;
};

/**
 * Pattern match on error codes
 */
export function match<T = unknown>(
  err: unknown,
  handlers: ErrorHandlers<T>
): T {
  if (!isAppError(err)) {
    if (handlers._) {
      // Import dynamically to avoid issues
      const { fromUnknown } = require("./app-error.js");
      return handlers._(fromUnknown(err));
    }
    throw new Error("match() requires AppError or a fallback handler '_'");
  }

  const handler = handlers[err.code] || handlers._;
  if (!handler) {
    throw new Error(`No handler found for error code: ${err.code}`);
  }

  return handler(err);
}
