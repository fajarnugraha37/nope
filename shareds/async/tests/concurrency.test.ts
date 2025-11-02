import { describe, expect, test } from "bun:test";

import { Channel, select } from "../src/concurrency/channel";
import { sleep as concurrencySleep } from "../src/concurrency/concurrency";
import { debounce } from "../src/concurrency/debounce";
import {
  withDefer,
  withDeferSync,
  flush,
  using,
  withAbort,
  timedAbort,
  useFsHandle,
  deferred,
} from "../src/concurrency/defer";
import { JobQueue } from "../src/concurrency/job-queue";
import { CountdownLatch } from "../src/concurrency/latch";
import { Mutex } from "../src/concurrency/mutex";
import { PriorityQueue } from "../src/concurrency/priority-queue";
import { FairSemaphore, Semaphore } from "../src/concurrency/semaphore";
import { ThreadPool } from "../src/concurrency/thread-pool";
import { throttle } from "../src/concurrency/throttle";
import {
  asAutoCloseable,
  usingScope,
  scope,
} from "../src/concurrency/autocloseable";

describe("Channel", () => {
  test("basic send/receive and close", async () => {
    const ch = new Channel<number>(1);
    const p = ch.recv();
    await ch.send(42);
    const r1 = await p;
    expect(r1).toEqual({ value: 42, done: false });
    ch.close();
    const r2 = await ch.recv();
    expect(r2.done).toBe(true);
  });

  test("buffers sends and unblocks queued writers", async () => {
    const ch = new Channel<number>(1);
    await ch.send(1);
    const pendingSend = ch.send(2);
    const first = await ch.recv();
    expect(first).toEqual({ value: 1, done: false });
    const second = await ch.recv();
    expect(second).toEqual({ value: 2, done: false });
    await expect(pendingSend).resolves.toBeUndefined();
  });

  test("async iterator yields until closed", async () => {
    const ch = new Channel<number>();
    const produced = [1, 2, 3];
    (async () => {
      for (const value of produced) {
        await ch.send(value);
      }
      ch.close();
    })();
    const collected: number[] = [];
    for await (const value of ch) collected.push(value);
    expect(collected).toEqual(produced);
  });

  test("send rejects when channel closed", async () => {
    const ch = new Channel<number>();
    ch.close();
    await expect(ch.send(1)).rejects.toThrow("channel closed");
  });

  test("select resolves first ready channel and supports timeout", async () => {
    const a = new Channel<number>();
    const b = new Channel<number>();
    const promise = select([a, b]);
    await b.send(99);
    const first = await promise;
    expect(first).toEqual({ index: 1, value: 99, done: false });

    b.close();
    const second = await select([b]);
    expect(second.index).toBe(0);
    expect(second.done).toBe(true);
    expect(second.timedOut === true).toBe(false);

    const timed = await select([new Channel<number>()], 5);
    expect(timed).toEqual({ index: -1, timedOut: true });
  });
});

