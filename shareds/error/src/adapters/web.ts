import type { AppError } from "../app-error.js";
import { isAppError, fromUnknown } from "../app-error.js";
import { toProblem, fromProblem } from "../problem.js";

/**
 * Convert AppError to Response (uses problem+json)
 */
export function toResponse(err: AppError, init?: ResponseInit): Response {
  if (typeof Response === "undefined") {
    throw new Error("Response is not available in this environment");
  }

  const problem = toProblem(err);
  const status = err.status || 500;

  const body = JSON.stringify(problem);

  return new Response(body, {
    ...init,
    status,
    headers: {
      "Content-Type": "application/problem+json",
      ...init?.headers,
    },
  });
}

/**
 * Convert Response to AppError (expects problem+json)
 */
export async function fromResponse(res: Response): Promise<AppError> {
  if (typeof Response === "undefined") {
    throw new Error("Response is not available in this environment");
  }

  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/problem+json")) {
    try {
      const problem = await res.json();
      return fromProblem(problem);
    } catch (parseError) {
      return fromUnknown(parseError);
    }
  }

  // Fallback: try to extract error info
  const text = await res.text();
  return fromUnknown({
    message: text || res.statusText,
    status: res.status,
  });
}

/**
 * Check if Response contains an error
 */
export function isErrorResponse(res: Response): boolean {
  return res.status >= 400;
}
