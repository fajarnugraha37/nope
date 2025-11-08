export type SpecErrorCode =
  | "SPEC_INVALID_OPERATOR"
  | "SPEC_ASYNC_REQUIRED"
  | "SPEC_REGISTRY_DUPLICATE"
  | "SPEC_REGISTRY_UNKNOWN"
  | "SPEC_AST_INVALID"
  | "SPEC_ADAPTER_UNSUPPORTED"
  | "SPEC_VALIDATION";

export class SpecificationError extends Error {
  constructor(
    readonly code: SpecErrorCode,
    message: string,
    readonly path?: string,
    readonly meta?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "SpecificationError";
  }
}

export const asyncRequiredError = (id: string): SpecificationError => {
  return new SpecificationError(
    "SPEC_ASYNC_REQUIRED",
    `Specification "${id}" must be evaluated asynchronously.`,
  );
};
