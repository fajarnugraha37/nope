export interface Clock {
  readonly kind: "system" | "virtual";
  now(): Date;
  nowMs(): number;
  sleep(ms: number): Promise<void>;
}

export interface VirtualClock extends Clock {
  advance(ms: number): void;
  setTo(date: Date): void;
  readonly pendingTimers: number;
}

export type SleepHandle = {
  resolve: () => void;
  reject: (reason?: unknown) => void;
  at: number;
};

export const createSystemClock = (): Clock => {
  return {
    kind: "system",
    now: () => new Date(),
    nowMs: () => Date.now(),
    sleep: (ms) =>
      new Promise((resolve) => {
        const id = setTimeout(resolve, ms);
        if (typeof id === "object" && "unref" in id && typeof id.unref === "function") {
          id.unref();
        }
      }),
  };
};

export interface VirtualClockOptions {
  startAt?: Date;
}

export const createVirtualClock = (options: VirtualClockOptions = {}): VirtualClock => {
  const pending: SleepHandle[] = [];
  let currentMs = options.startAt?.getTime() ?? Date.now();

  const flush = () => {
    const ready = pending
      .sort((a, b) => a.at - b.at)
      .filter((entry) => entry.at <= currentMs);

    ready.forEach((entry) => entry.resolve());

    for (const entry of ready) {
      const idx = pending.indexOf(entry);
      if (idx >= 0) {
        pending.splice(idx, 1);
      }
    }
  };

  const clock: VirtualClock = {
    kind: "virtual",
    now: () => new Date(currentMs),
    nowMs: () => currentMs,
    sleep: (ms) =>
      new Promise((resolve) => {
        pending.push({ resolve, reject: () => undefined, at: currentMs + ms });
      }),
    advance: (ms) => {
      currentMs += ms;
      flush();
    },
    setTo: (date) => {
      currentMs = date.getTime();
      flush();
    },
    get pendingTimers() {
      return pending.length;
    },
  };

  return clock;
};
