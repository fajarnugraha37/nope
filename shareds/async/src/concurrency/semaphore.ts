type Request = { need: number; resolve: (release: () => void) => void };

export class Semaphore {
  private queue: Request[] = [];
  private permits: number;

  constructor(max: number) {
    if (max <= 0) throw new Error("semaphore max must be > 0");
    this.permits = max;
  }

  async acquire(n = 1): Promise<() => void> {
    if (n <= 0) throw new Error("acquire n must be > 0");
    return new Promise<() => void>((resolve) => {
      if (this.queue.length === 0 && this.permits >= n) {
        this.permits -= n;
        resolve(this.makeRelease(n));
      } else {
        this.queue.push({ need: n, resolve });
        this.processQueue();
      }
    });
  }

  release(n = 1) {
    if (n <= 0) throw new Error("release n must be > 0");
    this.permits += n;
    this.processQueue();
  }

  private makeRelease(n: number): () => void {
    let done = false;
    return () => {
      if (done) return;
      done = true;
      this.release(n);
    };
  }

  private processQueue() {
    while (this.queue.length > 0 && this.permits >= this.queue[0]!.need) {
      const waiter = this.queue.shift()!;
      this.permits -= waiter.need;
      waiter.resolve(this.makeRelease(waiter.need));
    }
  }

  async withPermit<T>(f: () => Promise<T> | T, n = 1): Promise<T> {
    const release = await this.acquire(n);
    try {
      return await f();
    } finally {
      release();
    }
  }
}

export class FairSemaphore {
  private permits: number;
  private queue: Request[] = [];

  constructor(max: number) {
    if (max <= 0) throw new Error("max must be > 0");
    this.permits = max;
  }

  async acquire(n = 1): Promise<() => void> {
    if (n <= 0) throw new Error("n must be > 0");
    return new Promise<() => void>(resolve => {
      const req: Request = {
        need: n,
        resolve: (release) => resolve(release),
      };
      this.queue.push(req);
      this.process(); // try grant immediately
    });
  }

  private process() {
    // only grant from the head, preserving request order (FIFO)
    while (this.queue.length > 0) {
      const head = this.queue[0];
      if (head && this.permits >= head.need) {
        this.permits -= head.need;
        this.queue.shift();
        const release = () => {
          if ((release as any).__done) return;
          (release as any).__done = true;
          this.permits += head.need;
          this.process();
        };
        head.resolve(release);
        // loop to see if the next request can be granted too
      } else {
        break; // not enough permits for head; wait.
      }
    }
  }

  async withPermit<T>(f: () => Promise<T> | T, n = 1): Promise<T> {
    const release = await this.acquire(n);
    try { return await f(); }
    finally { release(); }
  }

  available() { return this.permits; }
  pending() { return this.queue.length; }
}
