import { describe, test, expect } from "bun:test";
import { error } from "../src/app-error";
import { toResponse, fromResponse, isErrorResponse } from "../src/adapters/web";
import { expressErrorHandler } from "../src/adapters/express";
import { toGraphQLError, formatGraphQLError } from "../src/adapters/graphql";
import { toProblem } from "../src/problem";

describe("Web adapter", () => {
  test("toResponse creates Response with problem+json", () => {
    const err = error("test/error", "test message", { status: 404 });
    const response = toResponse(err);

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
  });

  test("toResponse uses default status 500", () => {
    const err = error("test/error", "test");
    const response = toResponse(err);
    expect(response.status).toBe(500);
  });

  test("toResponse accepts ResponseInit", () => {
    const err = error("test/error", "test", { status: 400 });
    const response = toResponse(err, {
      headers: { "X-Custom": "value" },
    });
    expect(response.headers.get("X-Custom")).toBe("value");
  });

  test("fromResponse parses problem+json", async () => {
    const original = error("test/error", "test message", { status: 404 });
    const response = toResponse(original);
    const parsed = await fromResponse(response);

    expect(parsed.code).toBe(original.code);
    expect(parsed.message).toBe(original.message);
    expect(parsed.status).toBe(original.status);
  });

  test("fromResponse handles non-problem responses", async () => {
    const response = new Response("Not found", {
      status: 404,
      statusText: "Not Found",
    });
    const parsed = await fromResponse(response);
    expect(parsed.code).toBe("error/from-unknown");
  });

  test("isErrorResponse detects errors", () => {
    const ok = new Response("ok", { status: 200 });
    const notFound = new Response("not found", { status: 404 });
    const serverError = new Response("error", { status: 500 });

    expect(isErrorResponse(ok)).toBe(false);
    expect(isErrorResponse(notFound)).toBe(true);
    expect(isErrorResponse(serverError)).toBe(true);
  });
});

describe("Express adapter", () => {
  test("expressErrorHandler returns middleware function", () => {
    const handler = expressErrorHandler();
    expect(typeof handler).toBe("function");
    expect(handler.length).toBe(4); // Error middleware has 4 args
  });

  test("expressErrorHandler converts error to problem+json", () => {
    const handler = expressErrorHandler();
    const err = error("test/error", "test", { status: 400 });

    const req = {};
    const res = {
      statusCode: 200,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(body: any) {
        this.body = body;
        return this;
      },
      body: null as any,
    };
    const next = () => {};

    handler(err, req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res.body).toBeTruthy();
    expect(res.body.type).toBe("urn:error:test/error");
  });
});

describe("GraphQL adapter", () => {
  test("toGraphQLError converts AppError", () => {
    const err = error("test/error", "test message", {
      status: 400,
      severity: "warn",
      tags: ["tag1"],
      data: { foo: "bar" },
    });

    const graphQLError = toGraphQLError(err);
    expect(graphQLError.message).toBe("test message");
    expect(graphQLError.extensions.code).toBe("test/error");
    expect(graphQLError.extensions.severity).toBe("warn");
    expect(graphQLError.extensions.tags).toEqual(["tag1"]);
    expect(graphQLError.extensions.data).toEqual({ foo: "bar" });
    expect(graphQLError.originalError).toBe(err);
  });

  test("toGraphQLError accepts custom extensions", () => {
    const err = error("test/error", "test");
    const graphQLError = toGraphQLError(err, {
      extensions: { custom: "value" },
    });
    expect(graphQLError.extensions.custom).toBe("value");
  });

  test("formatGraphQLError creates response format", () => {
    const err = error("test/error", "test message", {
      severity: "error",
      retryable: true,
    });

    const formatted = formatGraphQLError(err);
    expect(formatted.message).toBe("test message");
    expect(formatted.extensions.code).toBe("test/error");
    expect(formatted.extensions.retryable).toBe(true);
  });
});

describe("Hono adapter", () => {
  test("honoErrorHandler is importable", async () => {
    const { honoErrorHandler } = await import("../src/adapters/hono");
    expect(typeof honoErrorHandler).toBe("function");
  });
});

