import { isAppError } from "./app-error.js";

export interface FormatOptions {
  stack?: boolean;
  short?: boolean;
  colors?: boolean;
}

/**
 * Format an error for display
 */
export function format(err: unknown, options: FormatOptions = {}): string {
  if (!isAppError(err)) {
    if (err instanceof Error) {
      return options.short ? err.message : `${err.name}: ${err.message}`;
    }
    return String(err);
  }

  const { stack = false, short = false, colors = false } = options;

  if (short) {
    return `[${err.code}] ${err.message}`;
  }

  const parts: string[] = [];

  // Header
  parts.push(`AppError: ${err.code}`);
  parts.push(`Message: ${err.message}`);
  parts.push(`ID: ${err.id}`);
  parts.push(`Severity: ${err.severity}`);
  parts.push(`Timestamp: ${new Date(err.timestamp).toISOString()}`);

  if (err.status !== undefined) {
    parts.push(`Status: ${err.status}`);
  }

  if (err.retryable) {
    parts.push(`Retryable: true`);
  }

  if (err.tags.length > 0) {
    parts.push(`Tags: ${err.tags.join(", ")}`);
  }

  if (err.data !== undefined) {
    parts.push(`Data: ${JSON.stringify(err.data)}`);
  }

  if (err.cause !== undefined) {
    const causeStr = err.cause instanceof Error
      ? `${err.cause.name}: ${err.cause.message}`
      : String(err.cause);
    parts.push(`Cause: ${causeStr}`);
  }

  if (stack && err.stack) {
    parts.push(`\nStack:\n${err.stack}`);
  }

  return parts.join("\n");
}

/**
 * Format error as single line
 */
export function formatOneLine(err: unknown): string {
  return format(err, { short: true });
}

/**
 * Format error with full details
 */
export function formatVerbose(err: unknown): string {
  return format(err, { stack: true, short: false });
}
