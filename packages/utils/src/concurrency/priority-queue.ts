/* =========================
   bounded priority queue
   ========================= */

type Cmp<T> = (a: T, b: T) => number; // <0 if a<b (min-heap)

export class PriorityQueue<T> {
  private a: T[] = [];
  constructor(
    private cmp: Cmp<T>,
    private capacity?: number, // optional bound
    private onDrop?: (dropped: T) => void // called when evicting on overflow
  ) {}

  size() {
    return this.a.length;
  }
  isEmpty() {
    return this.a.length === 0;
  }
  peek(): T | undefined {
    return this.a[0];
  }

  push(x: T) {
    if (this.capacity != null && this.a.length >= this.capacity) {
      // if full: compare against the *worst* element.
      // for a min-heap, worst is the max; we need to know it.
      const worstIdx = this.maxIndex();
      if (worstIdx === -1) return;
      // if new item is "better" than worst, evict worst; else drop new
      if (this.cmp(x, this.a[worstIdx]!) < 0) {
        const dropped = this.a[worstIdx]!;
        this.a[worstIdx] = x;
        this.heapifyDown(worstIdx);
        this.onDrop?.(dropped);
        return;
      } else {
        this.onDrop?.(x);
        return;
      }
    }
    this.a.push(x);
    this.heapifyUp(this.a.length - 1);
  }

  pop(): T | undefined {
    const n = this.a.length;
    if (n === 0) return undefined;
    const top = this.a[0];
    const last = this.a.pop()!;
    if (n > 1) {
      this.a[0] = last;
      this.heapifyDown(0);
    }
    return top;
  }

  private parent(i: number) {
    return (i - 1) >> 1;
  }
  private left(i: number) {
    return (i << 1) + 1;
  }
  private right(i: number) {
    return (i << 1) + 2;
  }

  private heapifyUp(i: number) {
    while (i > 0) {
      const p = this.parent(i);
      if (this.cmp(this.a[i]!, this.a[p]!) < 0) {
        [this.a[i], this.a[p]] = [this.a[p]!, this.a[i]!];
        i = p;
      } else break;
    }
  }

  private heapifyDown(i: number) {
    for (;;) {
      const l = this.left(i),
        r = this.right(i);
      let s = i;
      if (l < this.a.length && this.cmp(this.a[l]!, this.a[s]!) < 0) s = l;
      if (r < this.a.length && this.cmp(this.a[r]!, this.a[s]!) < 0) s = r;
      if (s === i) break;
      [this.a[i], this.a[s]] = [this.a[s]!, this.a[i]!];
      i = s;
    }
  }

  /** find index of max element (worst for min-heap); O(n) but only used on overflow */
  private maxIndex(): number {
    if (this.a.length === 0) return -1;
    let idx = 0;
    for (let i = 1; i < this.a.length; i++) {
      if (this.cmp(this.a[idx]!, this.a[i]!) < 0) idx = i;
    }
    return idx;
  }
}

// usage: new PriorityQueue<{p:number,...}>((a,b)=>a.p-b.p, 1000, dropped=>...)
