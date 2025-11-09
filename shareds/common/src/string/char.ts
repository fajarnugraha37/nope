import { ENCODING, ENCODING_LEN } from "./const.js";

/**
 * Function to replace characters in certain positions
 *
 * @param str The string you want to replace
 * @param index The start index of the character is replaced
 * @param char new character to be embedded
 * @returns String that has been replaced with new value
 */
export function replaceCharAt(
  str: string,
  index: number,
  char: string
): string {
  return str.substring(0, index) + char + str.substring(index + 1);
}

/**
 * Increments a base32 encoded string.
 *
 * This function iterates through the string from the end, incrementing characters based on the defined encoding.
 *
 * @param {string} str The base32 encoded string to increment.
 * @returns {string} The incremented string.
 * @throws {Error} If the string is not correctly encoded or cannot be incremented.
 */
export function incrementBase32(str: string): string {
  let index = str.length;
  let char;
  let charIndex;
  const maxCharIndex = ENCODING_LEN - 1;
  while (index-- >= 0) {
    char = str[index]!;
    charIndex = ENCODING.indexOf(char);
    if (charIndex === -1) {
      throw new Error("incorrectly encoded string");
    }
    if (charIndex === maxCharIndex) {
      str = replaceCharAt(str, index, ENCODING[0]!);
      continue;
    }

    return replaceCharAt(str, index, ENCODING[charIndex + 1]!);
  }

  throw new Error("cannot increment this string");
}   