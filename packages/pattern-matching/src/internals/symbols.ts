/**
 * @module
 * @private
 * @internal
 */

export const matcher = Symbol.for("@pattern-matching/matcher");
export type matcher = typeof matcher;

export const unset = Symbol.for("@pattern-matching/unset");
export type unset = typeof unset;

export const isVariadic = Symbol.for("@pattern-matching/isVariadic");
export type isVariadic = typeof isVariadic;

export const anonymousSelectKey = "@pattern-matching/anonymous-select-key";
export type anonymousSelectKey = typeof anonymousSelectKey;

export const override = Symbol.for("@pattern-matching/override");
export type override = typeof override;
