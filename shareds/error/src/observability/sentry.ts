import type { AppError } from "../app-error.js";
import { isAppError } from "../app-error.js";

// Type-only imports for Sentry
type SentryEvent = any;
type SentryLevel = "fatal" | "error" | "warning" | "info" | "debug";

/**
 * Convert AppError to Sentry Event
 */
export function toSentryEvent(err: AppError): SentryEvent {
  if (!isAppError(err)) {
    throw new Error("toSentryEvent requires an AppError instance");
  }

  const level = mapSeverityToSentryLevel(err.severity);

  const event: SentryEvent = {
    message: err.message,
    level,
    exception: {
      values: [
        {
          type: "AppError",
          value: err.message,
          mechanism: {
            type: "generic",
            handled: true,
          },
        },
      ],
    },
    tags: {
      "error.code": err.code,
      "error.severity": err.severity,
      ...Object.fromEntries(err.tags.map((tag) => [`tag.${tag}`, true])),
    },
    contexts: {
      error: {
        id: err.id,
        code: err.code,
        timestamp: err.timestamp,
        retryable: err.retryable,
      },
    },
    extra: {},
  };

  if (err.status !== undefined) {
    event.contexts.error.status = err.status;
  }

  if (err.data !== undefined) {
    event.extra.data = err.data;
  }

  if (err.cause !== undefined) {
    event.extra.cause = err.cause;
  }

  return event;
}

/**
 * Map AppError severity to Sentry level
 */
function mapSeverityToSentryLevel(severity: string): SentryLevel {
  switch (severity) {
    case "fatal":
      return "fatal";
    case "error":
      return "error";
    case "warn":
      return "warning";
    case "info":
      return "info";
    default:
      return "error";
  }
}

/**
 * Extract Sentry-compatible fingerprint from AppError
 */
export function getSentryFingerprint(err: AppError): string[] {
  return ["{{ default }}", err.code];
}

/**
 * Create Sentry breadcrumb from AppError
 */
export function toSentryBreadcrumb(err: AppError): any {
  return {
    type: "error",
    level: mapSeverityToSentryLevel(err.severity),
    message: err.message,
    data: {
      code: err.code,
      id: err.id,
      status: err.status,
    },
    timestamp: err.timestamp / 1000, // Sentry uses seconds
  };
}
