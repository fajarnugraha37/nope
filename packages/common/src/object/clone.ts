export function shallowClone<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  if (Array.isArray(obj)) {
    return [...obj] as T;
  }
  return { ...obj } as T;
}

export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T;
  }
  if (obj instanceof RegExp) {
    return new RegExp(obj) as T;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item)) as T;
  }
  const cloned = {} as T;
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
}

export function structuredClone<T>(obj: T): T {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(obj);
  }
  return deepClone(obj);
}

export function merge<T extends Record<string, any>>(
  target: T,
  ...sources: Partial<T>[]
): T {
  const result = { ...target };
  for (const source of sources) {
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        const sourceValue = source[key];
        if (sourceValue !== undefined) {
          if (
            typeof sourceValue === "object" &&
            sourceValue !== null &&
            !Array.isArray(sourceValue) &&
            typeof result[key] === "object" &&
            result[key] !== null &&
            !Array.isArray(result[key])
          ) {
            result[key] = merge(result[key] as any, sourceValue);
          } else {
            result[key] = sourceValue as any;
          }
        }
      }
    }
  }
  return result;
}

/* ---------- freeze/clone/equal ---------- */
export function freezeDeep<T>(x: T): T {
  if (x && typeof x === "object") {
    Object.freeze(x);
    for (const v of Object.values(x as any)) freezeDeep(v as any);
  }
  return x;
}

export function cloneShallow<T extends object>(o: T): T {
  return Array.isArray(o) ? (o.slice() as any) : ({ ...o } as any);
}

export function isShallowEqual<T extends object>(a: T, b: T): boolean {
  if (a === b) return true;
  const ka = Object.keys(a as any),
    kb = Object.keys(b as any);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if ((a as any)[k] !== (b as any)[k]) return false;
  return true;
}

/* ---------- stable stringify (sorted keys) ---------- */
export function stableStringify(x: any): string {
  const seen = new WeakSet<object>();
  const ser = (v: any): any => {
    if (v && typeof v === "object") {
      if (seen.has(v)) return "[Circular]";
      seen.add(v);
      if (Array.isArray(v)) return v.map(ser);
      const o: any = {};
      for (const k of Object.keys(v).sort()) o[k] = ser(v[k]);
      return o;
    }
    return v;
  };
  return JSON.stringify(ser(x));
}
