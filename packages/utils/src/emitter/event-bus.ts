import { PassThrough, Transform, Readable, Writable } from "stream";
import { filterEnv, match, onceNode, type EventEnvelope } from "./emitter.js";

/* ========== event bus (duplex stream) ========== */
export class EventBus<T extends Record<string, any>> {
  /** single objectMode stream carrying EventEnvelope<T> */
  readonly bus: PassThrough;

  constructor() {
    this.bus = new PassThrough({ objectMode: true });
  }

  /* ---- emit ---- */

  /** fire-and-forget (returns boolean: backpressure signal) */
  emit<K extends keyof T>(
    type: K,
    payload: T[K],
    meta?: Record<string, any>
  ): boolean {
    const env: EventEnvelope<T, K> = { type, payload, ts: Date.now(), meta };
    return this.bus.write(env);
  }

  /** backpressure-aware emit (awaits 'drain' if needed) */
  async emitAsync<K extends keyof T>(
    type: K,
    payload: T[K],
    meta?: Record<string, any>
  ): Promise<void> {
    if (this.emit(type, payload, meta)) return;
    await onceNode(this.bus, "drain");
  }

  /* ---- listen ---- */

  /** subscribe by type string, regex, or predicate(env) */
  on(
    sel: keyof T | RegExp | ((e: EventEnvelope<T>) => boolean),
    handler: (e: EventEnvelope<T>) => void
  ): () => void {
    const f = (e: EventEnvelope<T>) => {
      if (match(sel, e)) handler(e);
    };
    this.bus.on("data", f);
    return () => this.bus.off("data", f);
  }

  /** once by selector; resolves first matching envelope (with optional timeout) */
  once(
    sel: keyof T | RegExp | ((e: EventEnvelope<T>) => boolean),
    opts: { timeoutMs?: number } = {}
  ): Promise<EventEnvelope<T>> {
    const { timeoutMs } = opts;
    return new Promise<EventEnvelope<T>>((resolve, reject) => {
      const off = this.on(sel, (e) => {
        off();
        if (t) clearTimeout(t);
        resolve(e);
      });
      let t: NodeJS.Timeout | null = null;
      if (timeoutMs != null)
        t = setTimeout(() => {
          off();
          reject(new Error("once timeout"));
        }, timeoutMs);
    });
  }

  /** waitUntil: predicate on envelope; resolves payload typed as union of T[keyof T] */
  waitUntil<P = any>(
    pred: (e: EventEnvelope<T>) => e is EventEnvelope<T, any>,
    timeoutMs?: number
  ): Promise<EventEnvelope<T>> {
    return this.once(pred as any, { timeoutMs });
  }

  /* ---- async iterate ---- */

  /** full stream as async iterator of envelopes */
  [Symbol.asyncIterator](): AsyncIterator<EventEnvelope<T>> {
    const r = this.bus[Symbol.asyncIterator]() as AsyncIterator<any>;
    return {
      next: () => r.next(),
      return: () =>
        r.return
          ? r.return()
          : Promise.resolve({ value: undefined, done: true }),
      throw: (e) => (r.throw ? r.throw(e) : Promise.reject(e)),
    };
  }

  /** iterate only given topic; yields payloads */
  async *iterate<K extends keyof T>(type: K): AsyncGenerator<T[K]> {
    for await (const e of this as any as AsyncIterable<EventEnvelope<T>>) {
      if (e.type === type) yield e.payload as any;
    }
  }

  /* ---- topic views (split/join) ---- */

  /**
   * readable of payloads for a topic (backed by a Transform filter).
   * close the returned stream when done.
   */
  topicReadable<K extends keyof T>(type: K): Readable {
    const filt = filterEnv<T>((e) => e.type === type, true /* payloadOnly */);
    this.bus.pipe(filt);
    return filt as unknown as Readable;
  }

  /**
   * writable that wraps payloads into {type,payload} for a topic.
   * respects backpressure and 'drain'.
   */
  topicWritable<K extends keyof T>(type: K): Writable {
    const t = new Transform({
      objectMode: true,
      transform: (payload: any, _enc, cb) => {
        const ok = this.emit(type, payload);
        if (ok) cb();
        else this.bus.once("drain", cb);
      },
    });
    return t;
  }

  /** pipe another bus into this one (all envelopes) */
  linkFrom(src: EventBus<T>): void {
    src.bus.pipe(this.bus, { end: false });
  }

  /** close underlying stream */
  end(): void {
    this.bus.end();
  }
}
