/**
 * escape a literal string so it’s safe inside a regex
 * usage:
 * ```ts
 * escapeRegex("file.*"); // "file\.\*"
 * ```
 * @param value
 * @returns
 */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * build a regex from source + flags, deduping/ordering flags
 * usage:
 * ```ts
 * makeRe("file.*", "gim"); // /file.*\/gim
 * ```
 * @param source
 * @param flags
 * @returns
 */
export function makeRe(source: string, flags = ""): RegExp {
  const uniq = Array.from(new Set(flags.split(""))).join("");
  return new RegExp(source, uniq);
}

/**
 * ensure a regex has a flag (e.g., 'g'), returning a cloned instance
 * usage:
 * ```ts
 * withFlag(/file.*\/, 'g');
 * ```
 * @param re
 * @param flag
 * @returns
 */
export function withFlag(re: RegExp, flag: string): RegExp {
  return new RegExp(
    re.source,
    re.flags.includes(flag) ? re.flags : re.flags + flag
  );
}

/**
 * ensure a regex does NOT have a flag (e.g., 'g'), returning a cloned instance
 * usage:
 * ```ts
 * withoutFlag(/file.*\/, 'g');
 * ```
 * @param re
 * @param flag
 * @returns
 */
export function withoutFlag(re: RegExp, flag: string): RegExp {
  return new RegExp(re.source, re.flags.replace(flag, ""));
}

/**
 * quick test: does re match str? (non-mutating)
 * usage:
 * ```ts
 * has("filename.txt", /.*\.txt$/); // true
 * ```
 * @param str
 * @param re
 * @returns
 */
export function has(str: string, re: RegExp): boolean {
  return new RegExp(re.source, withoutFlag(re, "g").flags).test(str);
}

/**
 * count matches (safe even if re already has/hasn't 'g')
 * usage:
 * ```ts
 * count("aabbcc", /b/); // 2
 * ```
 * @param str
 * @param re
 * @returns
 */
export function count(str: string, re: RegExp): number {
  let n = 0;
  const g = withFlag(re, "g");
  g.lastIndex = 0;
  while (g.exec(str)) n++;
  return n;
}
