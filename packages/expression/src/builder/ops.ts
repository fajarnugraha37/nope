import type {
  VarOperand,
  ValOperand,
  RefOperand,
  LiteralOperand,
  OperatorOption,
  OperationOperand,
  Operation,
} from "../expression.js";

export interface OpsBuilder {
  var(name: string, defaultValue?: unknown): VarOperand;
  val(list: readonly string[]): ValOperand;
  ref(id: string): RefOperand;
  literal(value: unknown): LiteralOperand;
  add(...operands: OperationOperand[]): Operation;
  subtract(a: OperationOperand, b: OperationOperand): Operation;
  multiply(...operands: OperationOperand[]): Operation;
  divide(a: OperationOperand, b: OperationOperand): Operation;
  eq(a: OperationOperand, b: OperationOperand): Operation;
  gt(a: OperationOperand, b: OperationOperand): Operation;
  lt(a: OperationOperand, b: OperationOperand): Operation;
  and(...operands: OperationOperand[]): Operation;
  or(...operands: OperationOperand[]): Operation;
  not(operand: OperationOperand): Operation;
  if(
    condition: OperationOperand,
    thenValue: OperationOperand,
    elseValue?: OperationOperand
  ): Operation;
}

export class Ops {
  /**
   * Create a variable reference
   */
  static v(name: string, defaultValue?: unknown): VarOperand {
    if (defaultValue !== undefined) {
      return { var: name, defaultValue };
    }
    return { var: name };
  }

  /**
   * Create a variable reference (alias for v)
   */
  static var(name: string, defaultValue?: unknown): VarOperand {
    return this.v(name, defaultValue);
  }

  /**
   * Create a literal array-of-strings value wrapper
   */
  static val(list: readonly string[]): ValOperand {
    return { val: [...list] };
  }

  /**
   * Create a reference to another expression
   */
  static ref(id: string): RefOperand {
    return { ref: id };
  }

  /**
   * Create a literal value wrapper
   */
  static literal(value: unknown): LiteralOperand {
    return { literal: value };
  }

  /**
   * Build an operation node with proper type safety
   */
  static op<K extends OperatorOption>(
    operator: K,
    ...args: OperationOperand[]
  ): Operation {
    if (args.length === 0) {
      throw new Error(`Operator '${operator}' requires at least one argument`);
    }

    if (args.length === 1) {
      return { [operator]: args[0] } as Operation;
    }

    return { [operator]: args } as Operation;
  }

  /**
   * Create operation from pre-built object
   */
  static raw(body: Operation): Operation {
    return { ...body };
  }

  // Math operations
  static add(...operands: OperationOperand[]): Operation {
    return this.op("+", ...operands);
  }

  static subtract(a: OperationOperand, b: OperationOperand): Operation {
    return this.op("-", a, b);
  }

  static multiply(...operands: OperationOperand[]): Operation {
    return this.op("*", ...operands);
  }

  static divide(a: OperationOperand, b: OperationOperand): Operation {
    return this.op("/", a, b);
  }

  static modulo(a: OperationOperand, b: OperationOperand): Operation {
    return this.op("%", a, b);
  }

  static power(base: OperationOperand, exponent: OperationOperand): Operation {
    return this.op("**", base, exponent);
  }

  static min(...operands: OperationOperand[]): Operation {
    return this.op("min", ...operands);
  }

  static max(...operands: OperationOperand[]): Operation {
    return this.op("max", ...operands);
  }

  static abs(operand: OperationOperand): Operation {
    return this.op("abs", operand);
  }

  static round(operand: OperationOperand): Operation {
    return this.op("round", operand);
  }

  static floor(operand: OperationOperand): Operation {
    return this.op("floor", operand);
  }

  static ceil(operand: OperationOperand): Operation {
    return this.op("ceil", operand);
  }

  // Comparison operations
  static eq(a: OperationOperand, b: OperationOperand): Operation {
    return this.op("==", a, b);
  }

  static strictEq(a: OperationOperand, b: OperationOperand): Operation {
    return this.op("===", a, b);
  }

  static neq(a: OperationOperand, b: OperationOperand): Operation {
    return this.op("!=", a, b);
  }

