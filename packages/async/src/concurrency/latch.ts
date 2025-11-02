export class CountdownLatch {
  private count: number;
  private resolvers: Array<() => void> = [];

  constructor(initial: number) {
    if (initial < 0) throw new Error("initial must be >= 0");
    this.count = initial;
  }

  add(n = 1) {
    this.count += n;
  }

  countDown(n = 1) {
    this.count = Math.max(0, this.count - n);
    if (this.count === 0) {
      const rs = this.resolvers;
      this.resolvers = [];
      for (const r of rs) r();
    }
  }

  wait(): Promise<void> {
    if (this.count === 0) return Promise.resolve();
    return new Promise<void>((resolve) => this.resolvers.push(resolve));
  }
}