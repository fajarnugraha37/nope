const TTL_MS = 10 * 60 * 1000;

interface Entry<T> {
  value: T;
  expiresAt: number;
}

export class IdempotencyCache<T> {
  constructor(
    private readonly ttl: number = TTL_MS,
    private readonly store: Map<string, Entry<T>> = new Map<string, Entry<T>>()
  ) {}

  async execute(
    key: string | undefined,
    compute: () => Promise<T>
  ): Promise<T> {
    if (!key) {
      return compute();
    }
    const existing = this.pruneAndGet(key);
    if (existing) {
      return existing.value;
    }
    const value = await compute();
    this.store.set(key, { value, expiresAt: Date.now() + this.ttl });
    return value;
  }

  private pruneAndGet(key: string): Entry<T> | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }
}
