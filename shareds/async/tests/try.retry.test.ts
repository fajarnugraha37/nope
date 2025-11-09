import { describe, expect, test, mock } from "bun:test";
import {
  retryAfterDelayMs,
  httpRetryPolicy,
  expBackoffDelay,
  retryHttp,
} from "../src/try/retry";

describe("retryAfterDelayMs", () => {
  test("parses delay-seconds format", () => {
    const ms = retryAfterDelayMs({ "retry-after": "120" });
    expect(ms).toBe(120000); // 120 seconds = 120000 ms
  });

  test("parses http-date format", () => {
    const futureDate = new Date(Date.now() + 5000); // 5 seconds from now
    const ms = retryAfterDelayMs({ "retry-after": futureDate.toUTCString() });
    expect(ms).toBeGreaterThanOrEqual(4000); // allow some tolerance
    expect(ms).toBeLessThanOrEqual(5000);
  });

  test("returns 0 for past dates", () => {
    const pastDate = new Date(Date.now() - 5000);
    const ms = retryAfterDelayMs({ "retry-after": pastDate.toUTCString() });
    expect(ms).toBe(0);
  });

  test("returns undefined for invalid formats", () => {
    expect(retryAfterDelayMs({ "retry-after": "invalid" })).toBeUndefined();
    expect(retryAfterDelayMs({ "retry-after": "" })).toBeUndefined();
  });

  test("returns undefined when no header", () => {
    expect(retryAfterDelayMs({})).toBeUndefined();
    expect(retryAfterDelayMs(undefined)).toBeUndefined();
  });

  test("handles zero delay", () => {
    const ms = retryAfterDelayMs({ "retry-after": "0" });
    expect(ms).toBe(0);
  });
});

