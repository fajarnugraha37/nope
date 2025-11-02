import { Transform } from "stream";

export type EventEnvelope<
  T extends Record<string, any>,
  K extends keyof T = keyof T
> = {
  type: K;
  payload: T[K];
  ts?: number; // optional timestamp
  meta?: Record<string, any>;
};

export type EventType = string | symbol;

// An event handler can take an optional event argument
// and should not return a value
export type Handler<T = unknown> = (event: T) => void;
export type WildcardHandler<T = Record<string, unknown>> = (
  type: keyof T,
  event: T[keyof T]
) => void;

// An array of all currently registered event handlers for a type
export type EventHandlerList<T = unknown> = Array<Handler<T>>;
export type WildCardEventHandlerList<T = Record<string, unknown>> = Array<
  WildcardHandler<T>
>;

// A map of event types and their corresponding event handlers.
export type EventHandlerMap<Events extends Record<EventType, unknown>> = Map<
  keyof Events | "*",
  EventHandlerList<Events[keyof Events]> | WildCardEventHandlerList<Events>
>;

export interface Emitter<Events extends Record<EventType, unknown>> {
  all: EventHandlerMap<Events>;

  on<Key extends keyof Events>(type: Key, handler: Handler<Events[Key]>): void;
  on(type: "*", handler: WildcardHandler<Events>): void;

  off<Key extends keyof Events>(
    type: Key,
    handler?: Handler<Events[Key]>
  ): void;
  off(type: "*", handler: WildcardHandler<Events>): void;

  emit<Key extends keyof Events>(type: Key, event: Events[Key]): void;
  emit<Key extends keyof Events>(
    type: undefined extends Events[Key] ? Key : never
  ): void;
}

export function match<T extends Record<string, any>>(
  sel: keyof T | RegExp | ((e: EventEnvelope<T>) => boolean),
  e: EventEnvelope<T>
): boolean {
  if (typeof sel === "function") return !!sel(e);
  if (sel instanceof RegExp) return sel.test(String(e.type));
  return e.type === sel;
}

export function filterEnv<T extends Record<string, any>>(
  pred: (e: EventEnvelope<T>) => boolean,
  payloadOnly = false
): Transform {
  return new Transform({
    objectMode: true,
    transform(chunk: any, _enc, cb) {
      try {
        if (pred(chunk)) cb(null, payloadOnly ? chunk.payload : chunk);
        else cb();
      } catch (e) {
        cb(e as any);
      }
    },
  });
}

export function onceNode(em: NodeJS.EventEmitter, ev: string): Promise<void> {
  return new Promise((res) => em.once(ev, () => res()));
}