describe("debounce and throttle", () => {
  test("debounce leading/trailing calls", async () => {
    const calls: number[] = [];
    const fn = debounce(
      (n: number) => {
        calls.push(n);
      },
      10,
      { leading: true, trailing: true }
    );
    fn(1);
    fn(2);
    expect(calls).toEqual([1]);
    await concurrencySleep(15);
    expect(calls).toEqual([1, 2]);
  });

  test("throttle limits calls", async () => {
    const calls: number[] = [];
    const fn = throttle(
      (n: number) => {
        calls.push(n);
      },
      10
    );
    fn(1);
    fn(2);
    expect(calls.length).toBe(1);
    await concurrencySleep(15);
    fn(3);
    expect(calls).toEqual([1, 3]);
  });

  test("debounce supports cancel, flush, maxWait, and abort signal", async () => {
    const calls: number[] = [];
    const deb = debounce(
      (n: number) => {
        calls.push(n);
      },
      50,
      { maxWait: 80 }
    ) as any;

    // cancel prevents trailing execution
    deb(1);
    deb.cancel();
    await concurrencySleep(60);
    expect(calls).toEqual([]);

    // flush forces execution immediately
    deb(2);
    expect(calls).toEqual([]);
    expect(deb.flush()).toBeUndefined();
    expect(calls).toEqual([2]);

    // maxWait causes invocation even with rapid calls
    deb(3);
    await concurrencySleep(20);
    deb(4);
    await concurrencySleep(20);
    deb(5);
    await concurrencySleep(90);
    expect(calls).toContain(5);

    // aborted signal skips invocation
    const controller = new AbortController();
    controller.abort();
    const guarded = debounce(
      () => {
        calls.push(999);
      },
      10,
      { signal: controller.signal }
    );
    guarded();
    await concurrencySleep(20);
    expect(calls).not.toContain(999);
  });

  test("throttle trailing, cancel, and aborted signal behaviour", async () => {
    const calls: number[] = [];
    const trailing = throttle(
      (n: number) => calls.push(n),
      30,
      { trailing: true }
    ) as any;
    trailing(1);
    trailing(2);
    await concurrencySleep(45);
    expect(calls).toEqual([1, 2]);

    const noLeading = throttle(
      (n: number) => calls.push(n),
      20,
      { leading: false, trailing: true }
    ) as any;
    noLeading(3);
    expect(calls).toEqual([1, 2]);
    await concurrencySleep(25);
    expect(calls).toEqual([1, 2, 3]);

    const canceling = throttle(
      (n: number) => calls.push(n),
      50,
      { trailing: true }
    ) as any;
    canceling(4);
    canceling(5);
    canceling.cancel();
    await concurrencySleep(60);
    expect(calls).not.toContain(5);

    const controller = new AbortController();
    controller.abort();
    const aborted = throttle(
      () => calls.push(1000),
      10,
      { signal: controller.signal }
    );
    aborted();
    await concurrencySleep(20);
    expect(calls).not.toContain(1000);
  });
});

describe("defer helpers", () => {
  test("withDefer runs finalizers", async () => {
    const order: string[] = [];
    const result = await withDefer(async (d) => {
      d.defer(() => order.push("cleanup"));
      order.push("run");
      return 99;
    });
    expect(result).toBe(99);
    expect(order).toEqual(["run", "cleanup"]);
  });

  test("withDeferSync schedules best-effort cleanup", () => {
    const order: string[] = [];
    withDeferSync((d) => {
      d.defer(() => order.push("cleanup"));
      order.push("run");
    });
    expect(order[0]).toBe("run");
  });

  test("flush aggregates errors", async () => {
    const results = await flush(
      () => {},
      () => {
        throw new Error("boom");
      }
    );
    expect(results.ok).toBe(false);
    expect(results.errors?.length).toBe(1);
  });

  test("using returns disposable wrapper", () => {
    const disposals: string[] = [];
    const resource = using({ value: 1 }, (v) => disposals.push(`closed:${v.value}`));
    const sym = Symbol.for("dispose");
    (resource as any)[sym]?.();
    expect(disposals).toEqual(["closed:1"]);
  });

  test("withAbort aborts on scope exit", async () => {
    const ac = await withDefer(async (d) => withAbort(d));
    expect(ac.signal.aborted).toBe(true);
  });

  test("timedAbort aborts after timeout", async () => {
    const result = await withDefer(async (d) => {
      const ac = timedAbort(d, 5);
      await concurrencySleep(10);
      return ac.signal.aborted;
    });
    expect(result).toBe(true);
  });

  test("useFsHandle registers close", async () => {
    const log: string[] = [];
    await withDefer(async (d) => {
      const handle = useFsHandle(d, {
        close() {
          log.push("closed");
        },
      });
      expect(handle).toBeDefined();
    });
    expect(log).toEqual(["closed"]);
  });

  test("deferred resolves externally", async () => {
    const d = deferred<number>();
    setTimeout(() => d.resolve(5), 5);
    await expect(d.promise).resolves.toBe(5);
  });
});

