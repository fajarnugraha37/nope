import { AppError } from "@fajarnugraha37/error";

// Error types
export class ExpressionError extends AppError {
  constructor(
    message: string,
    code: string,
    context?: unknown
  ) {
    super(code, `[${code}] ${message}`, { status: 400, data: context});
  }
}

export class ExpressionValidationError extends ExpressionError {
  constructor(message: string, context?: unknown) {
    super(message, "VALIDATION_ERROR", context);
  }
}

export class EvaluationError extends ExpressionError {
  constructor(message: string, context?: unknown) {
    super(message, "EVALUATION_ERROR", context);
  }
}

export class TimeoutError extends ExpressionError {
  constructor(timeout: number) {
    super(
      `Expression evaluation timed out after ${timeout}ms`,
      "TIMEOUT_ERROR",
      { timeout }
    );
  }
}