  static strictNeq(a: OperationOperand, b: OperationOperand): Operation {
    return this.op("!==", a, b);
  }

  static gt(a: OperationOperand, b: OperationOperand): Operation {
    return this.op(">", a, b);
  }

  static gte(a: OperationOperand, b: OperationOperand): Operation {
    return this.op(">=", a, b);
  }

  static lt(a: OperationOperand, b: OperationOperand): Operation {
    return this.op("<", a, b);
  }

  static lte(a: OperationOperand, b: OperationOperand): Operation {
    return this.op("<=", a, b);
  }

  // Logic operations
  static and(...operands: OperationOperand[]): Operation {
    return this.op("and", ...operands);
  }

  static or(...operands: OperationOperand[]): Operation {
    return this.op("or", ...operands);
  }

  static not(operand: OperationOperand): Operation {
    return this.op("not", operand);
  }

  static xor(a: OperationOperand, b: OperationOperand): Operation {
    return this.op("xor", a, b);
  }

  // Control flow
  static if(
    condition: OperationOperand,
    thenValue: OperationOperand,
    elseValue?: OperationOperand
  ): Operation {
    if (elseValue !== undefined) {
      return this.op("if", condition, thenValue, elseValue);
    }
    return this.op("if", condition, thenValue);
  }

  static switch(
    value: OperationOperand,
    cases: Record<string, OperationOperand>,
    defaultCase?: OperationOperand
  ): Operation {
    const args: OperationOperand[] = [value];

    for (const [caseValue, result] of Object.entries(cases)) {
      args.push(caseValue, result);
    }

    if (defaultCase !== undefined) {
      args.push(defaultCase);
    }

    return this.op("switch", ...args);
  }

  // Array operations
  static map(array: OperationOperand, callback: OperationOperand): Operation {
    return this.op("map", array, callback);
  }

  static filter(
    array: OperationOperand,
    predicate: OperationOperand
  ): Operation {
    return this.op("filter", array, predicate);
  }

  static reduce(
    array: OperationOperand,
    callback: OperationOperand,
    initial?: OperationOperand
  ): Operation {
    if (initial !== undefined) {
      return this.op("reduce", array, callback, initial);
    }
    return this.op("reduce", array, callback);
  }

  static find(array: OperationOperand, predicate: OperationOperand): Operation {
    return this.op("find", array, predicate);
  }

  static every(
    array: OperationOperand,
    predicate: OperationOperand
  ): Operation {
    return this.op("every", array, predicate);
  }

  static some(array: OperationOperand, predicate: OperationOperand): Operation {
    return this.op("some", array, predicate);
  }

  static includes(array: OperationOperand, value: OperationOperand): Operation {
    return this.op("includes", array, value);
  }

  static length(value: OperationOperand): Operation {
    return this.op("length", value);
  }

  static get(container: OperationOperand, key: OperationOperand): Operation {
    return this.op("get", container, key);
  }

  static slice(
    array: OperationOperand,
    start: OperationOperand,
    end?: OperationOperand
  ): Operation {
    if (end !== undefined) {
      return this.op("slice", array, start, end);
    }
    return this.op("slice", array, start);
  }

  // String operations
  static concat(...operands: OperationOperand[]): Operation {
    return this.op("concat", ...operands);
  }

  static substring(
    str: OperationOperand,
    start: OperationOperand,
    end?: OperationOperand
  ): Operation {
    if (end !== undefined) {
      return this.op("substring", str, start, end);
    }
    return this.op("substring", str, start);
  }

  static toLowerCase(str: OperationOperand): Operation {
    return this.op("toLowerCase", str);
  }

  static toUpperCase(str: OperationOperand): Operation {
    return this.op("toUpperCase", str);
  }

  static trim(str: OperationOperand): Operation {
    return this.op("trim", str);
  }

  static contains(
    str: OperationOperand,
    substring: OperationOperand
  ): Operation {
    return this.op("contains", str, substring);
  }

  static startsWith(
    str: OperationOperand,
    prefix: OperationOperand
  ): Operation {
    return this.op("startsWith", str, prefix);
  }

  static endsWith(str: OperationOperand, suffix: OperationOperand): Operation {
    return this.op("endsWith", str, suffix);
  }

