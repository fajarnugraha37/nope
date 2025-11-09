import { HttpError } from "./http.error.js";

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

export class ValidationError<T> extends HttpError {
  constructor(message: string, details?: unknown, validationDetails?: ValidationResult<T>) {
    super(message, 400, {
      details: {
        ...(details || {}),
        validationDetails,
      },
    });
  }
}
