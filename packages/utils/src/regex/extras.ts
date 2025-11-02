/* ===========================================
   1) TIMEOUT-SAFE MATCHING (worker offload)
   =========================================== */

import { escapeRegex, makeRe, withFlag, withoutFlag } from "./common.js";

const getNodeRequire = (): ((moduleId: string) => any) | null => {
  const globalReq =
    typeof globalThis !== "undefined"
      ? ((globalThis as any).require as unknown)
      : undefined;
  if (typeof globalReq === "function") return globalReq as any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    if (typeof require === "function") return require;
  } catch {
    /* ignore */
  }
  return null;
};

/** result shape for timeout-safe ops */
export type TimedResult<T> =
  | { ok: true; value: T; timedOut: false }
  | { ok: false; error?: unknown; timedOut: true };

/**
 * run a pure-regex operation in an isolated worker with a hard timeout.
 * works in browser (Worker) and Node (worker_threads). falls back to same-thread if workers unavailable.
 * usage:
 * ```ts
 * const result = await runRegexWithTimeout<number>(`
 *   const re = new RegExp(${JSON.stringify(g.source)}, ${JSON.stringify(g.flags)});
 *   let n = 0; re.lastIndex = 0;
 *  while (re.exec(${JSON.stringify(str)})) n++;
 *  return n;
 * `, [], 500);
 * ```
 * @param fnBody function body as string (arguments are a0, a1, ...)
 * @param args arguments to pass to the function
 * @param timeoutMs timeout in milliseconds (default: 500ms)
 * @returns TimedResult<T>
 */
