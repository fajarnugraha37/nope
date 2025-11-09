import type { AppError } from "../app-error.js";
import { isAppError, fromUnknown } from "../app-error.js";
import { toProblem } from "../problem.js";

// Type-only imports
type FastifyInstance = any;
type FastifyRequest = any;
type FastifyReply = any;
type FastifyError = any;

/**
 * Fastify error handler
 */
export function fastifyErrorHandler(fastify: FastifyInstance): void {
  if (!fastify || typeof fastify.setErrorHandler !== "function") {
    throw new Error("Invalid Fastify instance");
  }

  fastify.setErrorHandler(
    (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
      const appError: AppError = isAppError(error) ? error : fromUnknown(error);

      const problem = toProblem(appError);
      const status = appError.status || 500;

      reply.status(status).type("application/problem+json").send(problem);
    }
  );
}
