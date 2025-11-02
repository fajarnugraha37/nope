import { escapeRegex, makeRe, withFlag, withoutFlag } from "./common.js";

/** get all matches with indices + groups (if available) */
export type MatchHit = {
  match: string;
  index: number;
  captures: string[];
  groups?: Record<string, string>;
};

/**
 * get all matches with indices + groups (if available)
 * usage:
 * ```ts
 * matchAll("aabbcc", /b/); // [{match: "b", index: 2, captures: []}, {match: "b", index: 3, captures: []}]
 * ```
 * @param str
 * @param re
 * @returns
 */
export function matchAll(str: string, re: RegExp): MatchHit[] {
  const g = withFlag(re, "g");
  g.lastIndex = 0;
  const out: MatchHit[] = [];
  for (const m of str.matchAll(g)) {
    out.push({
      match: m[0],
      index: m.index ?? -1,
      captures: m.slice(1),
      groups: m.groups ?? undefined,
    });
  }
  return out;
}

/**
 * get named capture groups from a single match
 * usage:
 * ```ts
 * groups<{name: string}>("Hello, Alice!", /Hello, (?<name>\w+)!/); // {name: "Alice"}
 * ```
 * @param str
 * @param re
 * @returns
 */
export function groups<
  T extends Record<string, string> = Record<string, string>
>(str: string, re: RegExp): T | undefined {
  const m = new RegExp(re.source, withoutFlag(re, "g").flags).exec(str);
  return (m?.groups as T | undefined) ?? undefined;
}

/**
 * replaceAll with a function, preserving original flags (adds 'g' under the hood)
 * usage:
 * ```ts
 * replaceAllFn("aabbcc", /b/, hit => hit.match.toUpperCase()); // "aaBBcc"
 * ```
 * @param str
 * @param re
 * @param fn
 * @returns
 */
export function replaceAllFn(
  str: string,
  re: RegExp,
  fn: (hit: MatchHit) => string
): string {
  const g = withFlag(re, "g");
  return str.replace(g, (...args) => {
    // args: match, ...captures, offset, whole, groups
    const [match, ...rest] = args as unknown[];
    const offset = rest[rest.length - 3] as number;
    const whole = rest[rest.length - 2] as string;
    const grp = (rest[rest.length - 1] as Record<string, string>) ?? undefined;
    const captures = (args.slice(1, -3) as string[]) ?? [];
    return fn({ match: match as string, index: offset, captures, groups: grp });
  });
}

/**
 * split but keep the delimiters (capturing group is kept)
 * usage:
 * ```ts
 * splitKeep("apple, banana; cherry", /[;,]\s*\/); // ["apple", ", ", "banana", "; ", "cherry"]
 * ```
 * @param str
 * @param delimiter
 * @returns
 */
export function splitKeep(str: string, delimiter: RegExp): string[] {
  const g = withFlag(delimiter, "g");
  // ensure delimiter has at least one capturing group so it’s kept
  const hasCap = /\((?!\?)/.test(g.source);
  const re = hasCap ? g : new RegExp(`(${g.source})`, g.flags);
  return str.split(re);
}

/**
 * join multiple regexes into one via alternation (inherits/merges flags)
 * usage:
 * ```ts
 * anyOf([/cat/i, /dog/g]); // /(?:cat)|(?:dog)/ig
 * ```
 * @param res
 * @param flags
 * @returns
 */
export function anyOf(res: RegExp[], flags = ""): RegExp {
  const src = res.map((r) => `(?:${r.source})`).join("|");
  const mergedFlags = Array.from(
    new Set((res.map((r) => r.flags).join("") + flags).split(""))
  ).join("");
  return new RegExp(src, mergedFlags);
}

/**
 * tagged template: escape string interpolations; embed RegExp sources as-is
 * usage:
 * ```ts
 * const word = "hello.*world";
 * const re = re`^${word}\d+`; // /^hello\.\*world\d+/
 * ```
 * @param parts
 * @param values
 * @returns
 */
export function re(
  parts: TemplateStringsArray,
  ...values: Array<string | RegExp>
): RegExp {
  let src = "";
  for (let i = 0; i < parts.length; i++) {
    src += parts[i];
    if (i < values.length) {
      const v = values[i];
      src += typeof v === "string" ? escapeRegex(v) : `(?:${v?.source})`;
    }
  }
  return new RegExp(src);
}

/**
 * common, sane patterns (not “perfect”, but practical)
 * usage:
 * ```ts
 * rx.uuid.test("550e8400-e29b-41d4-a716-446655440000"); // true
 * ```
 */
export const rx = {
  // word chars (unicode letters+marks+digits+connector)
  identifier: /\p{L}[\p{L}\p{N}\p{M}_-]*/u,
  number: /[+-]?(?:\d+(?:\.\d+)?|\.\d+)/,
  uuid: /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
  ipv4: /\b(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}\b/,
  emailSimple: /[^\s@]+@[^\s@]+\.[^\s@]+/,
  ws: /\s+/,
  notWs: /\S+/,
} as const;

/**
 * create a case-insensitive whole-word finder (unicode-aware)
 * usage:
 * ```ts
 * const re = wordFinder("hello");
 * re.test("Hello there!"); // true
 * re.test("ahellob"); // false
 * ```
 * @param word
 * @param flags
 * @returns
 */
export function wordFinder(word: string, flags = "iu"): RegExp {
  return makeRe(`\\b${escapeRegex(word)}\\b`, flags);
}
