/* ---------------------------
   1) direct exchange helpers
   --------------------------- */

/**
 * exact routing-key match (direct exchange semantics)
 * usage:
 * ```ts
 * directMatch("user.created", "user.created"); // true
 * directMatch("user.*", "user.created"); // false
 * ```
 * @param bindingKey
 * @param routingKey
 * @returns
 */
export function directMatch(bindingKey: string, routingKey: string): boolean {
  // amqp direct: exact byte-for-byte equality (<=255 bytes is your broker’s limit)
  return bindingKey === routingKey;
}

/**
 * table-driven direct router (stable first-match)
 * usage:
 * ```ts
 * const result = directRoute(
 *   [
 *     { key: "user.created", handle: (rk) => `Handled ${rk} with user.created` },
 *     { key: "user.*", handle: (rk) => `Handled ${rk} with user.*` },
 *   ],
 *   "user.api.created"
 * );
 * ```
 * @param entries
 * @param routingKey
 * @returns
 */
export function directRoute<T>(
  entries: Array<{ key: string; handle: (rk: string) => T }>,
  routingKey: string
): T | undefined {
  for (const e of entries)
    if (e.key === routingKey) return e.handle(routingKey);
  return undefined;
}

/* ---------------------------
   2) headers exchange helpers
   --------------------------- */

/**
 * amqp headers exchange semantics:
 * - queue binding has a header map + special "x-match": "all" | "any" (default: "all").
 * - a message matches if (all|any) of binding headers are present and equal (strict equality).
 * - comparisons are usually case-sensitive and non-coerced in brokers.
 * usage:
 * ```ts
 * headersMatch(
 *   { "x-match": "all", "foo": "bar" },
 *   { "foo": "bar", "baz": "qux" }
 * ); // true
 * ```
 * @param binding
 * @param msgHeaders
 * @returns boolean
 */
export type HeadersTable = Record<string, unknown> & {
  "x-match"?: "all" | "any";
};

export function headersMatch(
  binding: HeadersTable,
  msgHeaders: Record<string, unknown>
): boolean {
  const mode = (binding["x-match"] ?? "all").toLowerCase() as "all" | "any";
  const keys = Object.keys(binding).filter((k) => k !== "x-match");

  if (mode === "all") {
    return keys.every(
      (k) =>
        Object.prototype.hasOwnProperty.call(msgHeaders, k) &&
        Object.is(msgHeaders[k], binding[k])
    );
  } else {
    return keys.some(
      (k) =>
        Object.prototype.hasOwnProperty.call(msgHeaders, k) &&
        Object.is(msgHeaders[k], binding[k])
    );
  }
}

/**
 * pick first matching headers binding; returns index + handler result for debugging
 * usage:
 * ```ts
 * const result = headersRoute(
 *   [
 *     { binding: { "x-match": "all", "foo": "bar" }, handle: (h) => `Handled with ${JSON.stringify(h)}` },
 *     { binding: { "x-match": "any", "baz": "qux" }, handle: (h) => `Handled with ${JSON.stringify(h)}` },
 *   ],
 *   { "foo": "bar", "baz": "qux" }
 * );
 * ```
 * @param entries
 * @param msgHeaders
 * @returns
 */
export function headersRoute<T>(
  entries: Array<{
    binding: HeadersTable;
    handle: (h: Record<string, unknown>) => T;
  }>,
  msgHeaders: Record<string, unknown>
): { index: number; result: T } | undefined {
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (headersMatch(e?.binding!, msgHeaders))
      return { index: i, result: e?.handle(msgHeaders)! };
  }
  return undefined;
}

/* ---------------------------
   3) topic-binding tiny DSL
   --------------------------- */

/**
 * atoms are dot-separated. we expose helpers for:
 *  - lit("user")     → "user"
 *  - one()           → "*"   (exactly one atom)
 *  - many()          → "#"   (zero or more atoms)
 *  - segs("a","b")   → "a.b"
 *  - anyOf("a","b")  → "(a|b)" but we’ll expand to alternates during build
 *
 * compile() flattens and joins with dots, expanding alternation into multiple bindings.
 */

type Atom = {
  kind: "lit" | "one" | "many" | "alt";
  val?: string;
  alts?: string[];
};

const lit = (s: string): Atom => ({ kind: "lit", val: s });
const one = (): Atom => ({ kind: "one" });
const many = (): Atom => ({ kind: "many" });
const anyOf = (...xs: string[]): Atom => ({ kind: "alt", alts: xs });

export const TopicAtoms = {
  lit,
  one,
  many,
  anyOf,
};

/**
 * convenience builder: segs(lit("user"), one(), lit("created"))
 * usage:
 * ```ts
 * const segments = segs(
 *   lit("user"),
 *   one(),
 *   lit("created")
 * );
 * ```
 * @param atoms
 * @returns
 */
export function segs(...atoms: Atom[]) {
  return atoms;
}

/**
 * join segments into dot-separated binding(s); expands alternations into the cartesian product
 * usage:
 * ```ts
 * const bindings = compileTopic(
 *   segs(lit("user"), one(), lit("created")),
 *   segs(lit("user"), many(), lit("deleted"))
 * );
 * ```
 * @param segments
 * @returns string[]
 */
export function compileTopic(...segments: Atom[][]): string[] {
  // transform each segment array into string[] variants (handle 'alt' inside the segment)
  const segVariants = segments.map((seg) => {
    // one segment must resolve to exactly one atom string: literal | * | # | alt(...)
    const expanded: string[] = [];
    const push = (s: string) => expanded.push(s);

    if (seg.length !== 1) {
      throw new Error("each segment is a single Atom; use segs() per segment");
    }
    const a = seg[0];
    switch (a?.kind) {
      case "lit":
        push(a.val!);
        break;
      case "one":
        push("*");
        break;
      case "many":
        push("#");
        break;
      case "alt":
        (a.alts ?? []).forEach(push);
        break;
    }
    return expanded;
  });

  // cartesian product
  let acc: string[] = [""];
  for (const choices of segVariants) {
    const next: string[] = [];
    for (const base of acc)
      for (const c of choices) next.push(base ? `${base}.${c}` : c);
    acc = next;
  }
  return acc;
}

/**
 * sugar: topicKey`user.${anyOf("api","svc")}.${one()}.created`
 * usage:
 * ```ts
 * const bindings = topicKey`user.${anyOf("api","svc")}.${one()}.created`;
 * ```
 * @param parts
 * @param vals
 * @returns string[]
 */
export function topicKey(
  parts: TemplateStringsArray,
  ...vals: Array<string | Atom>
): string[] {
  // split by dots at the template layer: user. ${val} .created etc.
  // build a sequence of single-atom segments
  const segsArr: Atom[][] = [];
  for (let i = 0; i < parts.length; i++) {
    const raw = parts[i];
    // push literal atoms for any non-empty token between dots
    raw?.split(".").forEach((tok) => {
      if (tok) segsArr.push([lit(tok)]);
    });
    if (i < vals.length) {
      const v = vals[i];
      if (typeof v === "string") segsArr.push([lit(v)]);
      else segsArr.push([v!]);
    }
  }
  return compileTopic(...segsArr);
}
