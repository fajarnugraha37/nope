import { describe, expect, test } from "bun:test";

import {
  tryCatch,
  tryCatchAsync,
  unwrap,
  unwrapOr,
  unwrapOrElse,
  map,
  mapErr,
  andThen,
  type Result,
} from "../src/try/wrappers";
import {
  collectAll,
  partitionOkErr,
  firstErr,
  anyOk,
  collectAllObj,
  allAsync,
  allSettledAsResults,
  allResultsAsync,
  raceAsync,
  raceResultsAsync,
  allAsyncLimited,
} from "../src/try/collections";
import {
  mapAsync,
  retry,
  withTimeout,
} from "../src/try/async";
import {
  logErr,
  ensureOk,
  tapOk,
  tapErr,
  tapLogOk,
  tapLogErr,
} from "../src/try/misc";

describe("try wrappers", () => {
  test("tryCatch captures exceptions", () => {
    const ok = tryCatch(() => 1);
    const err = tryCatch(() => {
      throw new Error("fail");
    });
    expect(ok).toEqual({ ok: true, value: 1 });
    expect(err.ok).toBe(false);
  });

  test("tryCatchAsync handles async errors", async () => {
    const ok = await tryCatchAsync(async () => 2);
    const err = await tryCatchAsync(async () => {
      throw new Error("fail");
    });
    expect(ok.ok).toBe(true);
    expect(err.ok).toBe(false);
  });

  test("unwrap helpers", () => {
    expect(unwrap({ ok: true, value: 1 })).toBe(1);
    expect(unwrapOr({ ok: false, error: new Error("x") }, 5)).toBe(5);
    expect(
      unwrapOrElse({ ok: false, error: "x" }, (e) => String(e).length)
    ).toBe(1);
  });

  test("map and mapErr transform results", () => {
    expect(map({ ok: true, value: 2 }, (x) => x * 2)).toEqual({
      ok: true,
      value: 4,
    });
    expect(mapErr({ ok: false, error: "x" }, (e) => e + "!")).toEqual({
      ok: false,
      error: "x!",
    });
  });

  test("andThen chains results", () => {
    const res = andThen({ ok: true, value: 2 }, (x) =>
      x > 1 ? { ok: true, value: x * 2 } : { ok: false, error: "bad" }
    );
    expect(res).toEqual({ ok: true, value: 4 });
  });
});

describe("collections helpers", () => {
  const ok = <T>(value: T): Result<T> => ({ ok: true, value });
  const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

  test("collectAll returns array or first err", () => {
    expect(collectAll([ok(1), ok(2)])).toEqual({ ok: true, value: [1, 2] });
    const failed = collectAll([ok(1), err("boom")]);
    expect(failed.ok).toBe(false);
  });

  test("partitionOkErr splits results", () => {
    const parts = partitionOkErr([ok(1), err("oops")]);
    expect(parts).toEqual({ oks: [1], errs: ["oops"] });
  });

  test("firstErr and anyOk scan arrays", () => {
    expect(firstErr([ok(1), err("bad")])).toEqual({ ok: false, error: "bad" });
    expect(anyOk([err("bad"), ok(1)])).toBe(true);
  });

  test("collectAllObj unwraps values", () => {
    const result = collectAllObj({ a: ok(1), b: ok("x") });
    expect(result).toEqual({ ok: true, value: { a: 1, b: "x" } });
  });

  test("allAsync resolves parallel tasks", async () => {
    const res = await allAsync([() => Promise.resolve(1), () => Promise.resolve(2)]);
    expect(res).toEqual({ ok: true, value: [1, 2] });
  });

  test("allSettledAsResults mirrors Promise.allSettled", async () => {
    const settled = await allSettledAsResults([
      Promise.resolve(1),
      Promise.reject(new Error("x")),
    ]);
    expect(settled[0]).toEqual({ ok: true, value: 1 });
    expect(settled[1]?.ok).toBe(false);
  });

  test("allResultsAsync short-circuits on errors", async () => {
    const res = await allResultsAsync([
      () => Promise.resolve(ok(1)),
      () => Promise.resolve(err("bad")),
    ]);
    expect(res.ok).toBe(false);
  });

  test("raceAsync resolves first winner", async () => {
    const res = await raceAsync([
      () => new Promise<number>((resolve) => setTimeout(() => resolve(2), 5)),
      () => Promise.resolve(1),
    ]);
    expect(res).toEqual({ ok: true, value: 1 });
  });

  test("raceResultsAsync resolves first settled result", async () => {
    const res = await raceResultsAsync([
      () => Promise.resolve(ok(1)),
      () => Promise.resolve(err("bad")),
    ]);
    expect(res).toEqual({ ok: true, value: 1 });
  });

  test("allAsyncLimited respects concurrency", async () => {
    let active = 0;
    let max = 0;
    const res = await allAsyncLimited(
      Array.from({ length: 4 }, () => async () => {
        active++;
        max = Math.max(max, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active--;
        return active;
      }),
      2
    );
    expect(res.ok).toBe(true);
    expect(max).toBeLessThanOrEqual(2);
  });
});

describe("async helpers", () => {
  test("mapAsync chains async computations", async () => {
    const base = tryCatchAsync(async () => 2);
    const res = await mapAsync(base, async (x) => x * 2);
    expect(res).toEqual({ ok: true, value: 4 });
  });

  test("retry retries failing operation", async () => {
    let attempts = 0;
    const res = await retry(
      async () => {
        attempts++;
        if (attempts < 2) throw new Error("fail");
        return "ok";
      },
      { retries: 3, delayMs: 5 }
    );
    expect(res).toEqual({ ok: true, value: "ok" });
    expect(attempts).toBe(2);
  });

  test("withTimeout aborts long operations", async () => {
    await expect(
      withTimeout(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "done";
      }, 5)
    ).rejects.toThrow("TimeoutError");
  });

  test("withTimeout not aborts short operations", async () => {
    await expect(
      withTimeout(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "done";
      }, 25)
    ).resolves.toEqual("done");
  });
});

describe("misc helpers", () => {
  test("logErr writes to console.error", () => {
    const logs: unknown[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      logs.push(args);
    };
    logErr({ ok: false, error: "boom" });
    console.error = original;
    expect(logs.length).toBe(1);
  });

  test("ensureOk unwraps or throws", () => {
    expect(ensureOk({ ok: true, value: 1 })).toBe(1);
    expect(() => ensureOk({ ok: false, error: "bad" }, "ctx")).toThrow(
      "ctx: bad"
    );
  });

  test("tapOk and tapErr run side effects", () => {
    const okLogs: unknown[] = [];
    const errLogs: unknown[] = [];
    tapOk({ ok: true, value: 1 }, (v) => okLogs.push(v));
    tapErr({ ok: false, error: "bad" }, (e) => errLogs.push(e));
    expect(okLogs).toEqual([1]);
    expect(errLogs).toEqual(["bad"]);
  });

  test("tapLogOk and tapLogErr use console", () => {
    const logs: string[] = [];
    const originalLog = console.log;
    const originalErr = console.error;
    console.log = (msg: string) => logs.push(msg);
    console.error = (msg: string) => logs.push(msg);
    tapLogOk<number>("OK")({ ok: true, value: 1 });
    tapLogErr("ERR")({ ok: false, error: "bad" });
    console.log = originalLog;
    console.error = originalErr;
    expect(logs.some((msg) => msg.includes("OK"))).toBe(true);
    expect(logs.some((msg) => msg.includes("ERR"))).toBe(true);
  });
});
