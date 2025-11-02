import { HttpError } from "./http.error.js";

export class ValidationError extends HttpError {
  constructor(message: string, details?: unknown) {
    super(message, 400, details);
  }
}