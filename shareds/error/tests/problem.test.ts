import { describe, test, expect } from "bun:test";
import { 
  toProblemJSON, 
  fromProblemJSON,
  toProblem,
  fromProblem,
  type ProblemDetails,
} from "../src/problem";
import { AppError } from "../src/app-error";

describe("toProblem", () => {
  test("converts AppError to problem details format", () => {
    const error = new AppError("TEST_ERROR", "Test error", {
      status: 400,
    });
    
    const problem = toProblem(error);
    expect(problem.title).toBe("TEST_ERROR");
    expect(problem.type).toContain("TEST_ERROR");
    expect(problem.status).toBe(400);
    expect(problem.detail).toBe("Test error");
  });

  test("includes instance identifier", () => {
    const error = new AppError("ERROR", "Test");
    const problem = toProblem(error);
    expect(problem.instance).toBeDefined();
  });

  test("handles error without status", () => {
    const error = new AppError("ERROR", "Test");
    const problem = toProblem(error);
    expect(problem.status).toBeUndefined();
  });

  test("includes severity extension", () => {
    const error = new AppError("ERROR", "Test", {
      severity: "warn",
    });
    
    const problem = toProblem(error);
    expect(problem.severity).toBe("warn");
  });

  test("includes retryable extension", () => {
    const error = new AppError("ERROR", "Test", {
      retryable: true,
    });
    
    const problem = toProblem(error);
    expect(problem.retryable).toBe(true);
  });

  test("includes tags extension", () => {
    const error = new AppError("ERROR", "Test", {
      tags: ["validation", "user-input"],
    });
    
    const problem = toProblem(error);
    expect(problem.tags).toEqual(["validation", "user-input"]);
  });

  test("includes data extension", () => {
    const error = new AppError("ERROR", "Test", {
      data: { field: "email", value: "invalid" },
    });
    
    const problem = toProblem(error);
    expect(problem.data).toEqual({ field: "email", value: "invalid" });
  });

  test("includes timestamp", () => {
    const error = new AppError("ERROR", "Test");
    const problem = toProblem(error);
    expect(problem.timestamp).toBeDefined();
  });
});

describe("toProblemJSON", () => {
  test("converts AppError to JSON string", () => {
    const error = new AppError("TEST_ERROR", "Test error", {
      status: 400,
    });
    
    const json = toProblemJSON(error);
    expect(typeof json).toBe("string");
    const parsed = JSON.parse(json);
    expect(parsed.title).toBe("TEST_ERROR");
    expect(parsed.type).toContain("TEST_ERROR");
    expect(parsed.status).toBe(400);
  });

  test("formats JSON with custom spacing", () => {
    const error = new AppError("ERROR", "Test");
    const json = toProblemJSON(error, 2);
    expect(json).toContain("\n");
    expect(json).toContain("  ");
  });
});

describe("fromProblem", () => {
  test("converts problem details to AppError", () => {
    const problem: ProblemDetails = {
      type: "urn:error:TEST_ERROR",
      title: "TEST_ERROR",
      detail: "Test error",
      status: 400,
    };
    
    const error = fromProblem(problem);
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe("TEST_ERROR");
    expect(error.message).toBe("Test error");
    expect(error.status).toBe(400);
  });

  test("extracts code from URN type", () => {
    const problem: ProblemDetails = {
      type: "urn:error:VALIDATION_ERROR",
      title: "VALIDATION_ERROR",
      detail: "Validation failed",
    };
    
    const error = fromProblem(problem);
    expect(error.code).toBe("VALIDATION_ERROR");
  });

  test("extracts code from HTTP URL type", () => {
    const problem: ProblemDetails = {
      type: "https://api.example.com/errors/NOT_FOUND",
      title: "NOT_FOUND",
      detail: "Resource not found",
    };
    
    const error = fromProblem(problem);
    expect(error.code).toBe("NOT_FOUND");
  });

  test("uses title as fallback code", () => {
    const problem: ProblemDetails = {
      title: "ERROR",
      detail: "An error occurred",
    };
    
    const error = fromProblem(problem);
    expect(error.code).toBe("ERROR");
  });

  test("uses detail as message", () => {
    const problem: ProblemDetails = {
      title: "ERROR",
      detail: "Detailed error message",
    };
    
    const error = fromProblem(problem);
    expect(error.message).toBe("Detailed error message");
  });

  test("falls back to title when no detail", () => {
    const problem: ProblemDetails = {
      title: "ERROR",
    };
    
    const error = fromProblem(problem);
    expect(error.message).toBe("ERROR");
  });

  test("extracts severity extension", () => {
    const problem: ProblemDetails = {
      title: "ERROR",
      severity: "warn",
    };
    
    const error = fromProblem(problem);
    expect(error.severity).toBe("warn");
  });

  test("extracts retryable extension", () => {
    const problem: ProblemDetails = {
      title: "ERROR",
      retryable: true,
    };
    
    const error = fromProblem(problem);
    expect(error.retryable).toBe(true);
  });

  test("extracts tags extension", () => {
    const problem: ProblemDetails = {
      title: "ERROR",
      tags: ["validation", "user-input"],
    };
    
    const error = fromProblem(problem);
    expect(error.tags).toEqual(["validation", "user-input"]);
  });

  test("extracts data extension", () => {
    const problem: ProblemDetails = {
      title: "ERROR",
      data: { field: "email", value: "invalid" },
    };
    
    const error = fromProblem(problem);
    expect(error.data).toEqual({ field: "email", value: "invalid" });
  });
});

describe("fromProblemJSON", () => {
  test("parses JSON string to AppError", () => {
    const json = '{"type":"urn:error:TEST_ERROR","title":"TEST_ERROR","detail":"Test error","status":400}';
    const error = fromProblemJSON(json);
    
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe("TEST_ERROR");
    expect(error.message).toBe("Test error");
    expect(error.status).toBe(400);
  });

  test("round-trip conversion preserves data", () => {
    const original = new AppError("TEST_ERROR", "Test error", {
      status: 400,
      data: { field: "email" },
    });
    
    const json = toProblemJSON(original);
    const restored = fromProblemJSON(json);
    
    expect(restored.message).toBe(original.message);
    expect(restored.code).toBe(original.code);
    expect(restored.status).toBe(original.status);
    expect(restored.data).toEqual(original.data);
  });
});