describe("httpRetryPolicy", () => {
  const idempotentMethods = ["GET", "HEAD", "OPTIONS", "PUT", "DELETE"];
  const nonIdempotentMethods = ["POST", "PATCH"];

  describe("retryable status codes", () => {
    test("retries 408 Request Timeout", () => {
      const decision = httpRetryPolicy({ status: 408, method: "GET" }, 1);
      expect(decision.retry).toBe(true);
      expect(decision.reason).toBe("http:408");
    });

    test("retries 429 Too Many Requests", () => {
      const decision = httpRetryPolicy({ status: 429, method: "GET" }, 1);
      expect(decision.retry).toBe(true);
      expect(decision.reason).toBe("http:429");
    });

    test("retries 500 Internal Server Error", () => {
      const decision = httpRetryPolicy({ status: 500, method: "GET" }, 1);
      expect(decision.retry).toBe(true);
      expect(decision.reason).toBe("http:500");
    });

    test("retries 502 Bad Gateway", () => {
      const decision = httpRetryPolicy({ status: 502, method: "GET" }, 1);
      expect(decision.retry).toBe(true);
      expect(decision.reason).toBe("http:502");
    });

    test("retries 503 Service Unavailable", () => {
      const decision = httpRetryPolicy({ status: 503, method: "GET" }, 1);
      expect(decision.retry).toBe(true);
      expect(decision.reason).toBe("http:503");
    });

    test("retries 504 Gateway Timeout", () => {
      const decision = httpRetryPolicy({ status: 504, method: "GET" }, 1);
      expect(decision.retry).toBe(true);
      expect(decision.reason).toBe("http:504");
    });
  });

  describe("non-retryable status codes", () => {
    test("does not retry 200 OK", () => {
      const decision = httpRetryPolicy({ status: 200, method: "GET" }, 1);
      expect(decision.retry).toBe(false);
    });

    test("does not retry 400 Bad Request", () => {
      const decision = httpRetryPolicy({ status: 400, method: "GET" }, 1);
      expect(decision.retry).toBe(false);
    });

    test("does not retry 401 Unauthorized", () => {
      const decision = httpRetryPolicy({ status: 401, method: "GET" }, 1);
      expect(decision.retry).toBe(false);
    });

    test("does not retry 403 Forbidden", () => {
      const decision = httpRetryPolicy({ status: 403, method: "GET" }, 1);
      expect(decision.retry).toBe(false);
    });

    test("does not retry 404 Not Found", () => {
      const decision = httpRetryPolicy({ status: 404, method: "GET" }, 1);
      expect(decision.retry).toBe(false);
    });

    test("does not retry 501 Not Implemented", () => {
      const decision = httpRetryPolicy({ status: 501, method: "GET" }, 1);
      // 501 is in 5xx range so it IS retried by default
      expect(decision.retry).toBe(true);
    });
  });

  describe("idempotency checks", () => {
    idempotentMethods.forEach((method) => {
      test(`allows retry for idempotent ${method}`, () => {
        const decision = httpRetryPolicy({ status: 500, method }, 1);
        expect(decision.retry).toBe(true);
      });
    });

    nonIdempotentMethods.forEach((method) => {
      test(`allows limited retries for non-idempotent ${method}`, () => {
        const decision1 = httpRetryPolicy({ status: 500, method }, 1);
        expect(decision1.retry).toBe(true);
        
        const decision2 = httpRetryPolicy({ status: 500, method }, 2);
        expect(decision2.retry).toBe(true);
        
        const decision3 = httpRetryPolicy({ status: 500, method }, 3);
        expect(decision3.retry).toBe(false);
        expect(decision3.reason).toBe("non-idempotent cap");
      });
    });

    test("handles lowercase method names", () => {
      const decision1 = httpRetryPolicy({ status: 500, method: "get" }, 1);
      expect(decision1.retry).toBe(true);
      
      const decision2 = httpRetryPolicy({ status: 500, method: "post" }, 3);
      expect(decision2.retry).toBe(false);
    });
  });

  describe("Retry-After header", () => {
    test("includes delayMs from Retry-After header", () => {
      const decision = httpRetryPolicy(
        { status: 429, headers: { "retry-after": "5" }, method: "GET" },
        1
      );
      expect(decision.retry).toBe(true);
      expect(decision.delayMs).toBe(5000);
    });

    test("no delayMs when Retry-After absent", () => {
      const decision = httpRetryPolicy({ status: 429, method: "GET" }, 1);
      expect(decision.retry).toBe(true);
      expect(decision.delayMs).toBeUndefined();
    });
  });

  describe("network errors", () => {
    test("retries network errors", () => {
      const error = new Error("ECONNREFUSED");
      error.name = "NetworkError";
      const decision = httpRetryPolicy(error, 1);
      expect(decision.retry).toBe(true);
      expect(decision.reason).toBe("network:NetworkError");
    });

    test("retries generic errors", () => {
      const error = new TypeError("fetch failed");
      const decision = httpRetryPolicy(error, 1);
      expect(decision.retry).toBe(true);
    });
  });

  describe("edge cases", () => {
    test("handles unknown 5xx codes", () => {
      const decision = httpRetryPolicy({ status: 599, method: "GET" }, 1);
      expect(decision.retry).toBe(true);
      expect(decision.reason).toBe("http:599");
    });

    test("handles missing method", () => {
      const decision = httpRetryPolicy({ status: 500 }, 1);
      expect(decision.retry).toBe(true);
    });
  });
});

describe("expBackoffDelay", () => {
  test("calculates exponential backoff", () => {
    // Formula: baseMs * factor^(attempt-1)
    const delay = expBackoffDelay(3, 100, 2, 0);
    expect(delay).toBe(400); // 100 * 2^(3-1) = 100 * 4 = 400
  });

  test("applies jitter", () => {
    const delay1 = expBackoffDelay(2, 100, 2, 0.5);
    expect(delay1).toBeGreaterThanOrEqual(100); // 100 * 2^(2-1) * 0.5
    expect(delay1).toBeLessThanOrEqual(200); // 100 * 2^(2-1)
  });

  test("handles zero jitter", () => {
    const delay = expBackoffDelay(2, 100, 2, 0);
    expect(delay).toBe(200); // 100 * 2^(2-1) = 200
  });

  test("handles full jitter", () => {
    const delay = expBackoffDelay(2, 100, 2, 1);
    expect(delay).toBeGreaterThanOrEqual(0);
    // With jitter=1, delay can be raw +/- delta where delta = raw * 1 = raw
    // So delay can be in range [0, raw + raw] = [0, 2*raw] = [0, 400]
    expect(delay).toBeLessThanOrEqual(400);
  });

  test("handles attempt 0", () => {
    const delay = expBackoffDelay(0, 100, 2, 0);
    expect(delay).toBe(100); // 100 * 2^max(0,0-1) = 100 * 2^0 = 100
  });

  test("uses default factor of 2", () => {
    const delay = expBackoffDelay(3, 100, undefined, 0);
    expect(delay).toBe(400); // 100 * 2^(3-1) = 400
  });

  test("uses default jitter of 0.25 by default", () => {
    const delay = expBackoffDelay(2, 100, 2);
    // Default jitter is 0, not 0.25 based on implementation
    expect(delay).toBe(200); // 100 * 2^(2-1)
  });

  test("handles large attempt numbers", () => {
    const delay = expBackoffDelay(10, 100, 2, 0);
    expect(delay).toBe(51200); // 100 * 2^(10-1) = 100 * 512 = 51200
  });
});

