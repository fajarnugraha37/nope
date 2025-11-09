import { describe, test, expect } from "bun:test";
import { InvalidDataError } from "../src/built-in/invalid-data.error";

describe("InvalidDataError", () => {
  test("creates error with message", () => {
    const error = new InvalidDataError("Invalid input");
    expect(error.message).toBe("Invalid input");
    expect(error.status).toBe(400);
    expect(error.code).toBe("HTTP_ERROR");
    expect(error.name).toBe("AppError"); // HttpError extends AppError
  });

  test("creates error with details", () => {
    const details = { field: "email", reason: "Invalid format" };
    const error = new InvalidDataError("Validation failed", details);
    
    expect(error.message).toBe("Validation failed");
    expect(error.status).toBe(400);
    expect(error.code).toBe("HTTP_ERROR");
    expect(error.data).toEqual(details);
  });

  test("inherits from HttpError", () => {
    const error = new InvalidDataError("Test");
    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(400);
  });

  test("sets HTTP status to 400", () => {
    const error = new InvalidDataError("Bad request");
    expect(error.status).toBe(400);
  });

  test("includes error code", () => {
    const error = new InvalidDataError("Test");
    expect(error.code).toBe("HTTP_ERROR");
  });
});
