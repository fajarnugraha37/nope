import { HttpError } from "./http.error.js";

export class NotFoundError extends HttpError {
  constructor(message: string) {
    super(message, 404);
  }
}