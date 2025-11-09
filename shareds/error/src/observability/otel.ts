import type { AppError } from "../app-error.js";
import { isAppError } from "../app-error.js";

// Type-only imports for OpenTelemetry
type Span = any;
type SpanStatusCode = any;
type Attributes = Record<string, any>;

/**
 * Record exception to OpenTelemetry span
 */
export function recordException(
  span: Span,
  err: AppError,
  attrs?: Attributes
): void {
  if (!span || typeof span.recordException !== "function") {
    throw new Error("Invalid OpenTelemetry Span");
  }

  if (!isAppError(err)) {
    throw new Error("recordException requires an AppError instance");
  }

  // Record the exception
  span.recordException(err, {
    "error.code": err.code,
    "error.id": err.id,
    "error.severity": err.severity,
    "error.timestamp": err.timestamp,
    ...attrs,
  });

  // Set span status to error
  if (typeof span.setStatus === "function") {
    // SpanStatusCode.ERROR = 2
    span.setStatus({
      code: 2,
      message: err.message,
    });
  }

  // Add error attributes
  if (typeof span.setAttributes === "function") {
    const attributes: Attributes = {
      "error.type": "AppError",
      "error.code": err.code,
      "error.message": err.message,
      "error.id": err.id,
      "error.severity": err.severity,
    };

    if (err.status !== undefined) {
      attributes["error.status"] = err.status;
    }

    if (err.retryable) {
      attributes["error.retryable"] = err.retryable;
    }

    if (err.tags.length > 0) {
      attributes["error.tags"] = err.tags.join(",");
    }

    span.setAttributes(attributes);
  }
}

/**
 * Create span attributes from AppError
 */
export function toSpanAttributes(err: AppError): Attributes {
  const attributes: Attributes = {
    "error.type": "AppError",
    "error.code": err.code,
    "error.message": err.message,
    "error.id": err.id,
    "error.severity": err.severity,
    "error.timestamp": err.timestamp,
  };

  if (err.status !== undefined) {
    attributes["error.status"] = err.status;
  }

  if (err.retryable) {
    attributes["error.retryable"] = err.retryable;
  }

  if (err.tags.length > 0) {
    attributes["error.tags"] = err.tags.join(",");
  }

  return attributes;
}