describe("JobQueue", () => {
  test("runs jobs with concurrency limit", async () => {
    const queue = new JobQueue(2);
    let active = 0;
    let max = 0;
    const jobs = Array.from({ length: 4 }, (_, i) =>
      queue.add(async () => {
        active++;
        max = Math.max(max, active);
        await concurrencySleep(5);
        active--;
        return i;
      })
    );
    const results = await Promise.all(jobs);
    expect(results.sort()).toEqual([0, 1, 2, 3]);
    expect(max).toBeLessThanOrEqual(2);
  });

  test("tracks queue size/active count and propagates errors", async () => {
    const queue = new JobQueue(1);
    const err = new Error("fail");

    const slow = queue.add(async () => {
      await concurrencySleep(10);
      return "ok";
    });
    const failing = queue.add(async () => {
      throw err;
    });

    expect(queue.size()).toBeGreaterThanOrEqual(1);
    expect(queue.activeCount()).toBeGreaterThanOrEqual(1);
    await expect(failing).rejects.toThrow("fail");
    expect(await slow).toBe("ok");
    expect(queue.size()).toBe(0);
  });
});

describe("CountdownLatch", () => {
  test("wait resolves after count reaches zero", async () => {
    const latch = new CountdownLatch(2);
    const waitPromise = latch.wait();
    latch.countDown();
    expect(await Promise.race([waitPromise, Promise.resolve("pending")])).toBe(
      "pending"
    );
    latch.countDown();
    await expect(waitPromise).resolves.toBeUndefined();
  });

  test("add increases pending count before wait resolves", async () => {
    const latch = new CountdownLatch(1);
    const waitPromise = latch.wait();
    latch.add(2);
    latch.countDown();
    let settled = false;
    waitPromise.then(() => {
      settled = true;
    });
    await concurrencySleep(1);
    expect(settled).toBe(false);
    latch.countDown(2);
    await expect(waitPromise).resolves.toBeUndefined();
  });
});

describe("Mutex", () => {
  test("runExclusive enforces exclusivity", async () => {
    const mutex = new Mutex();
    let active = 0;
    let max = 0;
    await Promise.all(
      Array.from({ length: 4 }, () =>
        mutex.runExclusive(async () => {
          active++;
          max = Math.max(max, active);
          await concurrencySleep(5);
          active--;
        })
      )
    );
    expect(max).toBe(1);
  });
});

describe("PriorityQueue", () => {
  test("maintains heap ordering and respects capacity", () => {
    const dropped: number[] = [];
    const pq = new PriorityQueue<number>((a, b) => a - b, 3, (d) =>
      dropped.push(d)
    );
    [5, 1, 3, 2].forEach((n) => pq.push(n));
    expect(pq.size()).toBe(3);
    expect(dropped.length).toBe(1);
    expect(dropped[0]).toBe(5);
    expect(pq.peek()).toBe(1);
    expect(pq.isEmpty()).toBe(false);
    expect([pq.pop(), pq.pop(), pq.pop()]).toEqual([1, 2, 3]);
    expect(pq.pop()).toBeUndefined();
    expect(pq.isEmpty()).toBe(true);
  });
});

describe("Semaphore", () => {
  test("withPermit serialises access and validates arguments", async () => {
    expect(() => new Semaphore(0)).toThrow("semaphore max must be > 0");
    const sem = new Semaphore(1);
    expect(() => sem.acquire(0)).toThrow("acquire n must be > 0");
    expect(() => sem.release(0)).toThrow("release n must be > 0");

    const order: string[] = [];
    const first = sem.withPermit(async () => {
      order.push("first-start");
      await concurrencySleep(10);
      order.push("first-end");
    });
    const second = sem.withPermit(async () => {
      order.push("second");
    });
    await concurrencySleep(5);
    expect(order).toEqual(["first-start"]);
    await first;
    await second;
    expect(order).toEqual(["first-start", "first-end", "second"]);
  });
});

