import type { AppError } from "../app-error.js";
import { isAppError, fromUnknown } from "../app-error.js";
import { toProblem } from "../problem.js";

// Type-only imports
type H3Event = any;
type H3Error = any;
type EventHandler = (event: H3Event) => any;

/**
 * H3 error handler
 */
export function h3ErrorHandler(): EventHandler {
  return (event: H3Event) => {
    const error = event.node?.res?.__error || event.error;

    if (!error) {
      return;
    }

    const appError: AppError = isAppError(error) ? error : fromUnknown(error);

    const problem = toProblem(appError);
    const status = appError.status || 500;

    event.node.res.statusCode = status;
    event.node.res.setHeader("Content-Type", "application/problem+json");

    return problem;
  };
}

/**
 * Create H3 error from AppError
 */
export function createH3Error(appError: AppError): H3Error {
  const problem = toProblem(appError);

  // H3 createError shape
  return {
    statusCode: appError.status || 500,
    statusMessage: appError.message,
    data: problem,
  };
}
