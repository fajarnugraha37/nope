import { describe, expect, it, afterEach } from "bun:test";
import { customBackoff, exponentialBackoff, fixedBackoff } from "../../../src/util/backoff.js";

const originalRandom = Math.random;

afterEach(() => {
  Math.random = originalRandom;
});

describe("util/backoff", () => {
  it("returns constant delay for fixed backoff without jitter", () => {
    const backoff = fixedBackoff({ delayMs: 500 });
    expect(backoff.nextDelay(1)).toBe(500);
    expect(backoff.nextDelay(2)).toBe(500);
  });

  it("applies jitter for fixed backoff when requested", () => {
    Math.random = () => 0.25;
    const backoff = fixedBackoff({ delayMs: 1_000, jitterRatio: 0.5 });
    // jitter range => 500..1500; with random=0.25 we expect 500 + (1000 * 0.25) = 750
    expect(backoff.nextDelay(1)).toBeCloseTo(750, 5);
  });

  it("calculates exponential delays and respects max caps", () => {
    Math.random = () => 0;
    const backoff = exponentialBackoff({
      baseDelayMs: 100,
      factor: 3,
      maxDelayMs: 1_000,
      jitterRatio: 0.1,
    });
    expect(backoff.nextDelay(1)).toBeCloseTo(100 - 10, 5); // min jitter
    expect(backoff.nextDelay(2)).toBeCloseTo(300 - 30, 5);
    expect(backoff.nextDelay(5)).toBeCloseTo(1_000 - 100, 5); // capped
  });

  it("never returns negative delays for custom backoff", () => {
    const backoff = customBackoff((attempt) => (attempt === 1 ? -100 : 50));
    expect(backoff.nextDelay(1)).toBe(0);
    expect(backoff.nextDelay(2)).toBe(50);
  });
});