  static replace(
    str: OperationOperand,
    search: OperationOperand,
    replacement: OperationOperand
  ): Operation {
    return this.op("replace", str, search, replacement);
  }

  static split(str: OperationOperand, separator: OperationOperand): Operation {
    return this.op("split", str, separator);
  }

  // Validation operations
  static isNull(value: OperationOperand): Operation {
    return this.op("isNull", value);
  }

  static isDefined(value: OperationOperand): Operation {
    return this.op("isDefined", value);
  }

  static isEmpty(value: OperationOperand): Operation {
    return this.op("isEmpty", value);
  }

  static isString(value: OperationOperand): Operation {
    return this.op("isString", value);
  }

  static isNumber(value: OperationOperand): Operation {
    return this.op("isNumber", value);
  }

  static isBoolean(value: OperationOperand): Operation {
    return this.op("isBoolean", value);
  }

  static isArray(value: OperationOperand): Operation {
    return this.op("isArray", value);
  }

  static isObject(value: OperationOperand): Operation {
    return this.op("isObject", value);
  }

  static isEmail(value: OperationOperand): Operation {
    return this.op("isEmail", value);
  }

  static isUrl(value: OperationOperand): Operation {
    return this.op("isUrl", value);
  }

  static matches(
    value: OperationOperand,
    pattern: OperationOperand
  ): Operation {
    return this.op("matches", value, pattern);
  }

  // Object operations
  static keys(obj: OperationOperand): Operation {
    return this.op("keys", obj);
  }

  static values(obj: OperationOperand): Operation {
    return this.op("values", obj);
  }

  static entries(obj: OperationOperand): Operation {
    return this.op("entries", obj);
  }

  static has(obj: OperationOperand, key: OperationOperand): Operation {
    return this.op("has", obj, key);
  }

  static merge(...objects: OperationOperand[]): Operation {
    return this.op("merge", ...objects);
  }

  // Date operations
  static now(): Operation {
    return this.op("now");
  }

  static date(value: OperationOperand): Operation {
    return this.op("date", value);
  }

  static format(date: OperationOperand, format: OperationOperand): Operation {
    return this.op("format", date, format);
  }

  static isBefore(date1: OperationOperand, date2: OperationOperand): Operation {
    return this.op("isBefore", date1, date2);
  }

  static isAfter(date1: OperationOperand, date2: OperationOperand): Operation {
    return this.op("isAfter", date1, date2);
  }

  // Utility functions
  static chain(...operations: Operation[]): Operation[] {
    return operations;
  }

  static compose(operations: Operation[]): Operation {
    if (operations.length === 0) {
      throw new Error("Cannot compose empty operations array");
    }

    if (operations.length === 1) {
      return operations[0]!;
    }

    return operations.reduce(
      (acc, op) => this.op("pipe", acc, op),
      operations[0]!
    );
  }

  /**
   * Create a nested operation builder pattern
   */
  static builder(): OpsBuilder {
    return {
      var: (name: string, defaultValue?: unknown) => this.v(name, defaultValue),
      val: (list: readonly string[]) => this.val(list),
      ref: (id: string) => this.ref(id),
      literal: (value: unknown) => this.literal(value),
      add: (...operands: OperationOperand[]) => this.add(...operands),
      subtract: (a: OperationOperand, b: OperationOperand) =>
        this.subtract(a, b),
      multiply: (...operands: OperationOperand[]) => this.multiply(...operands),
      divide: (a: OperationOperand, b: OperationOperand) => this.divide(a, b),
      eq: (a: OperationOperand, b: OperationOperand) => this.eq(a, b),
      gt: (a: OperationOperand, b: OperationOperand) => this.gt(a, b),
      lt: (a: OperationOperand, b: OperationOperand) => this.lt(a, b),
      and: (...operands: OperationOperand[]) => this.and(...operands),
      or: (...operands: OperationOperand[]) => this.or(...operands),
      not: (operand: OperationOperand) => this.not(operand),
      if: (
        condition: OperationOperand,
        thenValue: OperationOperand,
        elseValue?: OperationOperand
      ) => this.if(condition, thenValue, elseValue),
    };
  }
}
