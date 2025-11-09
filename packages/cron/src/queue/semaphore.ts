export class Semaphore {
  private readonly queue: Array<() => void> = [];
  private current = 0;

  constructor(private readonly limit: number) {}

  async acquire(): Promise<void> {
    if (this.limit <= 0) {
      return;
    }
    if (this.current < this.limit) {
      this.current += 1;
      return;
    }

    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.current += 1;
  }

  release(): void {
    if (this.limit <= 0) {
      return;
    }
    this.current = Math.max(0, this.current - 1);
    const waiter = this.queue.shift();
    waiter?.();
  }
}
