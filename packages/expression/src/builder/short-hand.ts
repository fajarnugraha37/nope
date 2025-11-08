import type {
  OperatorOption,
  OperationOperand,
  Operation,
} from "../expression.js";
import { Ops } from "./ops.js";

/**
 * Binary operation helper
 */
export function bin(
  op: OperatorOption,
  left: OperationOperand,
  right: OperationOperand
): Operation {
  return Ops.op(op, left, right);
}

/**
 * Ternary operation helper (if-then-else)
 */
export function iff(
  condition: OperationOperand,
  thenValue: OperationOperand,
  elseValue?: OperationOperand
): Operation {
  return elseValue !== undefined
    ? Ops.op("if", condition, thenValue, elseValue)
    : Ops.op("if", condition, thenValue);
}

/**
 * Switch statement helper
 */
export function when(
  value: OperationOperand,
  cases: Record<string, OperationOperand>,
  defaultCase?: OperationOperand
): Operation {
  return Ops.switch(value, cases, defaultCase);
}

/**
 * Comparison helpers
 */
export const Compare = {
  eq: (a: OperationOperand, b: OperationOperand): Operation => Ops.eq(a, b),
  neq: (a: OperationOperand, b: OperationOperand): Operation => Ops.neq(a, b),
  gt: (a: OperationOperand, b: OperationOperand): Operation => Ops.gt(a, b),
  gte: (a: OperationOperand, b: OperationOperand): Operation => Ops.gte(a, b),
  lt: (a: OperationOperand, b: OperationOperand): Operation => Ops.lt(a, b),
  lte: (a: OperationOperand, b: OperationOperand): Operation => Ops.lte(a, b),
  strictEq: (a: OperationOperand, b: OperationOperand): Operation =>
    Ops.strictEq(a, b),
  strictNeq: (a: OperationOperand, b: OperationOperand): Operation =>
    Ops.strictNeq(a, b),
} as const;

/**
 * Math helpers
 */
export const MathOps = {
  add: (...operands: OperationOperand[]): Operation => Ops.add(...operands),
  subtract: (a: OperationOperand, b: OperationOperand): Operation =>
    Ops.subtract(a, b),
  multiply: (...operands: OperationOperand[]): Operation =>
    Ops.multiply(...operands),
  divide: (a: OperationOperand, b: OperationOperand): Operation =>
    Ops.divide(a, b),
  modulo: (a: OperationOperand, b: OperationOperand): Operation =>
    Ops.modulo(a, b),
  power: (base: OperationOperand, exponent: OperationOperand): Operation =>
    Ops.power(base, exponent),
  min: (...operands: OperationOperand[]): Operation => Ops.min(...operands),
  max: (...operands: OperationOperand[]): Operation => Ops.max(...operands),
  abs: (operand: OperationOperand): Operation => Ops.abs(operand),
  round: (operand: OperationOperand): Operation => Ops.round(operand),
  floor: (operand: OperationOperand): Operation => Ops.floor(operand),
  ceil: (operand: OperationOperand): Operation => Ops.ceil(operand),
} as const;

/**
 * Logic helpers
 */
export const Logic = {
  and: (...operands: OperationOperand[]): Operation => Ops.and(...operands),
  or: (...operands: OperationOperand[]): Operation => Ops.or(...operands),
  not: (operand: OperationOperand): Operation => Ops.not(operand),
  xor: (a: OperationOperand, b: OperationOperand): Operation => Ops.xor(a, b),
} as const;

/**
 * String helpers
 */
