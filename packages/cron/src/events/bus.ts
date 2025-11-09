import type { SchedulerEventMap, SchedulerEventName, SchedulerListener } from "../api.js";

type GenericListener = (payload: SchedulerEventMap[SchedulerEventName]) => void;
type ListenerMap = Map<SchedulerEventName, Set<GenericListener>>;

export class EventBus {
  private readonly listeners: ListenerMap = new Map();

  on<T extends SchedulerEventName>(event: T, listener: SchedulerListener<T>): () => void {
    const bucket = this.listeners.get(event) ?? new Set<GenericListener>();
    bucket.add(listener as unknown as GenericListener);
    this.listeners.set(event, bucket);
    return () => this.off(event, listener);
  }

  once<T extends SchedulerEventName>(event: T, listener: SchedulerListener<T>): () => void {
    const wrapped: SchedulerListener<T> = (payload) => {
      this.off(event, wrapped);
      listener(payload);
    };
    return this.on(event, wrapped);
  }

  off<T extends SchedulerEventName>(event: T, listener: SchedulerListener<T>): void {
    const bucket = this.listeners.get(event);
    if (!bucket) {
      return;
    }
    bucket.delete(listener as unknown as GenericListener);
    if (bucket.size === 0) {
      this.listeners.delete(event);
    }
  }

  emit<T extends SchedulerEventName>(event: T, payload: SchedulerEventMap[T]): void {
    const bucket = this.listeners.get(event);
    if (!bucket) {
      return;
    }
    for (const listener of bucket) {
      listener(payload as SchedulerEventMap[SchedulerEventName]);
    }
  }

  removeAllListeners(event?: SchedulerEventName): void {
    if (event) {
      this.listeners.delete(event);
      return;
    }
    this.listeners.clear();
  }
}
