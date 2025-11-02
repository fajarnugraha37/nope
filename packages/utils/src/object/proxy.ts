type Path = (string | number | symbol)[];

const isObj = (x: any) =>
  x !== null && (typeof x === "object" || typeof x === "function");

/* ========== 1) observable proxy (onGet/onSet/onDelete) ========== */
export function observeProxy<T extends object>(
  target: T,
  hooks: {
    onGet?: (path: Path, value: any, receiver: any) => void;
    onSet?: (path: Path, value: any, oldValue: any) => void;
    onDelete?: (path: Path, existed: boolean) => void;
  },
  opts: { deep?: boolean } = {}
): T {
  const mk = (obj: any, base: Path = []): any =>
    new Proxy(obj, {
      get(t, k, r) {
        const v = Reflect.get(t, k, r);
        hooks.onGet?.([...base, k], v, r);
        return opts.deep && isObj(v) ? mk(v, [...base, k]) : v;
      },
      set(t, k, v, r) {
        const old = (t as any)[k];
        const ok = Reflect.set(t, k, v, r);
        if (ok) hooks.onSet?.([...base, k], v, old);
        return ok;
      },
      deleteProperty(t, k) {
        const existed = Object.prototype.hasOwnProperty.call(t, k);
        const ok = Reflect.deleteProperty(t, k);
        if (ok) hooks.onDelete?.([...base, k], existed);
        return ok;
      },
    });
  return mk(target);
}

/* ========== 2) deep readonly (throws on write) ========== */
export function readonlyProxy<T extends object>(target: T): T {
  const mk = (obj: any): any =>
    new Proxy(obj, {
      set() {
        throw new TypeError("readonly");
      },
      deleteProperty() {
        throw new TypeError("readonly");
      },
      defineProperty() {
        throw new TypeError("readonly");
      },
      setPrototypeOf() {
        throw new TypeError("readonly");
      },
      get(t, k, r) {
        const v = Reflect.get(t, k, r);
        return isObj(v) ? mk(v) : v;
      },
    });
  return mk(target);
}

/* ========== 3) defaults proxy (missing keys resolve to defaults) ========== */
export function defaultsProxy<T extends object, D extends Partial<T>>(
  obj: T,
  defaults: D
): T & D {
  return new Proxy(obj as any, {
    get(t, k, r) {
      if (k in t) return Reflect.get(t, k, r);
      return (defaults as any)[k];
    },
    has(t, k) {
      return k in t || k in (defaults as any);
    },
    ownKeys(t) {
      const set = new Set([
        ...Reflect.ownKeys(t),
        ...Reflect.ownKeys(defaults as any),
      ]);
      return Array.from(set);
    },
    getOwnPropertyDescriptor(t, k) {
      return (
        Reflect.getOwnPropertyDescriptor(t, k) ??
        Reflect.getOwnPropertyDescriptor(defaults as any, k as any) ??
        undefined
      );
    },
  });
}

/* ========== 4) validator proxy (sync function) ========== */
export function validateProxy<T extends object>(
  obj: T,
  validate: (path: Path, value: any) => true | string
): T {
  const mk = (o: any, base: Path = []): any =>
    new Proxy(o, {
      set(t, k, v, r) {
        const res = validate([...base, k], v);
        if (res !== true) throw new TypeError(`invalid ${String(k)}: ${res}`);
        return Reflect.set(t, k, v, r);
      },
      get(t, k, r) {
        const v = Reflect.get(t, k, r);
        return isObj(v) ? mk(v, [...base, k]) : v;
      },
    });
  return mk(obj);
}

/* ========== 5) lazy + memo fields (compute on first access) ========== */
export function lazyProxy<T extends object>(
  obj: T,
  resolvers: Partial<Record<keyof T, () => any>>,
  memo = true
): T {
  return new Proxy(obj as any, {
    get(t, k, r) {
      if (k in t) return Reflect.get(t, k, r);
      if (k in resolvers) {
        const val = (resolvers as any)[k]!();
        if (memo) Reflect.set(t, k, val, r);
        return val;
      }
      return undefined;
    },
  });
}

