import { HttpError } from "./http.error.ts";

export class InvalidDataError extends HttpError {
  constructor(message: string, details?: unknown) {
    super(message, 400, details);
  }
}