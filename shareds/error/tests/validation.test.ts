import { describe, test, expect } from "bun:test";
import {
  makeValidationError,
  fromZodError,
  fromTypeboxError,
  fromAjvError,
  deduplicateIssues,
  formatValidationIssues,
  type ValidationIssue,
} from "../src/validation";

describe("Validation", () => {
  test("makeValidationError creates error with issues", () => {
    const issues: ValidationIssue[] = [
      {
        path: ["user", "email"],
        code: "invalid_email",
        message: "Invalid email format",
      },
      {
        path: ["user", "age"],
        code: "too_small",
        message: "Age must be at least 18",
      },
    ];

    const err = makeValidationError(issues);
    expect(err.code).toBe("validation/failed");
    expect(err.message).toContain("2 issue");
    expect(err.data).toEqual({ issues });
    expect(err.status).toBe(400);
  });

  test("makeValidationError accepts custom status", () => {
    const issues: ValidationIssue[] = [
      { path: [], code: "invalid", message: "Invalid" },
    ];
    const err = makeValidationError(issues, { status: 422 });
    expect(err.status).toBe(422);
  });

  test("deduplicateIssues removes duplicates", () => {
    const issues: ValidationIssue[] = [
      { path: ["user", "email"], code: "invalid", message: "Invalid email" },
      { path: ["user", "email"], code: "invalid", message: "Invalid email" },
      { path: ["user", "name"], code: "required", message: "Required" },
    ];

    const deduplicated = deduplicateIssues(issues);
    expect(deduplicated).toHaveLength(2);
  });

  test("formatValidationIssues creates readable output", () => {
    const issues: ValidationIssue[] = [
      { path: ["user", "email"], code: "invalid", message: "Invalid email" },
      { path: [], code: "required", message: "Required field" },
    ];

    const formatted = formatValidationIssues(issues);
    expect(formatted).toContain("user.email");
    expect(formatted).toContain("Invalid email");
    expect(formatted).toContain("(root)");
  });
});

describe("Zod adapter", () => {
  test("fromZodError converts Zod errors", () => {
    const zodError = {
      issues: [
        {
          path: ["email"],
          code: "invalid_string",
          message: "Invalid email",
          expected: "email",
          received: "string",
        },
        {
          path: ["age"],
          code: "too_small",
          message: "Number must be greater than 0",
        },
      ],
    };

    const err = fromZodError(zodError);
    expect(err.code).toBe("validation/failed");
    const issues = (err.data as any).issues;
    expect(issues).toHaveLength(2);
    expect(issues[0].path).toEqual(["email"]);
    expect(issues[0].code).toBe("invalid_string");
  });

  test("fromZodError throws on invalid input", () => {
    expect(() => fromZodError(null)).toThrow();
    expect(() => fromZodError({})).toThrow();
  });
});

describe("TypeBox adapter", () => {
  test("fromTypeboxError converts TypeBox errors", () => {
    const typeboxErrors = [
      {
        path: "/user/email",
        type: "string",
        message: "Expected string",
        schema: {},
        value: 123,
      },
    ];

    const err = fromTypeboxError(typeboxErrors);
    expect(err.code).toBe("validation/failed");
    const issues = (err.data as any).issues;
    expect(issues).toHaveLength(1);
    expect(issues[0].path).toEqual(["user", "email"]);
    expect(issues[0].code).toBe("string");
  });

  test("fromTypeboxError throws on invalid input", () => {
    expect(() => fromTypeboxError(null)).toThrow();
  });
});

describe("AJV adapter", () => {
  test("fromAjvError converts AJV errors", () => {
    const ajvErrors = [
      {
        instancePath: "/user/email",
        keyword: "format",
        message: "must match format 'email'",
        params: { format: "email" },
        schema: "email",
      },
      {
        instancePath: "/user/age",
        keyword: "minimum",
        message: "must be >= 18",
        params: { comparison: ">=", limit: 18 },
      },
    ];

    const err = fromAjvError(ajvErrors);
    expect(err.code).toBe("validation/failed");
    const issues = (err.data as any).issues;
    expect(issues).toHaveLength(2);
    expect(issues[0].path).toEqual(["user", "email"]);
    expect(issues[0].code).toBe("format");
    expect(issues[1].path).toEqual(["user", "age"]);
    expect(issues[1].code).toBe("minimum");
  });

  test("fromAjvError handles root path", () => {
    const ajvErrors = [
      {
        instancePath: "",
        keyword: "required",
        message: "must have required property 'name'",
        params: { missingProperty: "name" },
      },
    ];

    const err = fromAjvError(ajvErrors);
    const issues = (err.data as any).issues;
    expect(issues[0].path).toEqual([]);
  });

  test("fromAjvError throws on invalid input", () => {
    expect(() => fromAjvError(null)).toThrow();
  });
});
