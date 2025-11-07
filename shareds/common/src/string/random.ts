import { ENCODING, ENCODING_LEN } from "./const.js";

/**
 * Generates a random character from the defined encoding.
 *
 * This function uses the provided PRNG (Pseudorandom Number Generator) to generate a random integer
 * within the range of the encoding length. It then uses that index to retrieve the character from the encoding string.
 *
 * @param {() => number} prng - The PRNG to use for generating the random number.
 * @returns {string} A random character from the encoding.
 */
export function randomChar(prng: () => number): string {
  let rand = Math.floor(prng() * ENCODING_LEN);
  if (rand === ENCODING_LEN) {
    rand = ENCODING_LEN - 1;
  }

  return ENCODING.charAt(rand);
}

/**
 * Detects a cryptographically secure random number generator (PRNG).
 *
 * This function utilizes the `crypto.getRandomValues` function to generate a random byte array.
 * It then returns a function that generates a random number between 0 and 1 by dividing
 * the first byte of the array by 255 (0xff).
 *
 * @returns {PRNG} A function that generates a random number between 0 and 1.
 */
export function detectPrng(): () => number {
  return () => {
    const buffer = new Uint8Array(1);
    crypto.getRandomValues(buffer);
    return buffer[0]! / 0xff;
  };
}
