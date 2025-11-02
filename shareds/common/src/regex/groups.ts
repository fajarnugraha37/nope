/**
 * extract named capture groups from a regex match
 * usage:
 * ```ts
 * const re = /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/;
 * const result = extractNamedGroups(re, "2023-08-15");
 * // result = { year: "2023", month: "08", day: "15" }
 * ```
 * @param regex
 * @param value
 * @returns
 */
export function extractNamedGroups(
  regex: RegExp,
  value: string
): Record<string, string> | null {
  const match = regex.exec(value);
  if (match && match.groups) {
    return match.groups;
  }
  return null;
}