describe("FairSemaphore", () => {
  test("processes requests FIFO and exposes metrics", async () => {
    const sem = new FairSemaphore(1);
    const order: string[] = [];
    const first = sem.withPermit(async () => {
      order.push("A");
      await concurrencySleep(10);
    });
    const second = sem.withPermit(async () => {
      order.push("B");
    });
    const third = sem.withPermit(async () => {
      order.push("C");
    });

    expect(sem.available()).toBe(0);
    expect(sem.pending()).toBe(2);

    await Promise.all([first, second, third]);
    expect(order).toEqual(["A", "B", "C"]);
    expect(sem.available()).toBe(1);
    expect(sem.pending()).toBe(0);
  });
});

describe("ThreadPool", () => {
  test("run executes function body", async () => {
    const pool = new ThreadPool(1);
    const result = await pool.run<number>("return a0 + a1;", [2, 3]);
    expect(result).toBe(5);
  });

  test("executes function via in-process fallback when no worker threads", async () => {
    const pool = new ThreadPool(2);
    (pool as any).nodeWorkerCtor = null;
    (pool as any).webWorkerCtor = null;
    (pool as any).webWorkerScriptUrl = null;
    const result = await pool.run<number>("return a0 + a1;", [2, 3]);
    expect(result).toBe(5);
  });

  test("uses node worker implementation when available", async () => {
    const events: string[] = [];

    class FakeNodeWorker {
      static last: FakeNodeWorker | null = null;
      private handlers: Record<string, (value: any) => void> = {};
      public terminated = false;

      constructor(..._args: any[]) {
        events.push("constructed");
        FakeNodeWorker.last = this;
      }

      on(event: string, handler: (value: any) => void) {
        this.handlers[event] = handler;
      }

      addListener(event: string, handler: (value: any) => void) {
        this.handlers[event] = handler;
      }

      off(event: string) {
        delete this.handlers[event];
      }

      removeListener(event: string) {
        delete this.handlers[event];
      }

      postMessage({ fnBody, args }: { fnBody: string; args: any[] }) {
        events.push("postMessage");
        try {
          // eslint-disable-next-line no-new-func
          const fn = new Function(...args.map((_, i) => `a${i}`), fnBody);
          const value = fn(...args);
          this.handlers["message"]?.({ ok: true, v: value });
        } catch (err) {
          this.handlers["message"]?.({ ok: false, e: String(err) });
        }
      }

      terminate() {
        events.push("terminate");
        this.terminated = true;
      }
    }

    const pool = new ThreadPool(1);
    (pool as any).nodeWorkerCtor = FakeNodeWorker;
    (pool as any).webWorkerCtor = null;
    (pool as any).webWorkerScriptUrl = null;
    const result = await pool.run<number>("return a0 * a1;", [3, 4]);
    expect(result).toBe(12);
    expect(events).toEqual(["constructed", "postMessage", "terminate"]);
    expect(FakeNodeWorker.last?.terminated).toBe(true);
  });

  test("propagates node worker errors", async () => {
    class ErrorNodeWorker {
      static last: ErrorNodeWorker | null = null;
      private handlers: Record<string, (value: any) => void> = {};
      public terminated = false;

      constructor(..._args: any[]) {
        ErrorNodeWorker.last = this;
      }

      on(event: string, handler: (value: any) => void) {
        this.handlers[event] = handler;
      }

      addListener(event: string, handler: (value: any) => void) {
        this.handlers[event] = handler;
      }

      off() {
        /* noop */
      }

      removeListener() {
        /* noop */
      }

      terminate() {
        this.terminated = true;
      }

      postMessage() {
        setTimeout(() => {
          this.handlers["message"]?.({ ok: false, e: "boom" });
        }, 0);
      }
    }

    const pool = new ThreadPool(1);
    (pool as any).nodeWorkerCtor = ErrorNodeWorker;
    (pool as any).webWorkerCtor = null;
    (pool as any).webWorkerScriptUrl = null;
    await expect(pool.run("return 1;", [])).rejects.toThrow("boom");
    expect(ErrorNodeWorker.last?.terminated).toBe(true);
  });

  test("uses web worker implementation when configured", async () => {
    class FakeWebWorker {
      static last: FakeWebWorker | null = null;
      public onmessage: ((event: { data: any }) => void) | null = null;
      public onerror: ((event: any) => void) | null = null;
      public terminated = false;

      constructor(public url: string) {
        FakeWebWorker.last = this;
      }

      postMessage({ fnBody, args }: { fnBody: string; args: any[] }) {
        try {
          // eslint-disable-next-line no-new-func
          const fn = new Function(...args.map((_, i) => `a${i}`), fnBody);
          const value = fn(...args);
          this.onmessage?.({ data: { ok: true, v: value } });
        } catch (err) {
          this.onmessage?.({ data: { ok: false, e: String(err) } });
        }
      }

      terminate() {
        this.terminated = true;
      }
    }

    const pool = new ThreadPool(1);
    (pool as any).nodeWorkerCtor = null;
    (pool as any).webWorkerCtor = FakeWebWorker;
    (pool as any).webWorkerScriptUrl = "blob://fake";
    const result = await pool.run<number>("return a0 - a1;", [7, 2]);
    expect(result).toBe(5);
    expect(FakeWebWorker.last?.terminated).toBe(true);
  });

  test("propagates web worker errors", async () => {
    class ErrorWebWorker {
      static last: ErrorWebWorker | null = null;
      public onmessage: ((event: { data: any }) => void) | null = null;
      public onerror: ((event: any) => void) | null = null;
      public terminated = false;

      constructor(public url: string) {
        ErrorWebWorker.last = this;
      }

      postMessage() {
        setTimeout(() => {
          this.onerror?.({ error: new Error("fail"), message: "fail" });
        }, 0);
      }

      terminate() {
        this.terminated = true;
      }
    }

    const pool = new ThreadPool(1);
    (pool as any).nodeWorkerCtor = null;
    (pool as any).webWorkerCtor = ErrorWebWorker;
    (pool as any).webWorkerScriptUrl = "blob://fake";
    await expect(pool.run("return 1;", [])).rejects.toThrow("fail");
    expect(ErrorWebWorker.last?.terminated).toBe(true);
  });
});