export const Str = {
  concat: (...operands: OperationOperand[]): Operation =>
    Ops.concat(...operands),
  length: (str: OperationOperand): Operation => Ops.length(str),
  substring: (
    str: OperationOperand,
    start: OperationOperand,
    end?: OperationOperand
  ): Operation => Ops.substring(str, start, end),
  toLowerCase: (str: OperationOperand): Operation => Ops.toLowerCase(str),
  toUpperCase: (str: OperationOperand): Operation => Ops.toUpperCase(str),
  trim: (str: OperationOperand): Operation => Ops.trim(str),
  contains: (
    str: OperationOperand,
    substring: OperationOperand
  ): Operation => Ops.contains(str, substring),
  startsWith: (str: OperationOperand, prefix: OperationOperand): Operation =>
    Ops.startsWith(str, prefix),
  endsWith: (str: OperationOperand, suffix: OperationOperand): Operation =>
    Ops.endsWith(str, suffix),
  replace: (
    str: OperationOperand,
    search: OperationOperand,
    replacement: OperationOperand
  ): Operation => Ops.replace(str, search, replacement),
  split: (str: OperationOperand, separator: OperationOperand): Operation =>
    Ops.split(str, separator),
} as const;
/**
 * Array helpers
 */
export const Arr = {
  map: (array: OperationOperand, callback: OperationOperand): Operation =>
    Ops.map(array, callback),
  filter: (
    array: OperationOperand,
    predicate: OperationOperand
  ): Operation => Ops.filter(array, predicate),
  reduce: (
    array: OperationOperand,
    callback: OperationOperand,
    initial?: OperationOperand
  ): Operation => Ops.reduce(array, callback, initial),
  find: (array: OperationOperand, predicate: OperationOperand): Operation =>
    Ops.find(array, predicate),
  every: (array: OperationOperand, predicate: OperationOperand): Operation =>
    Ops.every(array, predicate),
  some: (array: OperationOperand, predicate: OperationOperand): Operation =>
    Ops.some(array, predicate),
  includes: (array: OperationOperand, value: OperationOperand): Operation =>
    Ops.includes(array, value),
  length: (array: OperationOperand): Operation => Ops.length(array),
  get: (array: OperationOperand, index: OperationOperand): Operation =>
    Ops.get(array, index),
  slice: (
    array: OperationOperand,
    start: OperationOperand,
    end?: OperationOperand
  ): Operation => Ops.slice(array, start, end),
} as const;

/**
 * Validation helpers
 */
export const Is = {
  null: (value: OperationOperand): Operation => Ops.isNull(value),
  defined: (value: OperationOperand): Operation => Ops.isDefined(value),
  empty: (value: OperationOperand): Operation => Ops.isEmpty(value),
  string: (value: OperationOperand): Operation => Ops.isString(value),
  number: (value: OperationOperand): Operation => Ops.isNumber(value),
  boolean: (value: OperationOperand): Operation => Ops.isBoolean(value),
  array: (value: OperationOperand): Operation => Ops.isArray(value),
  object: (value: OperationOperand): Operation => Ops.isObject(value),
  email: (value: OperationOperand): Operation => Ops.isEmail(value),
  url: (value: OperationOperand): Operation => Ops.isUrl(value),
} as const;

/**
 * Object helpers
 */
export const Obj = {
  get: (obj: OperationOperand, key: OperationOperand): Operation =>
    Ops.get(obj, key),
  keys: (obj: OperationOperand): Operation => Ops.keys(obj),
  values: (obj: OperationOperand): Operation => Ops.values(obj),
  entries: (obj: OperationOperand): Operation => Ops.entries(obj),
  has: (obj: OperationOperand, key: OperationOperand): Operation =>
    Ops.has(obj, key),
  merge: (...objects: OperationOperand[]): Operation => Ops.merge(...objects),
} as const;

/**
 * Date helpers
 */
export const DateTime = {
  now: (): Operation => Ops.now(),
  date: (value: OperationOperand): Operation => Ops.date(value),
  format: (date: OperationOperand, format: OperationOperand): Operation =>
    Ops.format(date, format),
  isBefore: (date1: OperationOperand, date2: OperationOperand): Operation =>
    Ops.isBefore(date1, date2),
  isAfter: (date1: OperationOperand, date2: OperationOperand): Operation =>
    Ops.isAfter(date1, date2),
} as const;

/**
 * Higher-order operation helpers (legacy compatibility)
 */
