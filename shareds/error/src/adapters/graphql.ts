import type { AppError } from "../app-error.js";
import { isAppError } from "../app-error.js";

// Type-only imports
type GraphQLError = any;
type GraphQLErrorExtensions = Record<string, unknown>;

export interface GraphQLErrorOptions {
  extensions?: GraphQLErrorExtensions;
}

/**
 * Convert AppError to GraphQL Error
 */
export function toGraphQLError(
  err: AppError,
  options?: GraphQLErrorOptions
): GraphQLError {
  if (!isAppError(err)) {
    throw new Error("toGraphQLError requires an AppError instance");
  }

  const extensions: GraphQLErrorExtensions = {
    code: err.code,
    severity: err.severity,
    id: err.id,
    timestamp: err.timestamp,
    ...options?.extensions,
  };

  if (err.status !== undefined) {
    extensions.status = err.status;
  }

  if (err.retryable) {
    extensions.retryable = err.retryable;
  }

  if (err.tags.length > 0) {
    extensions.tags = err.tags;
  }

  if (err.data !== undefined) {
    extensions.data = err.data;
  }

  // Return shape compatible with graphql-js GraphQLError
  return {
    message: err.message,
    extensions,
    originalError: err,
  };
}

/**
 * Format AppError for GraphQL response
 */
export function formatGraphQLError(err: AppError): {
  message: string;
  extensions: GraphQLErrorExtensions;
} {
  const extensions: GraphQLErrorExtensions = {
    code: err.code,
    severity: err.severity,
    id: err.id,
    timestamp: err.timestamp,
  };

  if (err.status !== undefined) {
    extensions.status = err.status;
  }

  if (err.retryable) {
    extensions.retryable = err.retryable;
  }

  if (err.tags.length > 0) {
    extensions.tags = err.tags;
  }

  if (err.data !== undefined) {
    extensions.data = err.data;
  }

  return {
    message: err.message,
    extensions,
  };
}
