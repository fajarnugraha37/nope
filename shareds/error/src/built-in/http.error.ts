import { AppError } from "../app-error.ts";

export class HttpError extends AppError {
  constructor(message: string, statusCode = 500, details?: unknown) {
    super("HTTP_ERROR", message, { status: statusCode, data: details });
  }
}
