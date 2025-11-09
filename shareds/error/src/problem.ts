import { AppError, type AppErrorOptions } from "./app-error.js";

/**
 * RFC 9457 Problem Details
 */
export interface ProblemDetails {
  type?: string;
  title: string;
  status?: number;
  detail?: string;
  instance?: string;
  [key: string]: unknown;
}

/**
 * Convert AppError to RFC 9457 Problem Details
 */
export function toProblem(err: AppError): ProblemDetails {
  const problem: ProblemDetails = {
    type: `urn:error:${err.code}`,
    title: err.code,
    status: err.status,
    detail: err.message,
    instance: err.id,
  };

  // Add extensions
  if (err.severity) {
    problem.severity = err.severity;
  }

  if (err.retryable) {
    problem.retryable = err.retryable;
  }

  if (err.tags.length > 0) {
    problem.tags = err.tags;
  }

  if (err.data !== undefined) {
    problem.data = err.data;
  }

  if (err.timestamp) {
    problem.timestamp = err.timestamp;
  }

  return problem;
}

/**
 * Convert RFC 9457 Problem Details to AppError
 */
export function fromProblem(problem: ProblemDetails): AppError {
  const code =
    extractCodeFromType(problem.type) || problem.title || "unknown/error";
  const message = problem.detail || problem.title;

  const options: AppErrorOptions = {
    status: problem.status,
  };

  // Extract known extensions
  if (typeof problem.severity === "string") {
    options.severity = problem.severity as any;
  }

  if (typeof problem.retryable === "boolean") {
    options.retryable = problem.retryable;
  }

  if (Array.isArray(problem.tags)) {
    options.tags = problem.tags;
  }

  if (problem.data !== undefined) {
    options.data = problem.data;
  }

  return new AppError(code, message, options);
}

/**
 * Extract code from type URN
 */
function extractCodeFromType(type?: string): string | undefined {
  if (!type) return undefined;

  // Handle URN format: urn:error:code
  if (type.startsWith("urn:error:")) {
    return type.slice(10);
  }

  // Handle URL format: extract last segment
  if (type.startsWith("http://") || type.startsWith("https://")) {
    const parts = type.split("/");
    return parts[parts.length - 1];
  }

  return type;
}

/**
 * Convert AppError to Problem JSON string
 */
export function toProblemJSON(err: AppError, space?: number): string {
  return JSON.stringify(toProblem(err), null, space);
}

/**
 * Parse Problem JSON to AppError
 */
export function fromProblemJSON(json: string): AppError {
  const problem = JSON.parse(json) as ProblemDetails;
  return fromProblem(problem);
}
