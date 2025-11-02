export class JobQueue {
  private q: Array<() => Promise<void>> = [];
  private active = 0;

  constructor(private readonly concurrency = 1) {}

  add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = async () => {
        try {
          const v = await task();
          resolve(v);
        } catch (e) {
          reject(e);
        } finally {
          this.active--;
          this.drain();
        }
      };
      this.q.push(run);
      this.drain();
    });
  }

  private drain() {
    while (this.active < this.concurrency && this.q.length) {
      const job = this.q.shift()!;
      this.active++;
      void job();
    }
  }

  size() {
    return this.q.length;
  }
  activeCount() {
    return this.active;
  }
}
