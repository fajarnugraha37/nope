import { HttpError } from "@nope/common";

// Error types
export class ExpressionError extends HttpError {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: unknown
  ) {
    super(`[${code}] ${message}`, 400, context);
    this.name = "ExpressionError";
  }
}

export class ExpressionValidationError extends ExpressionError {
  constructor(message: string, context?: unknown) {
    super(message, "VALIDATION_ERROR", context);
    this.name = "ExpressionValidationError";
  }
}

export class EvaluationError extends ExpressionError {
  constructor(message: string, context?: unknown) {
    super(message, "EVALUATION_ERROR", context);
    this.name = "EvaluationError";
  }
}

export class TimeoutError extends ExpressionError {
  constructor(timeout: number) {
    super(
      `Expression evaluation timed out after ${timeout}ms`,
      "TIMEOUT_ERROR",
      { timeout }
    );
    this.name = "TimeoutError";
  }
}
