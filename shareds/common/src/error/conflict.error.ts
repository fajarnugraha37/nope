import { HttpError } from "./http.error.js";

export class ConflictError extends HttpError {
  constructor(message: string) {
    super(message, 409);
  }
}
