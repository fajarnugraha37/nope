import { InvalidDataError } from "../error/index.js";
import { B32_CHARACTERS } from "./const.js";

export const crockford = {
  encode: (input: Uint8Array) => {
    const output: number[] = [];
    let bitsRead = 0;
    let buffer = 0;
    const reversedInput = new Uint8Array(input.slice().reverse());
    for (const byte of reversedInput) {
      buffer |= byte << bitsRead;
      bitsRead += 8;

      while (bitsRead >= 5) {
        output.unshift(buffer & 0x1f);
        buffer >>>= 5;
        bitsRead -= 5;
      }
    }
    if (bitsRead > 0) {
      output.unshift(buffer & 0x1f);
    }

    return output.map((byte) => B32_CHARACTERS.charAt(byte)).join("");
  },
  decode: (input: string) => {
    const sanitizedInput = input.toUpperCase().split("").reverse().join("");
    const output: number[] = [];
    let bitsRead = 0;
    let buffer = 0;
    for (const character of sanitizedInput) {
      const byte = B32_CHARACTERS.indexOf(character);
      if (byte === -1) {
        throw new InvalidDataError(
          `Invalid base 32 character found in string: ${character}`
        );
      }
      buffer |= byte << bitsRead;
      bitsRead += 5;
      while (bitsRead >= 8) {
        output.unshift(buffer & 0xff);
        buffer >>>= 8;
        bitsRead -= 8;
      }
    }
    if (bitsRead >= 5 || buffer > 0) {
      output.unshift(buffer & 0xff);
    }
    return new Uint8Array(output);
  },
};
