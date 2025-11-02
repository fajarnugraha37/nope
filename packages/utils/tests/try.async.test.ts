import { describe, expect, test } from "bun:test";

import {
  mapAsync,
  retry,
  withTimeout,
  timeoutPromise,
  retryWith,
  retryAll,
  oksOnly,
  allOk,
} from "../src/try/async";

describe("async try helpers", () => {
  test("mapAsync transforms ok results and leaves errors", async () => {
    const ok = await mapAsync(
      Promise.resolve<{ ok: true; value: number }>({ ok: true, value: 2 }),
      async (v) => v * 3
    );
    expect(ok).toEqual({ ok: true, value: 6 });

    const err = await mapAsync(
      Promise.resolve<{ ok: false; error: string }>({ ok: false, error: "boom" }),
      async () => {
        throw new Error("nope");
      }
    );
    expect(err).toEqual({ ok: false, error: "boom" });
  });

  test("retry succeeds after failures and reports final error", async () => {
    let attempts = 0;
    const success = await retry(async () => {
      attempts++;
      if (attempts < 2) {
        throw new Error("fail");
      }
      return "ok";
    }, { retries: 3, delayMs: 5 });
    expect(success).toEqual({ ok: true, value: "ok" });
    expect(attempts).toBe(2);

    const failure = await retry(async () => {
      throw new Error("always");
    }, { retries: 2, delayMs: 5 });
    expect(failure.ok).toBe(false);
    expect(failure.error).toBeInstanceOf(Error);
  });

  test("withTimeout resolves, times out, and reacts to external aborts", async () => {
    const quick = await withTimeout(async (signal) => {
      expect(signal).toBeInstanceOf(AbortSignal);
      return 42;
    }, 20);
    expect(quick).toBe(42);

    const onTimeout: string[] = [];
    await expect(
      withTimeout(
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
          return "late";
        },
        5,
        { onTimeout: () => onTimeout.push("timeout") }
      )
    ).rejects.toThrow("TimeoutError");
    expect(onTimeout).toEqual(["timeout"]);

    const ac = new AbortController();
    const aborted = withTimeout(
      async (signal) => {
        await new Promise((resolve, reject) => {
          signal?.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        });
        return "never";
      },
      50,
      { signal: ac.signal }
    );
    ac.abort(new Error("stop"));
    await expect(aborted).rejects.toThrow("stop");
  });

  test("timeoutPromise settles or rejects on timeout", async () => {
    await expect(timeoutPromise(Promise.resolve("yes"), 20)).resolves.toBe("yes");
    await expect(
      timeoutPromise(new Promise(() => {}), 5)
    ).rejects.toThrow("timeout");
  });

  test("retryWith honours timeouts and abort signals", async () => {
    let attempts = 0;
    const timed = await retryWith(
      async (signal) => {
        attempts++;
        await new Promise((resolve, reject) => {
          signal?.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        });
        return "done";
      },
      { retries: 2, delayMs: 1, timeoutMs: 5 }
    );
    expect(timed.ok).toBe(false);
    expect(attempts).toBeGreaterThanOrEqual(1);

    const ac = new AbortController();
    const aborted = retryWith(async () => {
      throw new Error("fail");
    }, { retries: 3, delayMs: 5, signal: ac.signal });
    ac.abort(new Error("cancelled"));
    const abortedResult = await aborted;
    expect(abortedResult.ok).toBe(false);
    expect(abortedResult.error).toBeInstanceOf(Error);

    let succeedAttempts = 0;
    const succeeded = await retryWith(async () => {
      succeedAttempts++;
      if (succeedAttempts < 2) throw new Error("retry");
      return "ok";
    }, { retries: 3, delayMs: 1 });
    expect(succeeded).toEqual({ ok: true, value: "ok" });
  });

  test("retryAll coordinates multiple tasks with concurrency", async () => {
    let flakyAttempts = 0;
    const tasks = [
      async () => "A",
      async () => {
        flakyAttempts++;
        if (flakyAttempts < 2) throw new Error("flaky");
        return "B";
      },
      async () => {
        throw new Error("boom");
      },
    ];

    const results = await retryAll(tasks, {
      retries: 2,
      delayMs: 1,
      concurrency: 2,
    });
    expect(results[0]).toEqual({ ok: true, value: "A" });
    expect(results[1]).toEqual({ ok: true, value: "B" });
    expect(results[2].ok).toBe(false);

    expect(oksOnly(results)).toEqual(["A", "B"]);
    const combined = allOk(results);
    expect(combined.ok).toBe(false);
  });
});
