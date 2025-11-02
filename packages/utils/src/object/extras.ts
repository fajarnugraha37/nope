/* =========================================
   path utils (fix + helpers)
   ========================================= */

type PathKey = string | number | symbol;
export type Path = readonly PathKey[];

/** normalize "a.b[0].c" | ["a","b",0,"c"] → Path */
export function toPath(p: string | Path): Path {
  if (Array.isArray(p)) return p;
  // very small parser: splits ".", handles [idx]
  const out: PathKey[] = [];
  (p as string).split(".").forEach((seg) => {
    let s = seg;
    const re = /([^\[\]]+)|\[(\d+)\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) out.push(m[1] ?? Number(m[2]));
  });
  return out;
}

export function getIn<T, D = undefined>(obj: T, path: Path, def?: D): any | D {
  let cur: any = obj;
  const len = path.length;
  for (let i = 0; i < len; i++) {
    if (cur == null) return def as D;
    cur = cur[path[i] as any];
    if (cur === undefined && i < len - 1) return def as D;
  }
  return (cur === undefined ? def : cur) as any;
}

export function setIn<T extends object>(obj: T, path: Path, value: any): T {
  const len = path.length;
  if (len === 0) return value as T;
  const keys = path as readonly PathKey[];

  const build = (src: any, idx: number, created: boolean): any => {
    const key = keys[idx]!;
    const isLast = idx === len - 1;
    const hasObjectShape =
      src != null && (typeof src === "object" || typeof src === "function");
    const base = hasObjectShape
      ? src
      : typeof key === "number"
      ? []
      : {};
    const baseIsFresh = created || base !== src;
    const current = (base as any)[key as any];

    let child: any = undefined;
    let childCreated = false;
    if (!isLast) {
      if (
        current != null &&
        (typeof current === "object" || typeof current === "function")
      ) {
        child = current;
      } else {
        child = typeof keys[idx + 1] === "number" ? [] : {};
        childCreated = true;
      }
    }

    const nextVal = isLast ? value : build(child, idx + 1, childCreated);

    if (!baseIsFresh && nextVal === current) return src;

    if (baseIsFresh) {
      (base as any)[key as any] = nextVal;
      return base;
    }

    const clone = Array.isArray(base) ? base.slice() : { ...base };
    clone[key as any] = nextVal;
    return clone;
  };

  return build(obj, 0, false);
}

export function delIn<T extends object>(obj: T, path: Path): T {
  const len = path.length;
  if (len === 0) return obj;
  const keys = path as readonly PathKey[];

  const parents: any[] = new Array(len);
  let cur: any = obj;
  for (let i = 0; i < len; i++) {
    const key = keys[i]!;
    if (
      cur == null ||
      (typeof cur !== "object" && typeof cur !== "function") ||
      !(key in (cur as any))
    )
      return obj;
    parents[i] = cur;
    cur = (cur as any)[key as any];
  }

  let acc: any;
  for (let i = len - 1; i >= 0; i--) {
    const parent = parents[i];
    const key = keys[i]!;
    const clone = Array.isArray(parent)
      ? (parent as any).slice()
      : { ...(parent as any) };
    if (acc === undefined) {
      delete clone[key as any];
    } else {
      clone[key as any] = acc;
    }
    acc = clone;
  }

  return acc as T;
}

export { getIn as getInExtra, setIn as setInExtra, delIn as delInExtra };

/* =========================================
   deep pick / omit (by path(s))
   ========================================= */

export function deepPick<T extends object>(
  obj: T,
  paths: Array<string | Path>
): Partial<T> {
  let out: any = Array.isArray(obj) ? [] : {};
  for (const raw of paths) {
    const p = toPath(raw);
    const v = getIn(obj, p);
    if (v !== undefined) out = setIn(out, p, v);
  }
  return out;
}

