/**
 * practical validator: 1..255 bytes, dot-separated atoms, no empty atoms
 * usage:
 * ```ts
 * isValidRoutingKey("user.api.created"); // true
 * isValidRoutingKey("user..created"); // false
 * isValidRoutingKey(".user.created"); // false
 * isValidRoutingKey("a".repeat(300).split("").join(".")); // false
 * ```
 * @param key
 * @returns boolean
 */
export function isValidRoutingKey(key: string): boolean {
  if (!key) return false;
  const bytes = new TextEncoder().encode(key).length;
  if (bytes < 1 || bytes > 255) return false;
  if (key.startsWith(".") || key.endsWith(".") || key.includes(".."))
    return false;
  // relax the char set: anything except dot is allowed; tighten if your org needs it
  return true;
}

/**
 * practical validator for binding keys (`*` = one word, `#` = zero+ words)
 * usage:
 * ```ts
 * isValidBindingKey("user.*.created"); // true
 * isValidBindingKey("user.#"); // true
 * isValidBindingKey("user.*.created.#"); // true
 * isValidBindingKey("user..created"); // false
 * isValidBindingKey("user.*bar.created"); // false
 * ```
 * @param key
 * @returns boolean
 */
export function isValidBindingKey(key: string): boolean {
  if (!isValidRoutingKey(key.replaceAll("*", "x").replaceAll("#", "x")))
    return false;
  // forbid mixing wildcards inside a single atom like "foo*bar" (amqp allows, but it’s nonsensical)
  return key
    .split(".")
    .every(
      (atom) =>
        atom === "*" ||
        atom === "#" ||
        (!atom.includes("*") && !atom.includes("#"))
    );
}

/**
 * match a routing key against a binding pattern (AMQP topic semantics)
 * - '*' matches exactly one word
 * - '#' matches zero or more words
 * non-recursive, with backtracking for '#'
 * usage:
 * ```ts
 * topicMatch("kern.*", "kern.crit"); // true
 * topicMatch("kern.*", "kern.crit.disk"); // false
 * topicMatch("kern.#", "kern.crit.disk"); // true
 * ```
 * @param binding
 * @param routing
 * @returns boolean
 */
export function topicMatch(binding: string, routing: string): boolean {
  if (!isValidRoutingKey(routing)) return false;
  const b = binding.split(".");
  const r = routing.split(".");

  let i = 0; // binding idx
  let j = 0; // routing idx
  // backtrack anchors when we meet '#'
  let lastHashAt = -1;
  let lastHashRJ = -1;

  while (j < r.length) {
    if (i < b.length && (b[i] === "#" || b[i] === r[j] || b[i] === "*")) {
      if (b[i] === "#") {
        // remember position and try to let '#' eat as many as needed
        lastHashAt = i;
        lastHashRJ = j;
        i++; // tentatively consume '#'
      } else if (b[i] === "*") {
        i++;
        j++; // consume one atom
      } else {
        i++;
        j++; // exact match
      }
    } else if (lastHashAt !== -1) {
      // backtrack: let the last '#' absorb one more routing atom
      i = lastHashAt + 1;
      lastHashRJ++;
      j = lastHashRJ;
    } else {
      return false;
    }
  }

  // consume trailing '#'s (they can match zero atoms)
  while (i < b.length && b[i] === "#") i++;

  return i === b.length;
}

/**
 * convert a binding key to a RegExp (anchored), for folks who prefer regex pipelines
 * usage:
 * ```ts
 * const re = bindingToRegExp("kern.*"); // /^kern\.[^.]+$/
 * re.test("kern.crit"); // true
 * re.test("kern.crit.disk"); // false
 * ```
 * @param binding
 * @returns RegExp
 */
export function bindingToRegExp(binding: string): RegExp {
  const parts = binding.split(".").map((atom) => {
    if (atom === "*") return "[^.]+";
    if (atom === "#") return "(?:[^.]+(?:\\.|$))*";
    return atom.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  });

  // glue with literal dots; special-case if binding ends/starts with '#'
  // the constructed pattern handles '#' spanning multiple segments
  const src = `^${parts.join("\\.")}$`.replace(
    // normalize the (?:[^.]+(\.|$))*\.(...) edge when '#' is not last
    /(?:\(\?\:\[\^\.\]\+\(?:\\\.\|\$\)\)\*\)\\\.)/g,
    "(?:\\.[^.]+)*\\."
  );
  return new RegExp(src);
}

/** filter helpers */
export const topic = {
  /**
   * match if any/all bindings match the routing key
   * usage:
   * ```ts
   * topic.any(["kern.*", "user.#"], "user.api.created"); // true
   * topic.all(["#.error", "app.#"], "app.api.error"); // true
   * topic.matchSet(["kern.*", "user.#", "app.#"], "app.api.error"); // ["app.#"]
   * ```
   * @param bindings
   * @param routing
   * @returns boolean
   */
  any: (bindings: string[], routing: string) =>
    bindings.some((b) => topicMatch(b, routing)),
  /**
   * match if all bindings match the routing key
   * usage:
   * ```ts
   * topic.any(["kern.*", "user.#"], "user.api.created"); // true
   * topic.all(["#.error", "app.#"], "app.api.error"); // true
   * topic.matchSet(["kern.*", "user.#", "app.#"], "app.api.error"); // ["app.#"]
   * ```
   * @param bindings
   * @param routing
   * @returns
   */
  all: (bindings: string[], routing: string) =>
    bindings.every((b) => topicMatch(b, routing)),
  /**
   * filter bindings that match the routing key
   * usage:
   * ```ts
   * topic.any(["kern.*", "user.#"], "user.api.created"); // true
   * topic.all(["#.error", "app.#"], "app.api.error"); // true
   * topic.matchSet(["kern.*", "user.#", "app.#"], "app.api.error"); // ["app.#"]
   * ```
   * @param bindings
   * @param routing
   * @returns
   */
  matchSet: (bindings: string[], routing: string) =>
    bindings.filter((b) => topicMatch(b, routing)),
};

/**
 * quick router: choose handler by first matching binding (stable order)
 * usage:
 * ```ts
 * const result = route(
 *   [
 *     { binding: "kern.*", handle: (rk) => `Handled ${rk} with kern.*` },
 *     { binding: "user.#", handle: (rk) => `Handled ${rk} with user.#` },
 *   ],
 *   "user.api.created"
 * );
 * ```
 */
export function route<T>(
  entries: Array<{ binding: string; handle: (rk: string) => T }>,
  routingKey: string
): T | undefined {
  for (const e of entries) {
    if (topicMatch(e.binding, routingKey)) return e.handle(routingKey);
  }
  return undefined;
}

/** examples & edge cases worth unit-testing */
export const EXAMPLES: Array<[binding: string, routing: string, ok: boolean]> =
  [
    ["kern.*", "kern.crit", true],
    ["kern.*", "kern.crit.disk", false],
    ["kern.#", "kern.crit.disk", true],
    ["#.error", "app.api.error", true],
    ["#.error", "error", true],
    ["user.*.created", "user.api.created", true],
    ["user.*.created", "user.created", false],
    ["*.orange.*", "quick.orange.rabbit", true],
    ["*.*.rabbit", "lazy.orange.rabbit", true],
    ["lazy.#", "lazy.orange.elephant", true],
    ["#.orange.#", "quick.orange.fox", true],
    ["#.orange.#", "orange", true],
    ["a.b", "a.b", true],
    ["a.b", "a.bc", false],
  ];
