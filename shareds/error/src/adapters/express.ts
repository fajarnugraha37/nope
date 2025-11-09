import type { AppError } from "../app-error.js";
import { isAppError, fromUnknown } from "../app-error.js";
import { toProblem } from "../problem.js";

// Type-only imports to avoid hard dependency
type Request = any;
type Response = any;
type NextFunction = any;
type ErrorRequestHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => void;

/**
 * Express error handler middleware
 */
export function expressErrorHandler(): ErrorRequestHandler {
  return (err: unknown, req: Request, res: Response, next: NextFunction) => {
    const appError: AppError = isAppError(err) ? err : fromUnknown(err);

    const problem = toProblem(appError);
    const status = appError.status || 500;

    res.status(status).json(problem);
  };
}

/**
 * Express async handler wrapper
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
