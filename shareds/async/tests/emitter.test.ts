import { describe, expect, test } from "bun:test";
import { EventEmitter } from "events";
import { Readable } from "stream";
import mitt from "../src/emitter/event-emitter";
import {
  match,
  filterEnv,
  onceNode,
  type EventEnvelope,
} from "../src/emitter/emitter";
import { EventBus } from "../src/emitter/event-bus";
import {
  createEventBus,
  createTopicDemux,
  createTopicMux,
  pipeTopics,
  tapLog,
} from "../src/emitter/factories";

type SampleEvents = {
  created: { id: string };
  deleted: { id: string };
};

describe("mitt event emitter", () => {
  test("registers and emits events", () => {
    const bus = mitt<{ foo: number }>();
    const calls: number[] = [];
    bus.on("foo", (n) => calls.push(n));
    bus.emit("foo", 1);
    expect(calls).toEqual([1]);
  });

  test("supports wildcard handlers and removing listeners", () => {
    const bus = mitt<{ foo: number; bar: string }>();
    const events: Array<string | symbol> = [];
    const handler = (value: number) => events.push(`foo:${value}`);
    const wildcard = (type: string | symbol, value: unknown) =>
      events.push(`any:${String(type)}:${value}`);
    bus.on("foo", handler);
    bus.on("*", wildcard);
    bus.emit("foo", 2);
    bus.off("foo", handler);
    bus.emit("foo", 3);
    bus.off("*");
    bus.emit("foo", 4);
    expect(events).toEqual(["foo:2", "any:foo:2", "any:foo:3"]);
  });
});

describe("emitter helpers", () => {
  test("match handles selectors", () => {
    const envelope: EventEnvelope<{ test: number }> = {
      type: "test",
      payload: 1,
    };
    expect(match("test", envelope)).toBe(true);
    expect(match(/te.*/, envelope)).toBe(true);
    expect(match((_e) => true, envelope)).toBe(true);
  });

  test("filterEnv filters stream payloads", async () => {
    const source = Readable.from(
      [
        { type: "keep", payload: 1 },
        { type: "drop", payload: 2 },
      ],
      { objectMode: true }
    );
    const filtered: any[] = [];
    await new Promise<void>((resolve, reject) => {
      source
        .pipe(filterEnv((e: any) => e.type === "keep"))
        .on("data", (chunk) => filtered.push(chunk))
        .on("end", resolve)
        .on("error", reject);
    });
    expect(filtered).toEqual([{ type: "keep", payload: 1 }]);
  });

  test("onceNode resolves after event fires", async () => {
    const emitter = new EventEmitter();
    const promise = onceNode(emitter, "ready");
    emitter.emit("ready");
    await expect(promise).resolves.toBeUndefined();
  });
});