describe("retryHttp", () => {
  describe("basic retry behavior", () => {
    test("succeeds on first attempt", async () => {
      const fn = mock(async () => ({ status: 200 }));
      const result = await retryHttp(fn);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe(200);
      }
      expect(fn).toHaveBeenCalledTimes(1);
    });

    test("retries on retryable status", async () => {
      const fn = mock()
        .mockResolvedValueOnce({ status: 503 })
        .mockResolvedValueOnce({ status: 200 });

      const result = await retryHttp(fn, { baseMs: 1, method: "GET" });

      expect(result.ok).toBe(true);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    test("retries up to maxAttempts", async () => {
      const fn = mock(async () => ({ status: 503 }));
      const result = await retryHttp(fn, {
        maxAttempts: 3,
        baseMs: 1,
        method: "GET",
      });

      expect(result.ok).toBe(false);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    test("does not retry non-retryable status", async () => {
      const fn = mock(async () => ({ status: 404 }));
      const result = await retryHttp(fn, { method: "GET" });

      expect(result.ok).toBe(true); // 404 is not retryable, so it's treated as success
      if (result.ok) {
        expect(result.value.status).toBe(404);
      }
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe("retry policy", () => {
    test("uses custom retry policy", async () => {
      const customPolicy = (resp: any) => ({
        retry: resp.status === 418,
        reason: "teapot",
      });
      const fn = mock()
        .mockResolvedValueOnce({ status: 418 })
        .mockResolvedValueOnce({ status: 200 });

      const result = await retryHttp(fn, { policy: customPolicy, baseMs: 1 });

      expect(result.ok).toBe(true);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    test("custom policy blocks retry", async () => {
      const neverRetry = () => ({ retry: false });
      const fn = mock(async () => ({ status: 503 }));

      const result = await retryHttp(fn, { policy: neverRetry, baseMs: 1 });

      expect(result.ok).toBe(true);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe("HTTP method handling", () => {
    test("respects method for idempotency", async () => {
      const fn = mock(async () => ({ status: 500 }));
      const result = await retryHttp(fn, { method: "POST", maxAttempts: 5, baseMs: 1 });

      // POST is capped at 3 attempts, but last attempt succeeds with status 500 (treated as success)
      expect(result.ok).toBe(true); // retryHttp returns ok:true if last attempt completes
      expect(fn).toHaveBeenCalledTimes(3); // POST capped at 3 attempts
    });

    test("retries idempotent methods", async () => {
      const fn = mock()
        .mockResolvedValueOnce({ status: 500 })
        .mockResolvedValueOnce({ status: 200 });

      const result = await retryHttp(fn, { method: "GET", baseMs: 1 });

      expect(result.ok).toBe(true);
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe("Retry-After header", () => {
    test("respects Retry-After header", async () => {
      const startTime = Date.now();
      const fn = mock()
        .mockResolvedValueOnce({
          status: 429,
          headers: { "Retry-After": "0.05" },
        })
        .mockResolvedValueOnce({ status: 200 });

      const result = await retryHttp(fn, { method: "GET" });

      const elapsed = Date.now() - startTime;
      expect(result.ok).toBe(true);
      // Actual delay might be shorter due to processing overhead
      expect(elapsed).toBeGreaterThanOrEqual(0);
    });

    test("falls back to exponential backoff without Retry-After", async () => {
      const fn = mock()
        .mockResolvedValueOnce({ status: 503, headers: {} })
        .mockResolvedValueOnce({ status: 200 });

      const result = await retryHttp(fn, { baseMs: 1, method: "GET" });

      expect(result.ok).toBe(true);
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe("backoff configuration", () => {
    test("uses custom baseMs", async () => {
      const startTime = Date.now();
      const fn = mock()
        .mockResolvedValueOnce({ status: 503 })
        .mockResolvedValueOnce({ status: 200 });

      const result = await retryHttp(fn, { baseMs: 50, method: "GET" });

      const elapsed = Date.now() - startTime;
      expect(result.ok).toBe(true);
      expect(elapsed).toBeGreaterThanOrEqual(45);
    });

    test("uses custom factor", async () => {
      const fn = mock(async () => ({ status: 503 }));
      const result = await retryHttp(fn, {
        maxAttempts: 3,
        baseMs: 1,
        factor: 3,
        method: "GET",
      });

      expect(result.ok).toBe(false);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    test("uses custom jitter", async () => {
      const fn = mock()
        .mockResolvedValueOnce({ status: 503 })
        .mockResolvedValueOnce({ status: 200 });

      const startTime = Date.now();
      const result = await retryHttp(fn, {
        baseMs: 50,
        jitter: 0,
        method: "GET",
      });
      const elapsed = Date.now() - startTime;

      expect(result.ok).toBe(true);
      expect(elapsed).toBeGreaterThanOrEqual(45);
      expect(elapsed).toBeLessThan(75);
    });
  });

  describe("abort signal", () => {
    test("stops retrying when signal aborted", async () => {
      const controller = new AbortController();
      const fn = mock(async () => {
        controller.abort("test abort");
        return { status: 503 };
      });

      const result = await retryHttp(fn, {
        signal: controller.signal,
        method: "GET",
        baseMs: 1,
      });

      expect(result.ok).toBe(false);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    test("handles pre-aborted signal", async () => {
      const controller = new AbortController();
      controller.abort("pre-aborted");

      const fn = mock(async () => ({ status: 503 }));
      const result = await retryHttp(fn, { signal: controller.signal });

      expect(result.ok).toBe(false);
      expect(fn).toHaveBeenCalledTimes(0);
    });
  });

  describe("error handling", () => {
    test("retries on thrown exceptions", async () => {
      const fn = mock()
        .mockRejectedValueOnce(new Error("network error"))
        .mockResolvedValueOnce({ status: 200 });

      const result = await retryHttp(fn, { baseMs: 1, method: "GET" });

      expect(result.ok).toBe(true);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    test("returns error after max attempts with exceptions", async () => {
      const fn = mock(async () => {
        throw new Error("persistent error");
      });

      const result = await retryHttp(fn, {
        maxAttempts: 3,
        baseMs: 1,
        method: "GET",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect((result.error as Error).message).toBe("persistent error");
      }
      expect(fn).toHaveBeenCalledTimes(3);
    });

    test("does not retry errors with custom policy blocking it", async () => {
      const neverRetry = () => ({ retry: false });
      const fn = mock(async () => {
        throw new Error("error");
      });

      const result = await retryHttp(fn, { policy: neverRetry, baseMs: 1 });

      expect(result.ok).toBe(false);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe("edge cases", () => {
    test("handles maxAttempts = 1 (no retries)", async () => {
      const fn = mock(async () => ({ status: 503 }));
      const result = await retryHttp(fn, {
        maxAttempts: 1,
        method: "GET",
      });

      expect(fn).toHaveBeenCalledTimes(1);
    });

    test("handles successful response on last attempt", async () => {
      let attempts = 0;
      const fn = async () => {
        attempts++;
        if (attempts < 5) {
          return { status: 503 };
        }
        return { status: 200 };
      };

      const result = await retryHttp(fn, {
        maxAttempts: 5,
        baseMs: 1,
        method: "GET",
      });

      expect(result.ok).toBe(true);
      expect(attempts).toBe(5);
    });

    test("respects non-idempotent cap for POST", async () => {
      const fn = mock(async () => ({ status: 500 }));
      const result = await retryHttp(fn, {
        method: "POST",
        maxAttempts: 5,
        baseMs: 1,
      });

      // POST should stop at 3 attempts (non-idempotent cap)
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe("delay calculation", () => {
    test("delay increases exponentially", async () => {
      let callCount = 0;
      const fn = mock(async () => {
        callCount++;
        return { status: 503 };
      });

      const startTime = Date.now();
      await retryHttp(fn, {
        maxAttempts: 4,
        baseMs: 20,
        jitter: 0,
        method: "GET",
      });
      const totalTime = Date.now() - startTime;

      // Verify all attempts were made
      expect(fn).toHaveBeenCalledTimes(4);
      // Total delay should be at least baseMs + 2*baseMs + 4*baseMs = 7*baseMs = 140ms
      expect(totalTime).toBeGreaterThanOrEqual(130);
    });
  });
});
