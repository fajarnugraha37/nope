/* ---------- optional: async lock per key (fine-grained mutex) ---------- */
export class KeyedLock<K> {
  private waits = new Map<K, Array<() => void>>();
  private held = new Set<K>();

  async acquire(key: K): Promise<() => void> {
    return new Promise<() => void>((resolve) => {
      const tryAcquire = () => {
        if (!this.held.has(key)) {
          this.held.add(key);
          resolve(() => this.release(key));
        } else {
          const q = this.waits.get(key) ?? [];
          q.push(tryAcquire);
          this.waits.set(key, q);
        }
      };

      tryAcquire();
    });
  }

  private release(key: K) {
    const q = this.waits.get(key);
    this.held.delete(key);
    if (q && q.length) {
      q.shift()!();
    } 
  }
}
