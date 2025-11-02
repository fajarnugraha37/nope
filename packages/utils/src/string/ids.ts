import { customAlphabet } from "nanoid";

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
const nanoid = customAlphabet(alphabet, 16);

export const createId = (prefix?: string) => {
  const suffix = nanoid();
  return prefix ? `${prefix}_${suffix}` : suffix;
};