describe("EventBus", () => {
  test("emit and on deliver envelopes", () => {
    const bus = new EventBus<SampleEvents>();
    const seen: string[] = [];
    const off = bus.on("created", (e) => seen.push(e.payload.id));
    bus.emit("created", { id: "1" });
    off();
    expect(seen).toEqual(["1"]);
  });

  test("emitAsync waits for drain", async () => {
    const bus = new EventBus<SampleEvents>();
    bus.bus.pause();
    const promise = bus.emitAsync("created", { id: "1" });
    bus.bus.resume();
    await expect(promise).resolves.toBeUndefined();
  });

  test("once resolves first matching event", async () => {
    const bus = new EventBus<SampleEvents>();
    const promise = bus.once("deleted", { timeoutMs: 50 });
    setTimeout(() => bus.emit("deleted", { id: "x" }), 5);
    const env = await promise;
    expect(env.payload.id).toBe("x");
  });

  test("waitUntil uses predicate guard", async () => {
    const bus = new EventBus<SampleEvents>();
    const promise = bus.waitUntil(
      (env): env is EventEnvelope<SampleEvents, "created"> =>
        env.type === "created"
    );
    setTimeout(() => bus.emit("created", { id: "z" }), 5);
    const env = await promise;
    expect(env.payload.id).toBe("z");
  });

  test("async iteration yields envelopes", async () => {
    const bus = new EventBus<SampleEvents>();
    const seen: string[] = [];
    setTimeout(() => {
      bus.emit("created", { id: "a" });
      bus.emit("created", { id: "b" });
      bus.end();
    }, 5);

    for await (const env of bus) {
      seen.push(env.payload.id);
    }

    expect(seen).toEqual(["a", "b"]);
  });

  test("topicReadable returns payload stream", async () => {
    const bus = new EventBus<SampleEvents>();
    const read = bus.topicReadable("created");
    const seen: string[] = [];
    read.on("data", (payload) => seen.push(payload.id));
    bus.emit("created", { id: "c" });
    await concurrencySleep(5);
    expect(seen).toEqual(["c"]);
    read.destroy();
  });

  test("topicWritable forwards payloads", async () => {
    const bus = new EventBus<SampleEvents>();
    const payloads: string[] = [];
    bus.on("created", (e) => payloads.push(e.payload.id));
    const writable = bus.topicWritable("created");
    writable.write({ id: "d" });
    await concurrencySleep(5);
    expect(payloads).toEqual(["d"]);
  });

  test("linkFrom pipes between buses", async () => {
    const src = new EventBus<SampleEvents>();
    const dst = new EventBus<SampleEvents>();
    const seen: string[] = [];
    dst.on("created", (e) => seen.push(e.payload.id));
    dst.linkFrom(src);
    src.emit("created", { id: "e" });
    await concurrencySleep(5);
    expect(seen).toEqual(["e"]);
  });

  test("once rejects after timeout elapses", async () => {
    const bus = new EventBus<SampleEvents>();
    await expect(bus.once("created", { timeoutMs: 5 })).rejects.toThrow(
      "once timeout"
    );
  });

  test("manual async iterator control supports return and throw", async () => {
    const bus = new EventBus<SampleEvents>();
    const iterator = bus[Symbol.asyncIterator]();
    const next = iterator.next();
    bus.emit("created", { id: "manual" });
    const first = await next;
    expect(first.value?.payload.id).toBe("manual");
    const returned = iterator.return?.();
    expect(returned).toBeInstanceOf(Promise);
    await expect(returned).resolves.toEqual({
      value: undefined,
      done: true,
    });
    const thrown = iterator.throw?.(new Error("stop"));
    expect(thrown).toBeInstanceOf(Promise);
    await expect(thrown).rejects.toThrow("stop");
  });

  test("iterate yields payloads until consumer stops", async () => {
    const bus = new EventBus<SampleEvents>();
    const payloads: string[] = [];
    const consumer = (async () => {
      for await (const payload of bus.iterate("created")) {
        payloads.push(payload.id);
        if (payloads.length === 2) break;
      }
    })();
    bus.emit("created", { id: "one" });
    bus.emit("deleted", { id: "ignored" });
    bus.emit("created", { id: "two" });
    await consumer;
    expect(payloads).toEqual(["one", "two"]);
  });

  test("topicWritable waits for drain on backpressure", async () => {
    const bus = new EventBus<SampleEvents>();
    const seen: string[] = [];
    bus.on("created", (e) => seen.push(e.payload.id));
    const originalEmit = bus.emit.bind(bus);
    let first = true;
    bus.emit = ((
      type: keyof SampleEvents,
      payload: SampleEvents[keyof SampleEvents],
      meta?: Record<string, any>
    ) => {
      if (first) {
        first = false;
        setTimeout(() => {
          originalEmit(type, payload, meta);
          bus.bus.emit("drain");
        }, 0);
        return false;
      }
      return originalEmit(type, payload, meta);
    }) as typeof bus.emit;
    const writable = bus.topicWritable("created");
    await new Promise<void>((resolve, reject) => {
      writable.write({ id: "bp" }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    await concurrencySleep(5);
    expect(seen).toEqual(["bp"]);
  });

  test("end closes stream gracefully", async () => {
    const bus = new EventBus<SampleEvents>();
    const iterator = bus[Symbol.asyncIterator]();
    bus.end();
    const result = await iterator.next();
    expect(result.done).toBe(true);
  });
});

describe("factory helpers", () => {
  test("createEventBus returns bus instance", () => {
    const bus = createEventBus<SampleEvents>();
    expect(bus).toBeInstanceOf(EventBus);
  });

  test("createTopicDemux exposes readable per topic", async () => {
    const bus = createEventBus<SampleEvents>();
    const demux = createTopicDemux(bus);
    const seen: string[] = [];
    demux.created.on("data", (p) => seen.push(p.id));
    bus.emit("created", { id: "x" });
    await concurrencySleep(5);
    expect(seen).toEqual(["x"]);
  });

  test("createTopicMux exposes writable per topic", async () => {
    const bus = createEventBus<SampleEvents>();
    const seen: string[] = [];
    bus.on("deleted", (e) => seen.push(e.payload.id));
    const mux = createTopicMux(bus);
    mux.deleted.write({ id: "y" });
    await concurrencySleep(5);
    expect(seen).toEqual(["y"]);
  });

  test("pipeTopics filters topics between buses", async () => {
    const src = createEventBus<SampleEvents>();
    const dst = createEventBus<SampleEvents>();
    const seen: string[] = [];
    dst.on("created", (e) => seen.push(e.payload.id));
    pipeTopics(src, dst, ["created"]);
    src.emit("created", { id: "keep" });
    src.emit("deleted", { id: "drop" });
    await concurrencySleep(5);
    expect(seen).toEqual(["keep"]);
  });

  test("tapLog passes through transform", () => {
    const transform = tapLog("test");
    expect(transform.readableObjectMode).toBe(true);
  });
});

// small sleep helper reused above
async function concurrencySleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
