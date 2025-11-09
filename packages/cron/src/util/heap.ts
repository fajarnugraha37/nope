export type CompareFn<T> = (a: T, b: T) => number;

export class BinaryHeap<T> {
  private readonly data: T[] = [];
  private readonly compare: CompareFn<T>;

  constructor(compare: CompareFn<T>) {
    this.compare = compare;
  }

  push(value: T): void {
    this.data.push(value);
    this.bubbleUp(this.data.length - 1);
  }

  peek(): T | undefined {
    return this.data[0];
  }

  pop(): T | undefined {
    if (this.data.length === 0) {
      return undefined;
    }

    const top = this.data[0];
    const end = this.data.pop();
    if (this.data.length > 0 && end !== undefined) {
      this.data[0] = end;
      this.bubbleDown(0);
    }
    return top;
  }

  remove(predicate: (value: T) => boolean): void {
    for (let i = this.data.length - 1; i >= 0; i -= 1) {
      if (predicate(this.data[i]!)) {
        const end = this.data.pop();
        if (i < this.data.length && end !== undefined) {
          this.data[i] = end;
          this.bubbleDown(i);
          this.bubbleUp(i);
        }
      }
    }
  }

  get size(): number {
    return this.data.length;
  }

  private bubbleUp(index: number) {
    let i = index;
    const item = this.data[i];
    while (i > 0) {
      const parentIdx = Math.floor((i - 1) / 2);
      const parent = this.data[parentIdx];
      if (this.compare(item!, parent!) >= 0) {
        break;
      }
      this.data[parentIdx] = item!;
      this.data[i] = parent!;
      i = parentIdx;
    }
  }

  private bubbleDown(index: number) {
    let i = index;
    const length = this.data.length;
    const item = this.data[i];

    while (true) {
      const leftIdx = 2 * i + 1;
      const rightIdx = 2 * i + 2;
      let swapIdx = -1;

      if (leftIdx < length) {
        const left = this.data[leftIdx];
        if (this.compare(left!, item!) < 0) {
          swapIdx = leftIdx;
        }
      }

      if (rightIdx < length) {
        const right = this.data[rightIdx];
        if (
          (swapIdx === -1 && this.compare(right!, item!) < 0) ||
          (swapIdx !== -1 && this.compare(right!, this.data[swapIdx]!) < 0)
        ) {
          swapIdx = rightIdx;
        }
      }

      if (swapIdx === -1) {
        return;
      }

      this.data[i] = this.data[swapIdx]!;
      this.data[swapIdx] = item!;
      i = swapIdx;
    }
  }
}
