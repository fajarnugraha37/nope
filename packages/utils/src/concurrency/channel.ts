export class Channel<T> implements AsyncIterable<T> {
  private buf: T[] = [];
  private takers: Array<(v: IteratorResult<T>) => void> = [];
  private putters: Array<{ v: T; resolve: () => void }> = [];
  private _closed = false;

  constructor(private capacity = 0) {}

  get closed() {
    return this._closed;
  }

  close() {
    if (this._closed) return;
    this._closed = true;
    // wake all takers with done=true
    for (const t of this.takers) t({ value: undefined as any, done: true });
    this.takers = [];
  }

  /** send value; waits if buffer full or unbuffered with no taker */
  async send(v: T): Promise<void> {
    if (this._closed) throw new Error("channel closed");
    // if a taker waiting, hand off immediately
    const t = this.takers.shift();
    if (t) {
      t({ value: v, done: false });
      return;
    }

    // buffer space?
    if (this.buf.length < this.capacity) {
      this.buf.push(v);
      return;
    }

    // wait
    await new Promise<void>((resolve) => this.putters.push({ v, resolve }));
  }

  private takeImmediate(): IteratorResult<T> | null {
    if (this.buf.length) {
      const value = this.buf.shift()!;
      const pending = this.putters.shift();
      if (pending) {
        if (this.takers.length)
          this.takers.shift()!({ value: pending.v, done: false });
        else this.buf.push(pending.v);
        pending.resolve();
      }
      return { value, done: false };
    }

    const pendingPutter = this.putters.shift();
    if (pendingPutter) {
      pendingPutter.resolve();
      return { value: pendingPutter.v, done: false };
    }

    if (this._closed)
      return { value: undefined as any, done: true };

    return null;
  }

  /** receive next value; resolves done=true when closed and drained */
  recv(): Promise<IteratorResult<T>> {
    const immediate = this.takeImmediate();
    if (immediate) return Promise.resolve(immediate);

    return new Promise<IteratorResult<T>>((resolve) =>
      this.takers.push(resolve)
    );
  }

  /** async iterator: for await (const x of ch) { ... } */
  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    while (true) {
      const it = await this.recv();
      if (it.done) return;
      yield it.value;
    }
  }
  private addTakerOnce(): {
    promise: Promise<IteratorResult<T>>;
    cancel: () => void;
  } {
    const immediate = this.takeImmediate();
    if (immediate) {
      let cancelled = false;
      return {
        promise: Promise.resolve(immediate),
        cancel: () => {
          cancelled = true;
        },
      };
    }

    let done = false;
    let resolver: ((v: IteratorResult<T>) => void) | null = null;
    let promiseResolve: ((value: IteratorResult<T>) => void) | null = null;

    const promise = new Promise<IteratorResult<T>>((resolve) => {
      promiseResolve = resolve;
    });

    const taker = (it: IteratorResult<T>) => {
      if (done) return;
      done = true;
      promiseResolve?.(it);
    };

    resolver = taker;
    this.takers.push(taker);

    const cancel = () => {
      if (done || !resolver) return;
      const idx = this.takers.indexOf(resolver);
      if (idx >= 0) this.takers.splice(idx, 1);
      done = true;
    };

    return { promise, cancel };
  }
}

/**
 * select over multiple channels.
 * resolves with the first ready channel result and cancels the others.
 * if timeoutMs provided and nothing arrives, returns { timedOut: true }.
 */
export async function select<T>(
  chans: Channel<T>[],
  timeoutMs?: number
): Promise<
  | { index: number; value: T; done: false; timedOut?: false }
  | { index: number; value?: undefined; done: true; timedOut?: false }
  | { index: -1; value?: undefined; done?: false; timedOut: true }
> {
  // fast path: check buffered items first
  for (let i = 0; i < chans.length; i++) {
    // peek via non-blocking trick: enqueue a select taker, immediately send a sentinel?
    // simpler: rely on regular select path; Channel ensures immediate handoff if buffered.
  }

  // register one-shot takers on all channels
  const regs = chans.map(
    (ch) => (ch as any).addTakerOnce() as ReturnType<Channel<T>["addTakerOnce"]>
  );

  const timeoutP =
    timeoutMs != null
      ? new Promise<{ tag: "timeout" }>((r) =>
          setTimeout(() => r({ tag: "timeout" }), timeoutMs)
        )
      : null;

  type Tagged =
    | { tag: "ch"; idx: number; it: IteratorResult<T> }
    | { tag: "timeout" };

  const raceP = Promise.race<Tagged>([
    ...regs.map((r, idx) =>
      r.promise.then((it) => ({ tag: "ch", idx, it } as Tagged))
    ),
    ...(timeoutP ? [timeoutP as Promise<Tagged>] : []),
  ]);

  const winner = await raceP;

  // cancel others
  regs.forEach((r, i) => {
    if (winner.tag !== "ch" || i !== winner.idx) r.cancel();
  });

  if (winner.tag === "timeout") {
    return { index: -1, timedOut: true };
  }

  const { idx, it } = winner;
  if (it.done) return { index: idx, done: true };
  return { index: idx, value: it.value, done: false };
}
