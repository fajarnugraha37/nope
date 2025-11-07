import { InvalidDataError } from "../error/index.js";
import { randomChar } from "./random.js";
import {
  ENCODING,
  ENCODING_LEN,
  RANDOM_LEN,
  TIME_LEN,
  TIME_MAX,
} from "./const.js";

/**
 * Extracts the timestamp given a valid ULID.
 *
 * @example encode the time to ULID
 * ```ts
 * import { encodeTime } from "@std/ulid";
 * import { assertEquals } from "@std/assert";
 *
 * assertEquals("01ARYZ6S41", encodeTime(1469918176385, 10));
 * ```
 *
 * @param now The number of milliseconds since the Unix epoch.
 * @param len length of the generated string.
 * @returns The ULID to extract the timestamp from.
 */
export function encodeTime(now: number, len: number = TIME_LEN): string {
  if (now > TIME_MAX) {
    throw new InvalidDataError("cannot encode time greater than " + TIME_MAX);
  }
  if (now < 0) {
    throw new InvalidDataError("time must be positive");
  }
  if (Number.isInteger(now) === false) {
    throw new InvalidDataError("time must be an integer");
  }
  let str = "";
  for (; len > 0; len--) {
    const mod = now % ENCODING_LEN;
    str = ENCODING[mod] + str;
    now = (now - mod) / ENCODING_LEN;
  }

  return str;
}

/**
 * Extracts the number of milliseconds since the Unix epoch that had passed when
 * the ULID was generated. If the ULID is malformed, an error will be thrown.
 *
 * @example Decode the time from a ULID
 * ```ts
 * import { decodeTime, ulid } from "@std/ulid";
 * import { assertEquals } from "@std/assert";
 *
 * const timestamp = 150_000;
 * const ulidString = ulid(timestamp);
 *
 * assertEquals(decodeTime(ulidString), timestamp);
 * ```
 *
 * @param ulid The ULID to extract the timestamp from.
 * @returns The number of milliseconds since the Unix epoch that had passed when the ULID was generated.
 */
export function decodeTime(id: string): number {
  if (id.length !== TIME_LEN + RANDOM_LEN) {
    throw new InvalidDataError("malformed ulid");
  }
  const time = id
    .substring(0, TIME_LEN)
    .split("")
    .reverse()
    .reduce((carry, char, index) => {
      const encodingIndex = ENCODING.indexOf(char);
      if (encodingIndex === -1) {
        throw new InvalidDataError("invalid character found: " + char);
      }
      return (carry += encodingIndex * Math.pow(ENCODING_LEN, index));
    }, 0);
  if (time > TIME_MAX) {
    throw new InvalidDataError("malformed ulid, timestamp too large");
  }

  return time;
}

/**
 * Encodes a random string of specified length using the provided PRNG.
 *
 * This function iterates for the specified length, calling the `randomChar` function with the PRNG
 * to generate a random character and prepend it to the string being built.
 *
 * @param {number} len - The desired length of the random string.
 * @param {() => number} prng - The PRNG to use for generating random characters.
 * @returns {string} A random string of the specified length.
 */
export function encodeRandom(len: number, prng: () => number): string {
  let str = "";
  for (; len > 0; len--) {
    str = randomChar(prng) + str;
  }
  return str;
}
