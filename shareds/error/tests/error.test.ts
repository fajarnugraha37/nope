import { describe, expect, test } from "bun:test";

import { HttpError, ConflictError, ValidationError, NotFoundError } from "../src";

describe("HTTP error hierarchy", () => {
  test("HttpError stores status and details", () => {
    const err = new HttpError("failure", 418, { info: "teapot" });
    expect(err.statusCode).toBe(418);
    expect(err.details).toEqual({ info: "teapot" });
  });

  test("ConflictError sets 409", () => {
    const err = new ConflictError("conflict");
    expect(err.statusCode).toBe(409);
  });

  test("NotFoundError sets 404", () => {
    const err = new NotFoundError("missing");
    expect(err.statusCode).toBe(404);
  });

  test("ValidationError sets 400 with details", () => {
    const err = new ValidationError("bad", { field: "name" });
    expect(err.statusCode).toBe(400);
    expect(err.details).toEqual({ field: "name" });
  });
});
