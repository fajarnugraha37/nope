import { escapeRegex } from "./common.js";

/**
 * build a regex from a wildcard string (where * = any chars)
 * usage:
 * ```ts
 * const re = wildcard("file-*.txt");
 * re.test("file-123.txt"); // true
 * re.test("file-.txt"); // true
 * re.test("file-123.md"); // false
 * ```
 * @param value
 * @returns
 */
export function wildcard(value: string): RegExp {
  const escaped = escapeRegex(value).replace(/\\\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

/**
 * check if a string is made up of only wildcard characters (*)
 * usage:
 * ```ts
 * isAllWildcards("***"); // true
 * isAllWildcards("*a*"); // false
 * ```
 * @param value
 * @returns
 */
export function isAllWildcards(value: string): boolean {
  return value.match(/^\*+$/) !== null;
}
