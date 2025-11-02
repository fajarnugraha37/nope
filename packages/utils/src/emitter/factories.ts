import { Transform, Readable, Writable } from "stream";
import { EventBus } from "./event-bus.js";
import { filterEnv } from "./emitter.js";

/** create typed bus */
export function createEventBus<T extends Record<string, any>>() {
  return new EventBus<T>();
}

/** create a demux map: topic -> readable(payloads) */
export function createTopicDemux<T extends Record<string, any>>(
  bus: EventBus<T>
) {
  return new Proxy({} as any, {
    get(_t, p: string) {
      return bus.topicReadable(p as keyof T);
    },
  }) as { [K in keyof T]: Readable }; // Readable of payloads
}

/** create a mux map: topic -> writable(payloads) */
export function createTopicMux<T extends Record<string, any>>(
  bus: EventBus<T>
) {
  return new Proxy({} as any, {
    get(_t, p: string) {
      return bus.topicWritable(p as keyof T);
    },
  }) as { [K in keyof T]: Writable }; // Writable expecting payloads
}

/** pipe only specific topics from src → dst */
export function pipeTopics<T extends Record<string, any>>(
  src: EventBus<T>,
  dst: EventBus<T>,
  topics: (keyof T)[]
) {
  const set = new Set<keyof T>(topics);
  const t = filterEnv<T>((e) => set.has(e.type));
  src.bus.pipe(t).pipe(dst.bus, { end: false });
  return t; // caller can unpipe/destroy this transform to stop
}

/** simple logger transform */
export function tapLog<T extends Record<string, any>>(
  label = "evt",
  pluckPayload = false
): Transform {
  return new Transform({
    objectMode: true,
    transform(chunk: any, _enc, cb) {
      // eslint-disable-next-line no-console
      console.log(`[${label}]`, pluckPayload ? chunk.payload : chunk);
      cb(null, chunk);
    },
  });
}