export function deepOmit<T extends object>(
  obj: T,
  paths: Array<string | Path>
): T {
  let cur: any = obj;
  for (const raw of paths) cur = delIn(cur, toPath(raw));
  return cur;
}

/* =========================================
   deep diff / patch
   - arrays compared by value (shallow) → replace when changed
   - plain objects diffed recursively
   - result: { set: Record<string, unknown>, unset: string[] } with dot-paths
   ========================================= */

export type Diff = { set: Record<string, unknown>; unset: string[] };

export function deepDiff(a: unknown, b: unknown): Diff {
  const set: Record<string, unknown> = {};
  const unset: string[] = [];

  const isPlain = (x: any) =>
    x &&
    typeof x === "object" &&
    !Array.isArray(x) &&
    Object.getPrototypeOf(x) === Object.prototype;

  const eqShallowArr = (x: any[], y: any[]) =>
    x.length === y.length && x.every((v, i) => Object.is(v, y[i]));

  const walk = (pa: unknown, pb: unknown, base: string) => {
    if (Object.is(pa, pb)) return;

    // arrays: shallow compare, replace if changed
    if (Array.isArray(pa) && Array.isArray(pb)) {
      if (!eqShallowArr(pa, pb)) set[base] = pb;
      return;
    }

    // plain objects: recurse
    if (isPlain(pa) && isPlain(pb)) {
      const ka = Object.keys(pa as any);
      const kb = Object.keys(pb as any);
      const all = new Set([...ka, ...kb]);
      for (const k of all) {
        const p = base ? `${base}.${k}` : k;
        if (!(k in (pb as any))) {
          unset.push(p);
          continue;
        }
        if (!(k in (pa as any))) {
          set[p] = (pb as any)[k];
          continue;
        }
        walk((pa as any)[k], (pb as any)[k], p);
      }
      return;
    }

    // different types or non-plain/array → replace
    set[base] = pb;
  };

  // root cases
  if (isPlain(a) && isPlain(b)) {
    walk(a, b, "");
  } else if (!Object.is(a, b)) {
    set[""] = b;
  }

  // normalize: drop empty base key
  if ("" in set) {
    // full replace case: represent as setting root
    // consumer can special-case set[""] to replace whole object
  }

  return { set, unset };
}

export function applyDiff<T extends object>(obj: T, diff: Diff): T {
  let out: any = obj;
  // set
  for (const [dot, val] of Object.entries(diff.set)) {
    if (dot === "") {
      out = val;
      continue;
    }
    out = setIn(out, toPath(dot), val);
  }
  // unset
  for (const dot of diff.unset) out = delIn(out, toPath(dot));
  return out as T;
}

/* =========================================
   typed record helpers
   ========================================= */

/** typed record factory: keys → values via fn(k) */
export function makeRecord<K extends string | number | symbol, V>(
  keys: readonly K[],
  f: (k: K, i: number) => V
): Record<K, V> {
  const out = {} as Record<K, V>;
  keys.forEach((k, i) => ((out as any)[k] = f(k, i)));
  return out;
}

/** ensure object has EXACTLY these keys (type + runtime) */
export function assertExactKeys<K extends string>(
  obj: Record<string, unknown>,
  allowed: readonly K[]
): asserts obj is Record<K, unknown> {
  const ok = new Set(allowed as readonly string[]);
  for (const k of Object.keys(obj))
    if (!ok.has(k)) throw new Error(`unexpected key: ${k}`);
  for (const k of allowed)
    if (!(k in obj)) throw new Error(`missing key: ${k}`);
}

/** narrow to TypedRecord<K,V> at runtime */
export function isTypedRecord<K extends string, V>(
  obj: unknown,
  keys: readonly K[],
  valGuard?: (v: unknown) => v is V
): obj is Record<K, V> {
  if (!obj || typeof obj !== "object") return false;
  for (const k of keys) {
    if (!(k in (obj as any))) return false;
    if (valGuard && !valGuard((obj as any)[k])) return false;
  }
  return true;
}
