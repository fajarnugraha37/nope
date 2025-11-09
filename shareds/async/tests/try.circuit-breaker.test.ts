import { describe, expect, test, mock } from "bun:test";
import {
  CircuitBreaker,
  withCircuitBreaker,
  type CircuitBreakerOpts,
} from "../src/try/circuit-breaker";

describe("CircuitBreaker", () => {
  describe("construction and initial state", () => {
    test("starts in closed state", () => {
      const cb = new CircuitBreaker();
      expect(cb.getState()).toBe("closed");
    });

    test("accepts custom options", () => {
      const onStateChange = mock(() => {});
      const cb = new CircuitBreaker({
        failureThreshold: 3,
        successThreshold: 1,
        cooldownMs: 5000,
        onStateChange,
      });
      expect(cb.getState()).toBe("closed");
    });

    test("uses custom clock", () => {
      let time = 1000;
      const clock = () => time;
      const cb = new CircuitBreaker({ clock });
      expect(cb.getState()).toBe("closed");
    });
  });

  describe("state: closed → open", () => {
    test("opens after failureThreshold consecutive failures", () => {
      const cb = new CircuitBreaker({ failureThreshold: 3 });

      cb.fail();
      expect(cb.getState()).toBe("closed");

      cb.fail();
      expect(cb.getState()).toBe("closed");

      cb.fail();
      expect(cb.getState()).toBe("open");
    });

    test("resets failure count on success", () => {
      const cb = new CircuitBreaker({ failureThreshold: 3 });

      cb.fail();
      cb.fail();
      expect(cb.getState()).toBe("closed");

      cb.success(); // reset
      expect(cb.getState()).toBe("closed");

      cb.fail();
      expect(cb.getState()).toBe("closed");
    });

    test("calls onStateChange when opening", () => {
      const onStateChange = mock((from, to) => {});
      const cb = new CircuitBreaker({
        failureThreshold: 2,
        onStateChange,
      });

      cb.fail();
      cb.fail();

      expect(onStateChange).toHaveBeenCalledWith("closed", "open");
    });
  });

  describe("state: open", () => {
    test("rejects calls when open", () => {
      const cb = new CircuitBreaker({ failureThreshold: 1 });

      cb.fail(); // opens
      expect(cb.getState()).toBe("open");
      expect(cb.allow()).toBe(false);
    });

    test("stays open during cooldown period", () => {
      let time = 0;
      const clock = () => time;
      const cb = new CircuitBreaker({
        failureThreshold: 1,
        cooldownMs: 1000,
        clock,
      });

      cb.fail(); // opens at t=0
      expect(cb.allow()).toBe(false);

      time = 500; // halfway through cooldown
      expect(cb.allow()).toBe(false);

      time = 999; // just before cooldown ends
      expect(cb.allow()).toBe(false);
    });

    test("transitions to half-open after cooldown", () => {
      let time = 0;
      const clock = () => time;
      const cb = new CircuitBreaker({
        failureThreshold: 1,
        cooldownMs: 1000,
        clock,
      });

      cb.fail(); // opens at t=0
      time = 1000; // cooldown complete

      expect(cb.allow()).toBe(true);
      expect(cb.getState()).toBe("half-open");
    });
  });

  describe("state: half-open", () => {
    test("closes after successThreshold successes", () => {
      let time = 0;
      const clock = () => time;
      const cb = new CircuitBreaker({
        failureThreshold: 1,
        successThreshold: 2,
        cooldownMs: 1000,
        clock,
      });

      cb.fail(); // open
      time = 1000; // wait
      cb.allow(); // half-open

      cb.success();
      expect(cb.getState()).toBe("half-open");

      cb.success();
      expect(cb.getState()).toBe("closed");
    });

    test("reopens immediately on any failure", () => {
      let time = 0;
      const clock = () => time;
      const onStateChange = mock(() => {});
      const cb = new CircuitBreaker({
        failureThreshold: 1,
        successThreshold: 2,
        cooldownMs: 1000,
        clock,
        onStateChange,
      });

      cb.fail(); // open
      time = 1000;
      cb.allow(); // half-open

      cb.success();
      expect(cb.getState()).toBe("half-open");

      cb.fail(); // should reopen
      expect(cb.getState()).toBe("open");
      expect(cb.allow()).toBe(false);
    });

    test("calls onStateChange when closing from half-open", () => {
      let time = 0;
      const clock = () => time;
      const onStateChange = mock(() => {});
      const cb = new CircuitBreaker({
        failureThreshold: 1,
        successThreshold: 1,
        cooldownMs: 1000,
        clock,
        onStateChange,
      });

      cb.fail(); // open
      time = 1000;
      cb.allow(); // half-open
      cb.success(); // close

      expect(onStateChange).toHaveBeenCalledTimes(3);
      // Check transitions happened (closed->open, open->half-open, half-open->closed)
      expect(onStateChange).toHaveBeenNthCalledWith(1, "closed", "open");
      expect(onStateChange).toHaveBeenNthCalledWith(2, "open", "half-open");
      expect(onStateChange).toHaveBeenNthCalledWith(3, "half-open", "closed");
    });
  });

  describe("manual controls", () => {
    test("forceOpen sets state to open", () => {
      const cb = new CircuitBreaker();
      expect(cb.getState()).toBe("closed");

      cb.forceOpen();
      expect(cb.getState()).toBe("open");
      expect(cb.allow()).toBe(false);
    });

    test("forceOpen accepts custom cooldown", () => {
      let time = 0;
      const clock = () => time;
      const cb = new CircuitBreaker({ clock, cooldownMs: 10000 });

      cb.forceOpen(5000);
      expect(cb.allow()).toBe(false);

      time = 4999;
      expect(cb.allow()).toBe(false);

      time = 5000;
      expect(cb.allow()).toBe(true);
      expect(cb.getState()).toBe("half-open");
    });

    test("forceClose resets to closed state", () => {
      const cb = new CircuitBreaker({ failureThreshold: 1 });

      cb.fail(); // open
      expect(cb.getState()).toBe("open");

      cb.forceClose();
      expect(cb.getState()).toBe("closed");
      expect(cb.allow()).toBe(true);
    });

    test("forceClose resets counters", () => {
      const cb = new CircuitBreaker({ failureThreshold: 3 });

      cb.fail();
      cb.fail();
      cb.forceClose();

      // should require 3 more failures to open
      cb.fail();
      cb.fail();
      expect(cb.getState()).toBe("closed");

      cb.fail();
      expect(cb.getState()).toBe("open");
    });
  });

  describe("edge cases", () => {
    test("handles zero cooldown", () => {
      let time = 0;
      const clock = () => time;
      const cb = new CircuitBreaker({
        failureThreshold: 1,
        cooldownMs: 0,
        clock,
      });

      cb.fail(); // open
      expect(cb.getState()).toBe("open");

      // immediately transitions to half-open
      expect(cb.allow()).toBe(true);
      expect(cb.getState()).toBe("half-open");
    });

    test("handles threshold of 1", () => {
      const cb = new CircuitBreaker({
        failureThreshold: 1,
        successThreshold: 1,
      });

      cb.fail();
      expect(cb.getState()).toBe("open");
    });

    test("does not call onStateChange when state unchanged", () => {
      const onStateChange = mock(() => {});
      const cb = new CircuitBreaker({ onStateChange });

      cb.success();
      cb.success();

      expect(onStateChange).not.toHaveBeenCalled();
    });
  });
});

