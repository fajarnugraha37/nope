import {
  crockford,
  detectPrng,
  encodeRandom,
  encodeTime,
  ENCODING,
  InvalidDataError,
  RANDOM_LEN,
  TIME_LEN,
  ULID_REGEX,
  UUID_REGEX,
} from "../index.js";

/**
 * A function that generates a Universally Unique Lexicographically Sortable Identifier (ULID).
 *
 * A ULID is a 128-bit unique identifier with a time-based component, designed to be sortable.
 *
 * @param {number} [seedTime] - An optional timestamp to use as the basis for the ULID.
 *   If not provided, the current timestamp will be used.
 * @returns {string} A generated ULID.
 */
export interface ULID {
  (seedTime?: number): string;
}

/**
 * Fixes a base32 ULID string by replacing invalid characters with their correct counterparts.
 *
 * This function replaces the following characters:
 * - 'i' -> '1'
 * - 'l' -> '1'
 * - 'o' -> '0'
 * - '-' (hyphen) -> '' (empty string)
 *
 * @param {string} id The ULID string to fix.
 * @returns {string} The fixed ULID string.
 * @throws {TypeError} If the provided id is not a string.
 */
export function fixULIDBase32(id: string): string {
  return id
    .replace(/i/gi, "1")
    .replace(/l/gi, "1")
    .replace(/o/gi, "0")
    .replace(/-/g, "");
}

/**
 * Validates a ULID string based on its format and character set.
 *
 * This function checks if the provided string:
 * - is a string type
 * - has the correct length (TIME_LEN + RANDOM_LEN)
 * - contains only characters from the defined encoding (all characters are uppercase)
 *
 * @param {string} id The ULID string to validate.
 * @returns {boolean} True if the string is a valid ULID, false otherwise.
 */
export function isValid(id: string): boolean {
  return (
    typeof id === "string" &&
    id.length === TIME_LEN + RANDOM_LEN &&
    id
      .toUpperCase()
      .split("")
      .every((char) => ENCODING.indexOf(char) !== -1)
  );
}

/**
 * Creates a ULID generation factory function.
 *
 * This factory function takes an optional PRNG (Pseudorandom Number Generator) and returns a function for generating ULIDs.
 *
 * The default PRNG is chosen by the `detectPrng` function.
 *
 * @param {() => number} [prng=detectPrng()] - The PRNG to use for generating random parts of the ULID.
 * @returns {ULID} A function that generates ULIDs.
 */
export function factory(prng: () => number = detectPrng()): ULID {
  return function ulid(seedTime: number = Date.now()): string {
    return encodeTime(seedTime, TIME_LEN) + encodeRandom(RANDOM_LEN, prng);
  };
}

/**
 * Converts a ULID string to a UUID string.
 *
 * This function validates the ULID string using a pre-defined regular expression (`ULID_REGEX`).
 * If invalid, it throws an `InvalidData` error. Otherwise, it decodes the ULID string using the `crockford.decode`
 * function (assumed to be an external library) and converts the resulting Uint8Array to a UUID string
 * in the standard format (e.g., "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx").
 *
 * @param {string} ulid - The ULID string to convert.
 * @returns {string} The corresponding UUID string.
 * @throws {InvalidDataError} If the provided ULID is invalid.
 */
export function ulidToUUID(ulid: string): string {
  const isValid = ULID_REGEX.test(ulid);
  if (!isValid) {
    throw new InvalidDataError("Invalid ULID");
  }

  const uint8Array = crockford.decode(ulid);
  const uuid = Array.from(uint8Array)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return (
    uuid.substring(0, 8) +
    "-" +
    uuid.substring(8, 12) +
    "-" +
    uuid.substring(12, 16) +
    "-" +
    uuid.substring(16, 20) +
    "-" +
    uuid.substring(20)
  );
}

/**
 * Converts a UUID string to a ULID string.
 *
 * This function validates the UUID string using a pre-defined regular expression (`UUID_REGEX`).
 * If invalid, it throws an `InvalidData` error. Otherwise, it removes hyphens from the UUID string and splits
 * it into an array of byte pairs. It then converts each byte pair back to a number using hexadecimal parsing
 * and creates a new Uint8Array. Finally, it uses the `crockford.encode` function (assumed to be an external library)
 * to encode the Uint8Array into a ULID string.
 *
 * @param {string} uuid - The UUID string to convert.
 * @returns {string} The corresponding ULID string.
 * @throws {InvalidDataError} If the provided UUID is invalid.
 */
export function uuidToULID(uuid: string): string {
  const isValid = UUID_REGEX.test(uuid);
  if (!isValid) {
    throw new InvalidDataError("Invalid UUID");
  }
  const clean = uuid.replace(/-/g, "").match(/.{1,2}/g);
  if (!clean) {
    throw new InvalidDataError("Invalid UUID");
  }
  const uint8Array = new Uint8Array(clean.map((byte) => parseInt(byte, 16)));

  return crockford.encode(uint8Array);
}
