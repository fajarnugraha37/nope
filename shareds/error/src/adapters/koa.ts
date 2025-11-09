import type { AppError } from "../app-error.js";
import { isAppError, fromUnknown } from "../app-error.js";
import { toProblem } from "../problem.js";

// Type-only imports
type Context = any;
type Next = any;
type Middleware = (ctx: Context, next: Next) => Promise<void>;

/**
 * Koa error middleware
 */
export function koaErrorMiddleware(): Middleware {
  return async (ctx: Context, next: Next) => {
    try {
      await next();
    } catch (err: unknown) {
      const appError: AppError = isAppError(err) ? err : fromUnknown(err);

      const problem = toProblem(appError);
      const status = appError.status || 500;

      ctx.status = status;
      ctx.type = "application/problem+json";
      ctx.body = problem;

      // Emit error event for Koa's error handling
      ctx.app.emit("error", appError, ctx);
    }
  };
}