export async function runRegexWithTimeout<T>(
  fnBody: string,
  args: unknown[],
  timeoutMs = 500
): Promise<TimedResult<T>> {
  // try browser worker first
  if (typeof Worker !== "undefined" && typeof Blob !== "undefined") {
    const src = `
      self.onmessage = (e) => {
        const [fnBody, args] = e.data;
        try {
          const f = new Function(...Array.from({length: args.length}, (_,i)=>"a"+i), fnBody);
          const out = f(...args);
          self.postMessage({ ok: true, value: out });
        } catch (err) {
          self.postMessage({ ok: false, error: String(err) });
        }
      };
    `;
    const blob = new Blob([src], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    const w = new Worker(url);

    return new Promise<TimedResult<T>>((resolve) => {
      const to = setTimeout(() => {
        try {
          w.terminate();
        } catch {}
        resolve({ ok: false, timedOut: true });
      }, timeoutMs);

      w.onmessage = (e: MessageEvent) => {
        clearTimeout(to);
        try {
          w.terminate();
        } catch {}
        const msg = e.data;
        if (msg.ok)
          resolve({ ok: true, value: msg.value as T, timedOut: false });
        else resolve({ ok: false, timedOut: true, error: msg.error });
      };
      w.postMessage([fnBody, args]);
    });
  }

  // try node worker_threads
  const nodeRequire = getNodeRequire();
  if (nodeRequire) {
    try {
      const { Worker: NodeWorker } =
        nodeRequire("worker_threads") as typeof import("worker_threads");
      const src = `
      const { parentPort } = require('worker_threads');
      parentPort.on('message', ({ fnBody, args }) => {
        try {
          const f = new Function(...Array.from({length: args.length}, (_,i)=>"a"+i), fnBody);
          const out = f(...args);
          parentPort.postMessage({ ok: true, value: out });
        } catch (err) {
          parentPort.postMessage({ ok: false, error: String(err) });
        }
      });
    `;
      const w = new NodeWorker(src, { eval: true });

      return new Promise<TimedResult<T>>((resolve) => {
        const to = setTimeout(() => {
          try {
            w.terminate();
          } catch {}
          resolve({ ok: false, timedOut: true });
        }, timeoutMs);

        w.on("message", (msg: any) => {
          clearTimeout(to);
          try {
            w.terminate();
          } catch {}
          if (msg.ok)
            resolve({ ok: true, value: msg.value as T, timedOut: false });
          else resolve({ ok: false, timedOut: true, error: msg.error });
        });

        w.postMessage({ fnBody, args });
      });
    } catch {
      /* ignore and fall through to single-thread fallback */
    }
  }

  // last resort: same-thread (no hard kill). you still get a timer verdict.
  return new Promise<TimedResult<T>>((resolve) => {
    let done = false;
    const to = setTimeout(() => {
      if (!done) resolve({ ok: false, timedOut: true });
    }, timeoutMs);
    try {
      // eslint-disable-next-line no-new-func
      const f = new Function(...args.map((_, i) => `a${i}`), fnBody) as (
        ...xs: unknown[]
      ) => T;
      const value = f(...args);
      done = true;
      clearTimeout(to);
      resolve({ ok: true, value, timedOut: false });
    } catch (error) {
      done = true;
      clearTimeout(to);
      resolve({ ok: false, timedOut: true, error });
    }
  });
}

/**
 * Count the number of matches for a regex in a string, with a timeout.
 * usage:
 * ```ts
 * const count = await timedCount("Hello, world!", /o/g);
 * ```
 * @param str The string to search.
 * @param re The regex to use.
 * @param ms The timeout in milliseconds (default: 500ms).
 * @returns The number of matches found.
 */
export function timedCount(str: string, re: RegExp, ms = 500) {
  const g = withFlag(re, "g");
  const body = `
    const re = new RegExp(${JSON.stringify(g.source)}, ${JSON.stringify(
    g.flags
  )});
    let n = 0; re.lastIndex = 0;
    while (re.exec(${JSON.stringify(str)})) n++;
    return n;
  `;
  return runRegexWithTimeout<number>(body, [], ms);
}

/* ===========================================
   2) INDICES HELPERS (uses /d when available)
   =========================================== */

export type Indices = {
  span: [number, number];
  groups?: Record<string, [number, number] | undefined>;
};

/**
 * feature detect /d (hasIndices).
 * Some engines throw on unsupported flags, so we wrap in try/catch.
 * @returns boolean
 */
export const hasIndicesFlag = (() => {
  try {
    // some engines throw on unsupported flags
    // @ts-ignore
    return new RegExp(".", "d").hasIndices === true;
  } catch {
    return false;
  }
})();

/**
 * exec once w/indices (needs /d; graceful fallback to span only)
 * usage:
 * ```ts
 * const result = execWithIndices("Hello, world!", /o/g);
 * ```
 * @param str The string to search.
 * @param re The regex to use.
 * @returns The match result with indices or null.
 */
export function execWithIndices(
  str: string,
  re: RegExp
): (RegExpExecArray & { indices?: Indices }) | null {
  // ensure single-exec (no 'g')
  const one = new RegExp(
    re.source,
    withoutFlag(re, "g").flags +
      (hasIndicesFlag && !re.flags.includes("d") ? "d" : "")
  );
  const m = one.exec(str);
  if (!m) return null;

  if (hasIndicesFlag && (one as any).hasIndices && (m as any).indices) {
    const idx = (m as any).indices as {
      [k: number]: [number, number];
      groups?: Record<string, [number, number]>;
    };
    const indices: Indices = {
      span: idx[0]!,
      groups: idx.groups ?? undefined,
    };
    (m as any).indices = indices;
    return m as any;
  }
  // fallback (no capture indices available)
  const start = m.index ?? -1;
  const end = start + m[0].length;
  (m as any).indices = { span: [start, end] };
  return m as any;
}

/**
 * matchAll with indices (adds 'g', uses /d if available)
 * usage:
 * ```ts
 * const results = matchAllWithIndices("aabbcc", /b/);
 * ```
 * @param str
 * @param re
 * @returns
 */
export function matchAllWithIndices(str: string, re: RegExp) {
  const flags =
    withFlag(re, "g").flags +
    (hasIndicesFlag && !re.flags.includes("d") ? "d" : "");
  const g = new RegExp(re.source, flags);
  g.lastIndex = 0;
  const out: Array<{
    match: string;
    span: [number, number];
    captures: string[];
    groupSpans?: Record<string, [number, number] | undefined>;
  }> = [];

  // @ts-ignore
  for (const m of str.matchAll(g)) {
    // @ts-ignore
    const idx = (m as any).indices as
      | {
          [k: number]: [number, number];
          groups?: Record<string, [number, number]>;
        }
      | undefined;
    if (idx) {
      out.push({
        match: m[0],
        span: idx[0]!,
        captures: m.slice(1),
        groupSpans: idx.groups ?? undefined,
      });
    } else {
      const s = m.index ?? -1;
      out.push({
        match: m[0],
        span: [s, s + m[0].length],
        captures: m.slice(1),
      });
    }
  }
  return out;
}

/* ===========================================
   3) TINY PATTERN BUILDER (composable)
   =========================================== */

type P = { src: string };
const p = (s: string): P => ({ src: s });

export const lit = (s: string) => p(escapeRegex(s));
export const raw = (s: string) => p(s); // you promise it's safe
export const seq = (...xs: P[]) => p(xs.map((x) => x.src).join(""));
export const alt = (...xs: P[]) => p(`(?:${xs.map((x) => x.src).join("|")})`);
export const cap = (x: P, name?: string) =>
  p(name ? `(?<${name}>${x.src})` : `(${x.src})`);
export const nonCap = (x: P) => p(`(?:${x.src})`);
export const opt = (x: P) => p(`(?:${x.src})?`);
export const rep = (x: P, min = 0, max?: number) =>
  p(max == null ? `(?:${x.src}){${min},}` : `(?:${x.src}){${min},${max}}`);
export const plus = (x: P) => rep(x, 1);
export const star = (x: P) => rep(x, 0);
export const cls = (s: string) => p(`[${s}]`); // e.g., cls("A-Za-z0-9_")
export const notCls = (s: string) => p(`[^${s}]`);
export const start = p("^");
export const end = p("$");
export const wb = p(`\\b`);
export const nb = p(`\\B`);
export const dot = p(`.`);
export const ws = p(`\\s`);
export const nws = p(`\\S`);

/**
 * compile pattern parts into RegExp
 * usage:
 * ```ts
 * const re = compile(seq(start, plus(tok.digit), end));
 * ```
 * @param x
 * @param flags
 * @returns
 */
export const compile = (x: P, flags = "") => makeRe(x.src, flags);

/** handy tokens */
export const tok = {
  digit: cls("0-9"),
  hex: cls("0-9A-Fa-f"),
  word: p(`\\w`),
  uLetter: p(`\\p{L}`),
  uWordish: p(`[\\p{L}\\p{N}_-]`),
};

/**
 * path-like pattern
 * example: simple path like foo/bar.txt
 * usage:
 * ```ts
 * const re = pathLike();
 * @returns
 */
export function pathLike() {
  const name = plus(tok.uWordish);
  const seg = seq(name, opt(seq(lit("."), plus(tok.uWordish))));
  return compile(seq(start, seg, star(seq(lit("/"), seg)), end), "u");
}
