import { normalizeStack } from "./normalize-stack.js";

export type Severity = "info" | "warn" | "error" | "fatal";

export interface AppErrorOptions {
  cause?: unknown;
  data?: unknown;
  tags?: string[];
  severity?: Severity;
  status?: number;
  retryable?: boolean;
  captureStack?: boolean;
}

/**
 * AppError - Structured error class with rich metadata
 */
export class AppError extends Error {
  public readonly code: string;
  public override readonly cause?: unknown;
  public readonly data?: unknown;
  public readonly status?: number;
  public readonly tags: readonly string[];
  public readonly severity: Severity;
  public readonly retryable: boolean;
  public readonly id: string;
  public readonly timestamp: number;

  constructor(code: string, message?: string, options: AppErrorOptions = {}) {
    super(message || code);
    this.name = "AppError";
    this.code = code;
    this.cause = options.cause;
    this.data = options.data;
    this.tags = Object.freeze(options.tags || []);
    this.severity = options.severity || "error";
    this.status = options.status;
    this.retryable = options.retryable ?? false;
    this.id = generateUUIDv7();
    this.timestamp = Date.now();

    // Capture and normalize stack
    if (options.captureStack !== false) {
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, AppError);
      }
      if (this.stack) {
        this.stack = normalizeStack(this.stack);
      }
    }

    // Freeze instance to prevent mutation
    Object.freeze(this);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      severity: this.severity,
      status: this.status,
      retryable: this.retryable,
      id: this.id,
      timestamp: this.timestamp,
      tags: this.tags,
      data: this.data,
      stack: this.stack,
      cause: this.cause instanceof Error ? this.cause.message : this.cause,
    };
  }
}

/**
 * Factory function to create AppError
 */
export function error(
  code: string,
  message?: string,
  options?: AppErrorOptions
): AppError {
  return new AppError(code, message, options);
}

/**
 * Wrap an existing error with AppError
 */
export function wrap(
  err: unknown,
  code?: string,
  options?: Omit<AppErrorOptions, "cause">
): AppError {
  if (isAppError(err)) {
    return err;
  }

  const message = err instanceof Error ? err.message : String(err);
  const errorCode = code || "wrapped/error";

  return new AppError(errorCode, message, {
    ...options,
    cause: err,
  });
}

/**
 * Convert unknown value to AppError
 */
export function fromUnknown(value: unknown): AppError {
  if (isAppError(value)) {
    return value;
  }

  if (value instanceof Error) {
    return new AppError("error/from-unknown", value.message, {
      cause: value,
      data: { originalName: value.name },
    });
  }

  if (typeof value === "string") {
    return new AppError("error/from-unknown", value);
  }

  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    const message = String(obj.message || obj.error || "Unknown error");
    return new AppError("error/from-unknown", message, {
      data: obj,
    });
  }

  return new AppError("error/from-unknown", String(value), {
    data: { originalValue: value },
  });
}

/**
 * Type guard for AppError
 */
export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

/**
 * Check if error matches a specific code
 */
export function isCode(err: unknown, code: string): boolean {
  return isAppError(err) && err.code === code;
}

/**
 * Generate UUID v7 (time-ordered)
 * Inline implementation to avoid dependencies
 */
function generateUUIDv7(): string {
  const timestamp = Date.now();
  const randomBytes = new Uint8Array(10);

  // Use crypto if available, otherwise Math.random
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(randomBytes);
  } else {
    for (let i = 0; i < 10; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // Build UUID v7: timestamp (48 bits) + version (4) + random (12) + variant (2) + random (62)
  const hex = (n: number, len: number) => n.toString(16).padStart(len, "0");

  const time_high = Math.floor(timestamp / 0x100000000);
  const time_low = timestamp & 0xffffffff;

  return [
    hex(time_high, 8),
    hex((time_low >>> 16) & 0xffff, 4),
    hex((time_low & 0xffff & 0x0fff) | 0x7000, 4), // version 7
    hex((((randomBytes[0]! << 8) | randomBytes[1]!) & 0x3fff) | 0x8000, 4), // variant
    hex(
      (randomBytes[2]! << 24) |
        (randomBytes[3]! << 16) |
        (randomBytes[4]! << 8) |
        randomBytes[5]!,
      8
    ) + hex((randomBytes[6]! << 8) | randomBytes[7]!, 4),
  ].join("-");
}