describe("withCircuitBreaker", () => {
  test("wraps function with circuit breaker", async () => {
    const cb = new CircuitBreaker({ failureThreshold: 2 });
    const fn = mock(async () => 42);
    const wrapped = withCircuitBreaker(cb, fn);

    const result = await wrapped();
    expect(result).toEqual({ ok: true, value: 42 });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("records success and keeps circuit closed", async () => {
    const cb = new CircuitBreaker({ failureThreshold: 2 });
    const fn = async () => "ok";
    const wrapped = withCircuitBreaker(cb, fn);

    await wrapped();
    await wrapped();

    expect(cb.getState()).toBe("closed");
  });

  test("records failure and opens circuit", async () => {
    const cb = new CircuitBreaker({ failureThreshold: 2 });
    const fn = async () => {
      throw new Error("fail");
    };
    const wrapped = withCircuitBreaker(cb, fn);

    await wrapped();
    await wrapped();

    expect(cb.getState()).toBe("open");
  });

  test("returns error when circuit is open", async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1 });
    const fn = mock(async () => {
      throw new Error("fail");
    });
    const wrapped = withCircuitBreaker(cb, fn);

    await wrapped(); // fail and open
    const result = await wrapped(); // should not call fn

    expect(result).toEqual({ ok: false, error: new Error("circuit open") });
    expect(fn).toHaveBeenCalledTimes(1); // only first call
  });

  test("passes AbortSignal to wrapped function", async () => {
    const cb = new CircuitBreaker();
    const fn = mock(async (signal?: AbortSignal) => {
      return signal ? "with signal" : "no signal";
    });
    const wrapped = withCircuitBreaker(cb, fn);

    const controller = new AbortController();
    await wrapped(controller.signal);

    expect(fn).toHaveBeenCalledWith(controller.signal);
  });

  test("handles circuit recovery in half-open state", async () => {
    let time = 0;
    const clock = () => time;
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      successThreshold: 2,
      cooldownMs: 1000,
      clock,
    });

    let shouldFail = true;
    const fn = async () => {
      if (shouldFail) throw new Error("fail");
      return "ok";
    };
    const wrapped = withCircuitBreaker(cb, fn);

    // Open circuit
    await wrapped();
    expect(cb.getState()).toBe("open");

    // Wait for cooldown
    time = 1000;
    shouldFail = false;

    // Half-open: succeed twice to close
    await wrapped();
    expect(cb.getState()).toBe("half-open");

    await wrapped();
    expect(cb.getState()).toBe("closed");

    // Should work normally now
    const result = await wrapped();
    expect(result).toEqual({ ok: true, value: "ok" });
  });

  test("complex scenario: multiple failures and recovery", async () => {
    let time = 0;
    const clock = () => time;
    const onStateChange = mock(() => {});
    const cb = new CircuitBreaker({
      failureThreshold: 3,
      successThreshold: 2,
      cooldownMs: 5000,
      clock,
      onStateChange,
    });

    let callCount = 0;
    const fn = async () => {
      callCount++;
      // fail first 3 times, then succeed
      if (callCount <= 3) throw new Error("fail");
      return callCount;
    };
    const wrapped = withCircuitBreaker(cb, fn);

    // 3 failures -> open
    await wrapped();
    await wrapped();
    await wrapped();
    expect(cb.getState()).toBe("open");

    // Try during cooldown -> blocked
    const blocked = await wrapped();
    expect(blocked).toEqual({ ok: false, error: new Error("circuit open") });

    // Wait for cooldown
    time = 5000;

    // Half-open: 2 successes -> closed
    const result1 = await wrapped();
    expect(result1).toEqual({ ok: true, value: 4 });
    expect(cb.getState()).toBe("half-open");

    const result2 = await wrapped();
    expect(result2).toEqual({ ok: true, value: 5 });
    expect(cb.getState()).toBe("closed");

    // Verify state transitions
    expect(onStateChange).toHaveBeenCalledTimes(3);
    expect(onStateChange).toHaveBeenNthCalledWith(1, "closed", "open");
    expect(onStateChange).toHaveBeenNthCalledWith(2, "open", "half-open");
    expect(onStateChange).toHaveBeenNthCalledWith(3, "half-open", "closed");
  });
});
