import type { AppError } from "../app-error.js";
import { isAppError, fromUnknown } from "../app-error.js";
import { toProblem } from "../problem.js";

// Type-only imports
type Context = any;
type ErrorHandler = (context: { error: Error; code: string; set: any }) => any;

/**
 * Elysia error handler
 */
export function elysiaErrorHandler(): ErrorHandler {
  return ({ error, code, set }: { error: Error; code: string; set: any }) => {
    const appError: AppError = isAppError(error) ? error : fromUnknown(error);

    const problem = toProblem(appError);
    const status = appError.status || 500;

    set.status = status;
    set.headers["Content-Type"] = "application/problem+json";

    return problem;
  };
}
