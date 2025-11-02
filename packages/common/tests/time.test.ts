import { describe, expect, test } from "bun:test";

import {
  TimeUnit,
  fromMills,
  toMills,
  sleep,
  nowWall,
  nowMono,
} from "../src/time/common";

describe("time helpers", () => {
  test("TimeUnit conversions work both ways", () => {
    expect(fromMills(2, TimeUnit.Seconds)).toBe(2000);
    expect(toMills(2000, TimeUnit.Seconds)).toBe(2);
  });

  test("sleep waits approximately the requested time", async () => {
    const start = Date.now();
    await sleep(10);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(8);
  });

  test("sleep respects AbortSignal", async () => {
    const ac = new AbortController();
    const promise = sleep(1000, TimeUnit.Milliseconds, ac.signal);
    ac.abort();
    await expect(promise).rejects.toThrow("Sleep aborted");
  });

  test("nowWall and nowMono return non-decreasing timestamps", async () => {
    const wall1 = nowWall();
    const mono1 = nowMono();
    await sleep(5);
    const wall2 = nowWall();
    const mono2 = nowMono();
    expect(wall2).toBeGreaterThanOrEqual(wall1);
    expect(mono2).toBeGreaterThanOrEqual(mono1);
  });
});