describe("auto closeable helpers", () => {
  test("asAutoCloseable runs closer once for sync and async disposals", async () => {
    let count = 0;
    const resource = { name: "res" };
    const closable = asAutoCloseable(resource, async () => {
      count++;
      await concurrencySleep(1);
    });
    const keys = [
      ...Object.getOwnPropertySymbols(closable),
      ...Object.getOwnPropertyNames(closable),
    ];
    const asyncKey =
      keys.find((k) => String(k).includes("asyncDispose")) ?? "undefined";
    const syncKey =
      keys.find((k) => String(k).includes("dispose")) ?? "undefined";
    const asyncFn = (closable as any)[asyncKey];
    if (typeof asyncFn === "function") {
      await asyncFn.call(closable);
      await asyncFn.call(closable);
    }
    const syncFn = (closable as any)[syncKey];
    if (typeof syncFn === "function") {
      syncFn.call(closable);
    }
    expect(count).toBe(1);
  });

  test("asAutoCloseable prefers async dispose symbol when available", async () => {
    const events: string[] = [];
    const resource: any = {
      [Symbol.asyncDispose]: async () => {
        events.push("async");
      },
      [Symbol.dispose]: () => {
        events.push("sync");
      },
    };
    const closable = asAutoCloseable(resource);
    await (closable as any)[Symbol.asyncDispose]();
    expect(events).toEqual(["async"]);
  });

  test("asAutoCloseable falls back to destroy and end", async () => {
    const events: string[] = [];
    const destroyable = { destroy: () => events.push("destroy") };
    const closableDestroy = asAutoCloseable(destroyable);
    await (closableDestroy as any)[Symbol.asyncDispose]();
    const endable = { end: () => events.push("end") };
    const closableEnd = asAutoCloseable(endable);
    await (closableEnd as any)[Symbol.asyncDispose]();
    expect(events).toEqual(["destroy", "end"]);
  });

  test("usingScope unwinds resources LIFO and scope forwards helpers", async () => {
    const events: string[] = [];
    const result = await usingScope(async (use) => {
      const res = await use(
        { close: () => events.push("auto-close") }
      );
      use.addFinalizer(() => events.push(`manual-${res ? "ok" : "no"}`));
      events.push("body");
      return 7;
    });
    expect(result).toBe(7);
    expect(events).toEqual(["body", "auto-close", "manual-ok"]);

    const scoped: string[] = [];
    const out = await scope(async ({ add, use }) => {
      await use({ end: () => scoped.push("end") });
      add(() => scoped.push("manual"));
      scoped.push("work");
      return "done";
    });
    expect(out).toBe("done");
    expect(scoped).toEqual(["work", "end", "manual"]);
  });

  test("usingScope captures suppressed errors on failure", async () => {
    await expect(
      usingScope(async (use) => {
        await use({
          close: () => {
            throw new Error("auto");
          },
        });
        use.addFinalizer(() => {
          throw new Error("manual");
        });
        throw new Error("boom");
      })
    ).rejects.toMatchObject({
      message: "boom",
      suppressed: [expect.any(Error), expect.any(Error)],
    });
  });
});

