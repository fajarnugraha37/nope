import {
  detectPrng,
  encodeRandom,
  encodeTime,
  incrementBase32,
  RANDOM_LEN,
  TIME_LEN,
} from "../string/index.js";
import type { ULID } from "./ulid.ts";

/**
 * Creates a ULID generation factory function that ensures monotonic generation.
 *
 * This factory function generates ULIDs where the timestamp is always increasing or remains the same,
 * and the random part is incremented only if the timestamp doesn't change. This ensures lexicographic sorting
 * based on the ULID string.
 *
 * The default PRNG is chosen by the `detectPrng` function.
 *
 * @param {() => number } [prng=detectPrng()] - The PRNG to use for generating random parts of the ULID.
 * @returns {ULID} A function that generates monotonic ULIDs.
 */
export function monotonicFactory(prng: () => number = detectPrng()): ULID {
  let lastTime = 0;
  let lastRandom: string;
  return function ulid(seedTime: number = Date.now()): string {
    if (seedTime <= lastTime) {
      const incrementedRandom = (lastRandom = incrementBase32(lastRandom));
      return encodeTime(lastTime, TIME_LEN) + incrementedRandom;
    }
    lastTime = seedTime;
    const newRandom = (lastRandom = encodeRandom(RANDOM_LEN, prng));
    return encodeTime(seedTime, TIME_LEN) + newRandom;
  };
}