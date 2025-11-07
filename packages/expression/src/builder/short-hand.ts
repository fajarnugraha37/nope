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
  eq: (a: OperationOperand, b: OperationOperand) => Ops.eq(a, b),
  neq: (a: OperationOperand, b: OperationOperand) => Ops.neq(a, b),
  gt: (a: OperationOperand, b: OperationOperand) => Ops.gt(a, b),
  gte: (a: OperationOperand, b: OperationOperand) => Ops.gte(a, b),
  lt: (a: OperationOperand, b: OperationOperand) => Ops.lt(a, b),
  lte: (a: OperationOperand, b: OperationOperand) => Ops.lte(a, b),
  strictEq: (a: OperationOperand, b: OperationOperand) => Ops.strictEq(a, b),
  strictNeq: (a: OperationOperand, b: OperationOperand) => Ops.strictNeq(a, b),
} as const;

/**
 * Math helpers
 */
export const MathOps = {
  add: (...operands: OperationOperand[]) => Ops.add(...operands),
  subtract: (a: OperationOperand, b: OperationOperand) => Ops.subtract(a, b),
  multiply: (...operands: OperationOperand[]) => Ops.multiply(...operands),
  divide: (a: OperationOperand, b: OperationOperand) => Ops.divide(a, b),
  modulo: (a: OperationOperand, b: OperationOperand) => Ops.modulo(a, b),
  power: (base: OperationOperand, exponent: OperationOperand) =>
    Ops.power(base, exponent),
  min: (...operands: OperationOperand[]) => Ops.min(...operands),
  max: (...operands: OperationOperand[]) => Ops.max(...operands),
  abs: (operand: OperationOperand) => Ops.abs(operand),
  round: (operand: OperationOperand) => Ops.round(operand),
  floor: (operand: OperationOperand) => Ops.floor(operand),
  ceil: (operand: OperationOperand) => Ops.ceil(operand),
} as const;

/**
 * Logic helpers
 */
export const Logic = {
  and: (...operands: OperationOperand[]) => Ops.and(...operands),
  or: (...operands: OperationOperand[]) => Ops.or(...operands),
  not: (operand: OperationOperand) => Ops.not(operand),
  xor: (a: OperationOperand, b: OperationOperand) => Ops.xor(a, b),
} as const;

/**
 * String helpers
 */
export const Str = {
  concat: (...operands: OperationOperand[]) => Ops.concat(...operands),
  length: (str: OperationOperand) => Ops.length(str),
  substring: (
    str: OperationOperand,
    start: OperationOperand,
    end?: OperationOperand
  ) => Ops.substring(str, start, end),
  toLowerCase: (str: OperationOperand) => Ops.toLowerCase(str),
  toUpperCase: (str: OperationOperand) => Ops.toUpperCase(str),
  trim: (str: OperationOperand) => Ops.trim(str),
  contains: (str: OperationOperand, substring: OperationOperand) =>
    Ops.contains(str, substring),
  startsWith: (str: OperationOperand, prefix: OperationOperand) =>
    Ops.startsWith(str, prefix),
  endsWith: (str: OperationOperand, suffix: OperationOperand) =>
    Ops.endsWith(str, suffix),
  replace: (
    str: OperationOperand,
    search: OperationOperand,
    replacement: OperationOperand
  ) => Ops.replace(str, search, replacement),
  split: (str: OperationOperand, separator: OperationOperand) =>
    Ops.split(str, separator),
} as const;

/**
 * Array helpers
 */
export const Arr = {
  map: (array: OperationOperand, callback: OperationOperand) =>
    Ops.map(array, callback),
  filter: (array: OperationOperand, predicate: OperationOperand) =>
    Ops.filter(array, predicate),
  reduce: (
    array: OperationOperand,
    callback: OperationOperand,
    initial?: OperationOperand
  ) => Ops.reduce(array, callback, initial),
  find: (array: OperationOperand, predicate: OperationOperand) =>
    Ops.find(array, predicate),
  every: (array: OperationOperand, predicate: OperationOperand) =>
    Ops.every(array, predicate),
  some: (array: OperationOperand, predicate: OperationOperand) =>
    Ops.some(array, predicate),
  includes: (array: OperationOperand, value: OperationOperand) =>
    Ops.includes(array, value),
  length: (array: OperationOperand) => Ops.length(array),
  get: (array: OperationOperand, index: OperationOperand) =>
    Ops.get(array, index),
  slice: (
    array: OperationOperand,
    start: OperationOperand,
    end?: OperationOperand
  ) => Ops.slice(array, start, end),
} as const;

/**
 * Validation helpers
 */
export const Is = {
  null: (value: OperationOperand) => Ops.isNull(value),
  defined: (value: OperationOperand) => Ops.isDefined(value),
  empty: (value: OperationOperand) => Ops.isEmpty(value),
  string: (value: OperationOperand) => Ops.isString(value),
  number: (value: OperationOperand) => Ops.isNumber(value),
  boolean: (value: OperationOperand) => Ops.isBoolean(value),
  array: (value: OperationOperand) => Ops.isArray(value),
  object: (value: OperationOperand) => Ops.isObject(value),
  email: (value: OperationOperand) => Ops.isEmail(value),
  url: (value: OperationOperand) => Ops.isUrl(value),
} as const;

/**
 * Object helpers
 */
export const Obj = {
  get: (obj: OperationOperand, key: OperationOperand) => Ops.get(obj, key),
  keys: (obj: OperationOperand) => Ops.keys(obj),
  values: (obj: OperationOperand) => Ops.values(obj),
  entries: (obj: OperationOperand) => Ops.entries(obj),
  has: (obj: OperationOperand, key: OperationOperand) => Ops.has(obj, key),
  merge: (...objects: OperationOperand[]) => Ops.merge(...objects),
} as const;

/**
 * Date helpers
 */
export const DateTime = {
  now: () => Ops.now(),
  date: (value: OperationOperand) => Ops.date(value),
  format: (date: OperationOperand, format: OperationOperand) =>
    Ops.format(date, format),
  isBefore: (date1: OperationOperand, date2: OperationOperand) =>
    Ops.isBefore(date1, date2),
  isAfter: (date1: OperationOperand, date2: OperationOperand) =>
    Ops.isAfter(date1, date2),
} as const;

/**
 * Higher-order operation helpers (legacy compatibility)
 */
export const HO = {
  map: (iterable: OperationOperand, lambda: OperationOperand) =>
    Ops.map(iterable, lambda),
  reduce: (
    iterable: OperationOperand,
    lambda: OperationOperand,
    init?: OperationOperand
  ) =>
    init ? Ops.reduce(iterable, lambda, init) : Ops.reduce(iterable, lambda),
  every: (iterable: OperationOperand, predicate: OperationOperand) =>
    Ops.every(iterable, predicate),
  some: (iterable: OperationOperand, predicate: OperationOperand) =>
    Ops.some(iterable, predicate),
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