describe("PriorityQueue", () => {
  test("maintains heap ordering", () => {
    const pq = new PriorityQueue<number>((a, b) => a - b);
    pq.push(5);
    pq.push(1);
    pq.push(3);
    expect(pq.pop()).toBe(1);
    expect(pq.pop()).toBe(3);
    expect(pq.pop()).toBe(5);
  });
});

describe("Semaphore", () => {
  test("acquire respects permits", async () => {
    const sem = new Semaphore(2);
    let max = 0;
    let active = 0;
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        const release = await sem.acquire();
        active++;
        max = Math.max(max, active);
        await concurrencySleep(5);
        active--;
        release();
      })
    );
    expect(max).toBeLessThanOrEqual(2);
  });

  test("FairSemaphore grants permits in order", async () => {
    const sem = new FairSemaphore(1);
    const order: number[] = [];
    await Promise.all(
      [1, 2, 3].map(async (id) => {
        const release = await sem.acquire();
        order.push(id);
        await concurrencySleep(5);
        release();
      })
    );
    expect(order).toEqual([1, 2, 3]);
  });
});

describe("autocloseable helpers", () => {
  test("asAutoCloseable attaches dispose symbols", async () => {
    let closed: boolean = false;
    {
        using _ = asAutoCloseable(
        { value: 1 },
        () => {
          closed = true;
        }
      );
    }
    expect(closed).toBe(true);
  });

  test("usingScope cleans up resources on success", async () => {
    const log: string[] = [];
    await usingScope(async (use) => {
      await use(
        Promise.resolve({
          close() {
            log.push("closed");
          },
        })
      );
      log.push("body");
    });
    expect(log).toEqual(["body", "closed"]);
  });

  test("scope helper registers manual finalizers", async () => {
    const log: string[] = [];
    await scope(async ({ add, use }) => {
      add(() => log.push("manual"));
      await use(
        Promise.resolve({
          close() {
            log.push("auto");
          },
        })
      );
      log.push("body");
    });
    expect(log).toEqual(["body", "auto", "manual"]);
  });
});
