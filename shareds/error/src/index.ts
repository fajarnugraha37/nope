// Core exports
export {
  AppError,
  error,
  wrap,
  fromUnknown,
  isAppError,
  isCode,
  type Severity,
  type AppErrorOptions,
} from "./app-error.js";
export * from "./built-in/index.js";

// Result exports
export {
  ok,
  err,
  safeAwait,
  safeFunc,
  isOk,
  isErr,
  unwrap,
  unwrapErr,
  unwrapOr,
  map,
  mapErr,
  ResultWrapper,
  type Result,
} from "./result.js";

// Match exports
export { match, type ErrorHandler, type ErrorHandlers } from "./match.js";

// Assert exports
export { assert } from "./assert.js";

// Format exports
export {
  format,
  formatOneLine,
  formatVerbose,
  type FormatOptions,
} from "./format.js";

// Problem details exports
export {
  toProblem,
  fromProblem,
  toProblemJSON,
  fromProblemJSON,
  type ProblemDetails,
} from "./problem.js";

// Validation exports
export {
  makeValidationError,
  fromZodError,
  fromTypeboxError,
  fromAjvError,
  deduplicateIssues,
  formatValidationIssues,
  type ValidationIssue,
} from "./validation.js";

// Redaction exports
export {
  redact,
  safeStringify,
  defaultRedactionPredicate,
  type RedactionPredicate,
} from "./redact.js";

// Stack normalization exports
export { normalizeStack, truncateStack } from "./normalize-stack.js";
