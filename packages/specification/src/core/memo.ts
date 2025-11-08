import { defaultHasher } from "../utils/hash.js";
import type { ValueHasher } from "./types.js";

interface CacheEntry {
  hash: string;
  verdict: boolean;
}

export class SpecMemoizer<TValue> {
  private entry?: CacheEntry;

  constructor(private readonly hasher: ValueHasher<TValue> = defaultHasher) {}

  get(value: TValue): boolean | undefined {
    if (!this.entry) return undefined;
    const hash = this.hasher(value);
    return hash === this.entry.hash ? this.entry.verdict : undefined;
  }

  set(value: TValue, verdict: boolean): void {
    this.entry = { hash: this.hasher(value), verdict };
  }
}
