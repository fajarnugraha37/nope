import { AppError, type AppErrorOptions } from "./app-error.js";

/**
 * Validation issue representation
 */
export interface ValidationIssue {
  path: (string | number)[];
  code: string;
  message: string;
  meta?: unknown;
}

/**
 * Create a validation error from issues
 */
export function makeValidationError(
  issues: ValidationIssue[],
  options?: Omit<AppErrorOptions, "data">
): AppError {
  const message = `Validation failed with ${issues.length} issue(s)`;

  return new AppError("validation/failed", message, {
    ...options,
    data: { issues },
    status: options?.status ?? 400,
  });
}

/**
 * Zod adapter (type-safe, no hard dependency)
 */
export function fromZodError(zodError: any): AppError {
  if (!zodError || !Array.isArray(zodError.issues)) {
    throw new Error("Invalid Zod error object");
  }

  const issues: ValidationIssue[] = zodError.issues.map((issue: any) => ({
    path: issue.path || [],
    code: issue.code || "invalid",
    message: issue.message || "Validation failed",
    meta: {
      expected: issue.expected,
      received: issue.received,
    },
  }));

  return makeValidationError(issues);
}

/**
 * TypeBox adapter (type-safe, no hard dependency)
 */
export function fromTypeboxError(typeboxErrors: any): AppError {
  if (!Array.isArray(typeboxErrors)) {
    throw new Error("Invalid TypeBox errors array");
  }

  const issues: ValidationIssue[] = typeboxErrors.map((error: any) => ({
    path: error.path ? error.path.split("/").filter(Boolean) : [],
    code: error.type || "invalid",
    message: error.message || "Validation failed",
    meta: {
      schema: error.schema,
      value: error.value,
    },
  }));

  return makeValidationError(issues);
}

/**
 * AJV adapter (type-safe, no hard dependency)
 */
export function fromAjvError(ajvErrors: any): AppError {
  if (!Array.isArray(ajvErrors)) {
    throw new Error("Invalid AJV errors array");
  }

  const issues: ValidationIssue[] = ajvErrors.map((error: any) => {
    // Parse instance path (e.g., "/user/name" -> ["user", "name"])
    const path = error.instancePath
      ? error.instancePath.split("/").filter(Boolean)
      : [];

    return {
      path,
      code: error.keyword || "invalid",
      message: error.message || "Validation failed",
      meta: {
        params: error.params,
        schema: error.schema,
        parentSchema: error.parentSchema,
      },
    };
  });

  return makeValidationError(issues);
}

/**
 * Deduplicate validation issues by path and code
 */
export function deduplicateIssues(
  issues: ValidationIssue[]
): ValidationIssue[] {
  const seen = new Set<string>();
  const result: ValidationIssue[] = [];

  for (const issue of issues) {
    const key = `${issue.path.join("/")}:${issue.code}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(issue);
    }
  }

  return result;
}

/**
 * Format validation issues as readable text
 */
export function formatValidationIssues(issues: ValidationIssue[]): string {
  return issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      return `  - ${path}: ${issue.message} [${issue.code}]`;
    })
    .join("\n");
}