/* ========== 6) virtual record (backed by get/set callbacks) ========== */
export function virtualRecord<T extends object = Record<string, unknown>>(
  get: (key: PropertyKey) => any,
  set?: (key: PropertyKey, val: any) => boolean,
  keys?: () => PropertyKey[]
): T {
  return new Proxy({} as any, {
    get(_t, k) {
      return get(k);
    },
    set(_t, k, v) {
      if (!set) throw new TypeError("readonly virtual");
      return !!set(k, v);
    },
    has(_t, k) {
      return get(k) !== undefined;
    },
    // ownKeys() { return keys ? keys() : []; },
    ownKeys() {
      return keys ? (keys() as string[]) : [];
    },
    getOwnPropertyDescriptor(_t, k) {
      const v = get(k);
      if (v === undefined) return undefined;
      return {
        configurable: true,
        enumerable: true,
        writable: !!set,
        value: v,
      };
    },
  });
}

/* ========== 7) multi-source (read chain, write-first) ========== */
export function chainProxy<T extends object>(...sources: T[]): T {
  if (sources.length === 0) return {} as T;
  const head = sources[0] as any;
  return new Proxy(head, {
    get(_t, k, r) {
      for (const s of sources as any[]) if (k in s) return Reflect.get(s, k, r);
      return undefined;
    },
    has(_t, k) {
      return sources.some((s) => k in (s as any));
    },
    ownKeys() {
      return Array.from(new Set(sources.flatMap((s) => Reflect.ownKeys(s))));
    },
    getOwnPropertyDescriptor(_t, k) {
      for (const s of sources as any[]) {
        const d = Reflect.getOwnPropertyDescriptor(s, k);
        if (d) return d;
      }
      return undefined;
    },
    set(t, k, v, r) {
      return Reflect.set(t, k, v, r);
    }, // writes go to first
    deleteProperty(t, k) {
      return Reflect.deleteProperty(t, k);
    },
  });
}

/* ========== 8) path tracker (logs all get/set paths) ========== */
const resolvedPromise: Promise<void> = Promise.resolve();
const defer =
  typeof queueMicrotask === "function"
    ? queueMicrotask
    : (fn: () => void) => {
        void resolvedPromise.then(fn);
      };

type PendingGet = { consume: (emit: boolean) => void };

export function trackPaths<T extends object>(
  obj: T,
  sink: (rec: { op: "get" | "set" | "del"; path: Path; value?: any }) => void
): T {
  const createPending = (path: Path, value: any): PendingGet => {
    let consumed = false;
    const consume = (emit: boolean) => {
      if (consumed) return;
      consumed = true;
      if (emit) sink({ op: "get", path, value });
    };
    defer(() => consume(true));
    return { consume };
  };

  const mk = (o: any, base: Path = [], pending?: PendingGet): any => {
    let parent = pending;
    const settleParent = (emit: boolean) => {
      if (!parent) return;
      parent.consume(emit);
      parent = undefined;
    };
    return new Proxy(o, {
      get(t, k, r) {
        settleParent(true);
        const path = [...base, k];
        const value = Reflect.get(t, k, r);
        if (isObj(value)) {
          const nextPending = createPending(path, value);
          return mk(value, path, nextPending);
        }
        sink({ op: "get", path, value });
        return value;
      },
      set(t, k, v, r) {
        settleParent(false);
        const path = [...base, k];
        sink({ op: "set", path, value: v });
        return Reflect.set(t, k, v, r);
      },
      deleteProperty(t, k) {
        settleParent(false);
        const path = [...base, k];
        sink({ op: "del", path });
        return Reflect.deleteProperty(t, k);
      },
      has(t, k) {
        settleParent(true);
        return Reflect.has(t, k);
      },
      ownKeys(t) {
        settleParent(true);
        return Reflect.ownKeys(t);
      },
      getOwnPropertyDescriptor(t, k) {
        settleParent(true);
        return Reflect.getOwnPropertyDescriptor(t, k);
      },
    });
  };

  return mk(obj);
}

/* ========== 9) revocable helper with typed unwrap ========== */
export function makeRevocable<T extends object>(obj: T) {
  const { proxy, revoke } = Proxy.revocable(obj, {});
  return { proxy: proxy as T, revoke };
}