export const HO = {
  map: (iterable: OperationOperand, lambda: OperationOperand): Operation =>
    Ops.map(iterable, lambda),
  reduce: (
    iterable: OperationOperand,
    lambda: OperationOperand,
    init?: OperationOperand
  ): Operation =>
    init ? Ops.reduce(iterable, lambda, init) : Ops.reduce(iterable, lambda),
  every: (
    iterable: OperationOperand,
    predicate: OperationOperand
  ): Operation => Ops.every(iterable, predicate),
  some: (
    iterable: OperationOperand,
    predicate: OperationOperand
  ): Operation => Ops.some(iterable, predicate),
} as const;

/**
 * Fluent expression builder for complex operations
 */
export class FluentOps {
  constructor(private readonly operand: OperationOperand) {}

  static from(operand: OperationOperand): FluentOps {
    return new FluentOps(operand);
  }

  // Math operations
  add(...others: OperationOperand[]): FluentOps {
    return new FluentOps(Ops.add(this.operand, ...others));
  }

  subtract(other: OperationOperand): FluentOps {
    return new FluentOps(Ops.subtract(this.operand, other));
  }

  multiply(...others: OperationOperand[]): FluentOps {
    return new FluentOps(Ops.multiply(this.operand, ...others));
  }

  divide(other: OperationOperand): FluentOps {
    return new FluentOps(Ops.divide(this.operand, other));
  }

  // Comparison operations
  eq(other: OperationOperand): FluentOps {
    return new FluentOps(Ops.eq(this.operand, other));
  }

  gt(other: OperationOperand): FluentOps {
    return new FluentOps(Ops.gt(this.operand, other));
  }

  lt(other: OperationOperand): FluentOps {
    return new FluentOps(Ops.lt(this.operand, other));
  }

  gte(other: OperationOperand): FluentOps {
    return new FluentOps(Ops.gte(this.operand, other));
  }

  lte(other: OperationOperand): FluentOps {
    return new FluentOps(Ops.lte(this.operand, other));
  }

  // Logic operations
  and(...others: OperationOperand[]): FluentOps {
    return new FluentOps(Ops.and(this.operand, ...others));
  }

  or(...others: OperationOperand[]): FluentOps {
    return new FluentOps(Ops.or(this.operand, ...others));
  }

  not(): FluentOps {
    return new FluentOps(Ops.not(this.operand));
  }

  // Array operations (when operand is array)
  map(callback: OperationOperand): FluentOps {
    return new FluentOps(Ops.map(this.operand, callback));
  }

  filter(predicate: OperationOperand): FluentOps {
    return new FluentOps(Ops.filter(this.operand, predicate));
  }

  find(predicate: OperationOperand): FluentOps {
    return new FluentOps(Ops.find(this.operand, predicate));
  }

  includes(value: OperationOperand): FluentOps {
    return new FluentOps(Ops.includes(this.operand, value));
  }

  get(key: OperationOperand): FluentOps {
    return new FluentOps(Ops.get(this.operand, key));
  }

  // String operations (when operand is string)
  concat(...others: OperationOperand[]): FluentOps {
    return new FluentOps(Ops.concat(this.operand, ...others));
  }

  toLowerCase(): FluentOps {
    return new FluentOps(Ops.toLowerCase(this.operand));
  }

  toUpperCase(): FluentOps {
    return new FluentOps(Ops.toUpperCase(this.operand));
  }

  trim(): FluentOps {
    return new FluentOps(Ops.trim(this.operand));
  }

  contains(substring: OperationOperand): FluentOps {
    return new FluentOps(Ops.contains(this.operand, substring));
  }

  // Validation
  isNull(): FluentOps {
    return new FluentOps(Ops.isNull(this.operand));
  }

  isDefined(): FluentOps {
    return new FluentOps(Ops.isDefined(this.operand));
  }

  isEmpty(): FluentOps {
    return new FluentOps(Ops.isEmpty(this.operand));
  }

  // Control flow
  if(thenValue: OperationOperand, elseValue?: OperationOperand): FluentOps {
    return new FluentOps(Ops.if(this.operand, thenValue, elseValue));
  }

  // Get the final operation
  build(): Operation {
    return this.operand as Operation;
  }

  // Get the operand (for use in other operations)
  value(): OperationOperand {
    return this.operand;
  }
}

// Export convenience function for fluent API
export const $ = FluentOps.from;
