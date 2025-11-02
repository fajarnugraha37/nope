export class Mutex {
  private q: Array<() => void> = [];
  private locked = false;

  async acquire(): Promise<() => void> {
    return new Promise<() => void>((resolve) => {
      const release = () => {
        if (this.q.length) this.q.shift()!();
        else this.locked = false;
      };
      if (!this.locked) {
        this.locked = true;
        resolve(release);
      } else {
        this.q.push(() => resolve(release));
      }
    });
  }

  async runExclusive<T>(f: () => Promise<T> | T): Promise<T> {
    const release = await this.acquire();
    try {
      return await f();
    } finally {
      release();
    }
  }
}
