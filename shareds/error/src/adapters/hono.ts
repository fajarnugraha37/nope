import type { AppError } from "../app-error.js";
import { isAppError, fromUnknown } from "../app-error.js";
import { toProblem } from "../problem.js";

// Type-only imports
type Context = any;
type ErrorHandler = (err: Error, c: Context) => Response | Promise<Response>;

/**
 * Hono error handler
 */
export function honoErrorHandler(): ErrorHandler {
  return (err: Error, c: Context) => {
    const appError: AppError = isAppError(err) ? err : fromUnknown(err);

    const problem = toProblem(appError);
    const status = appError.status || 500;

    return c.json(problem, status, {
      "Content-Type": "application/problem+json",
    });
  };
}
