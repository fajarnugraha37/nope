import { HttpError } from "@nope/common";

export interface ValidationResult<T = any> {
  valid: boolean;
  data?: T;
  errors?: ValidationErrorInfo[];
}

export interface ValidationErrorInfo {
  keyword: string;
  instancePath: string;
  schemaPath: string;
  params: Record<string, any>;
  message: string;
  data?: any;
  parentSchema?: any;
  schema?: any;
}

export class ValidationError extends HttpError {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