describe("Fastify adapter", () => {
  test("fastifyErrorHandler is importable", async () => {
    const { fastifyErrorHandler } = await import("../src/adapters/fastify");
    expect(typeof fastifyErrorHandler).toBe("function");
  });
});

describe("Koa adapter", () => {
  test("koaErrorMiddleware is importable", async () => {
    const { koaErrorMiddleware } = await import("../src/adapters/koa");
    expect(typeof koaErrorMiddleware).toBe("function");
  });
});

describe("H3 adapter", () => {
  test("h3ErrorHandler is importable", async () => {
    const { h3ErrorHandler, createH3Error } = await import("../src/adapters/h3");
    expect(typeof h3ErrorHandler).toBe("function");
    expect(typeof createH3Error).toBe("function");
  });

  test("createH3Error creates H3 error shape", async () => {
    const { createH3Error } = await import("../src/adapters/h3");
    const err = error("test/error", "test", { status: 404 });
    const h3Error = createH3Error(err);

    expect(h3Error.statusCode).toBe(404);
    expect(h3Error.statusMessage).toBe("test");
    expect(h3Error.data).toBeTruthy();
  });
});

describe("Elysia adapter", () => {
  test("elysiaErrorHandler is importable", async () => {
    const { elysiaErrorHandler } = await import("../src/adapters/elysia");
    expect(typeof elysiaErrorHandler).toBe("function");
  });
});

describe("Observability - OpenTelemetry", () => {
  test("recordException is importable", async () => {
    const { recordException, toSpanAttributes } = await import("../src/observability/otel");
    expect(typeof recordException).toBe("function");
    expect(typeof toSpanAttributes).toBe("function");
  });

  test("toSpanAttributes converts AppError", async () => {
    const { toSpanAttributes } = await import("../src/observability/otel");
    const err = error("test/error", "test", {
      status: 500,
      severity: "error",
      retryable: true,
      tags: ["tag1"],
    });

    const attrs = toSpanAttributes(err);
    expect(attrs["error.code"]).toBe("test/error");
    expect(attrs["error.severity"]).toBe("error");
    expect(attrs["error.retryable"]).toBe(true);
    expect(attrs["error.status"]).toBe(500);
  });
});

describe("Observability - Sentry", () => {
  test("toSentryEvent is importable", async () => {
    const { toSentryEvent, getSentryFingerprint, toSentryBreadcrumb } = await import(
      "../src/observability/sentry"
    );
    expect(typeof toSentryEvent).toBe("function");
    expect(typeof getSentryFingerprint).toBe("function");
    expect(typeof toSentryBreadcrumb).toBe("function");
  });

  test("toSentryEvent converts AppError", async () => {
    const { toSentryEvent } = await import("../src/observability/sentry");
    const err = error("test/error", "test message", {
      status: 500,
      severity: "error",
      tags: ["tag1"],
      data: { foo: "bar" },
    });

    const event = toSentryEvent(err);
    expect(event.message).toBe("test message");
    expect(event.level).toBe("error");
    expect(event.tags["error.code"]).toBe("test/error");
    expect(event.contexts.error.id).toBe(err.id);
    expect(event.extra.data).toEqual({ foo: "bar" });
  });

  test("getSentryFingerprint returns fingerprint", async () => {
    const { getSentryFingerprint } = await import("../src/observability/sentry");
    const err = error("test/error", "test");
    const fingerprint = getSentryFingerprint(err);
    expect(fingerprint).toEqual(["{{ default }}", "test/error"]);
  });

  test("toSentryBreadcrumb creates breadcrumb", async () => {
    const { toSentryBreadcrumb } = await import("../src/observability/sentry");
    const err = error("test/error", "test", { status: 400 });
    const breadcrumb = toSentryBreadcrumb(err);
    expect(breadcrumb.type).toBe("error");
    expect(breadcrumb.message).toBe("test");
    expect(breadcrumb.data.code).toBe("test/error");
  });
});
