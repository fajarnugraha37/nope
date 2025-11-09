export type CronErrorCode =
  | "E_TIMEOUT"
  | "E_CANCELED"
  | "E_SHUTDOWN"
  | "E_RETRY_LIMIT"
  | "E_CONFIGURATION"
  | "E_NOT_FOUND"
  | "E_DUPLICATE"
  | "E_STATE"
  | "E_UNSUPPORTED"
  | "E_INTERNAL";

export interface CronErrorOptions {
  cause?: unknown;
  details?: Record<string, unknown>;
}

export class CronError extends Error {
  override readonly cause?: unknown;
  readonly code: CronErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: CronErrorCode, message: string, options: CronErrorOptions = {}) {
    super(message);
    this.name = "CronError";
    this.code = code;
    this.cause = options.cause;
    this.details = options.details;
  }
}

export const createCronError = (code: CronErrorCode, message: string, options: CronErrorOptions = {}) =>
  new CronError(code, message, options);

export const isCronError = (error: unknown): error is CronError => {
  return (Boolean(error) 
    && typeof error === "object" 
    && error 
    && "code" in error 
    && (error as CronError).name === "CronError") || false;
};

export const assertCron = (condition: unknown, code: CronErrorCode, message: string): asserts condition => {
  if (!condition) {
    throw createCronError(code, message);
  }
};
