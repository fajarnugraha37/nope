import type { ValidationResult } from "@fajarnugraha37/common";

export type ValidatorFn = (data: unknown) => boolean;
export type validateExpressionFn = <T>(data: T) => ValidationResult<T>;
export type ValidateErrorGetter = () => unknown;

// Core expression schema with better typing
export interface ExpressionSchema {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly multipleOperations: CombinationOperator;
  readonly operations: readonly Operation[];
  readonly metadata?: ExpressionMetadata;
  readonly version?: string;
}

export interface ExpressionMetadata {
  readonly author?: string;
  readonly createdAt?: string; // ISO date-time string for JSON compatibility
  readonly updatedAt?: string; // ISO date-time string for JSON compatibility
  readonly tags?: readonly string[];
  readonly category?: string;
  readonly priority?: number;
}

export type CombinationOperator = "and" | "or";

// Enhanced operand types
export interface VarOperand {
  readonly var: string;
  readonly defaultValue?: unknown;
}

export interface ValOperand {
  readonly val: readonly string[];
}

export interface RefOperand {
  readonly ref: string; // Reference to another expression
}

export interface LiteralOperand {
  readonly literal: unknown;
}

export type ValueOperand = string | number | boolean | null | undefined | Date;

export type OperandOption =
  | VarOperand
  | ValOperand
  | RefOperand
  | LiteralOperand
  | ValueOperand;

// Enhanced operator categories
export type MathOperators =
  | "+"
  | "-"
  | "*"
  | "/"
  | "%"
  | "**" // power
  | "min"
  | "max"
  | "abs"
  | "round"
  | "floor"
  | "ceil"
  | "sqrt"
  | "log"
  | "sin"
  | "cos"
  | "tan";

export type LogicOperators =
  | ">"
  | ">="
  | "<"
  | "<="
  | "not"
  | "!"
  | "!!"
  | "and"
  | "or"
  | "xor"
  | "??" // nullish coalescing
  | "=="
  | "==="
  | "!="
  | "!=="
  | "if"
  | "?:"
  | "switch"
  | "case";

export type StringOperators =
  | "cat"
  | "concat"
  | "join"
  | "in"
  | "contains"
  | "startsWith"
  | "endsWith"
  | "substr"
  | "substring"
  | "slice"
  | "length"
  | "trim"
  | "toLowerCase"
  | "toUpperCase"
  | "replace"
  | "replaceAll"
  | "split"
  | "match"
  | "test" // regex operations
  | "pad"
  | "padStart"
  | "padEnd";

export type ArrayOperators =
  | "in"
  | "contains"
  | "includes"
  | "merge"
  | "concat"
  | "join"
  | "length"
  | "count"
  | "size"
  | "get"
  | "at"
  | "first"
  | "last"
  | "push"
  | "pop"
  | "shift"
  | "unshift"
  | "slice"
  | "splice"
  | "reverse"
  | "sort"
  | "unique"
  | "flatten"
  | "groupBy"
  | "partition";

export type ObjectOperators =
  | "get"
  | "set"
  | "has"
  | "delete"
  | "keys"
  | "values"
  | "entries"
  | "assign"
  | "merge"
  | "pick"
  | "omit"
  | "clone"
  | "deepClone";

export type DateOperators =
  | "now"
  | "today"
  | "date"
  | "year"
  | "month"
  | "day"
  | "hour"
  | "minute"
  | "second"
  | "addYears"
  | "addMonths"
  | "addDays"
  | "addHours"
  | "format"
  | "parse"
  | "isValid"
  | "isBefore"
  | "isAfter"
  | "isSame"
  | "diff"
  | "duration";

export type ValidationOperators =
  | "isNull"
  | "isUndefined"
  | "isDefined"
  | "isEmpty"
  | "isString"
  | "isNumber"
  | "isBoolean"
  | "isArray"
  | "isObject"
  | "isEmail"
  | "isUrl"
  | "isUuid"
  | "isJson"
  | "matches"
  | "validate"
  | "assert";

export type ContextOperators =
  | "var"
  | "val"
  | "ref"
  | "literal"
  | "exists"
  | "missing"
  | "missing_some"
  | "context"
  | "scope"
  | "env"
  | "cache"
  | "memo";

export type HigherOrderOperators =
  | "map"
  | "filter"
  | "reduce"
  | "find"
  | "findIndex"
  | "every"
  | "all"
  | "some"
  | "none"
  | "forEach"
  | "eachKey"
  | "eachValue"
  | "pipe"
  | "compose"
  | "curry"
  | "debounce"
  | "throttle";

export type ControlFlowOperators =
  | "if"
  | "ifElse"
  | "unless"
  | "when"
  | "switch"
  | "case"
  | "default"
  | "try"
  | "catch"
  | "finally"
  | "loop"
  | "while"
  | "until"
  | "for"
  | "break"
  | "continue"
  | "return";

export type AsyncOperators =
  | "await"
  | "promise"
  | "resolve"
  | "reject"
  | "timeout"
  | "delay"
  | "race"
  | "all"
  | "allSettled"
  | "retry"
  | "fallback";

export type OperatorOption =
  | MathOperators
  | LogicOperators
  | StringOperators
  | ArrayOperators
  | ObjectOperators
  | DateOperators
  | ValidationOperators
  | ContextOperators
  | HigherOrderOperators
  | ControlFlowOperators
  | AsyncOperators;

// Enhanced operation types
export type OperationOperand = Operation | OperandOption;

export type Operation = Partial<{
  readonly [K in OperatorOption]:
    | OperationOperand
    | readonly OperationOperand[];
}>;

// Execution context
export interface ExecutionContext {
  readonly data: unknown;
  readonly variables?: Record<string, unknown>;
  readonly functions?: Record<string, Function>;
  readonly metadata?: Record<string, unknown>;
  readonly parent?: ExecutionContext;
}

// Result types
export interface ExecutionResult<T = unknown> {
  readonly value: T;
  readonly success: boolean;
  readonly error?: Error;
  readonly metadata?: ExecutionMetadata;
}

export interface ExecutionMetadata {
  readonly duration: number;
  readonly operations: number;
  readonly cacheHits: number;
  readonly cacheMisses: number;
  readonly depth: number;
}

// Configuration types
export interface EvaluatorConfig {
  readonly cache?: CacheConfig;
  readonly timeout?: number;
  readonly maxDepth?: number;
  readonly strictMode?: boolean;
  readonly asyncMode?: boolean;
  readonly debug?: boolean;
}

export interface CacheConfig {
  readonly maxEntries?: number;
  readonly maxSize?: number;
  readonly ttl?: number;
  readonly sweepInterval?: number;
}

// Utility types
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Legacy compatibility (with typo)
/** @deprecated Use ExpressionSchema instead */
export type ExperssionSchema = ExpressionSchema;
