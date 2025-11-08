import type { Operator } from "../core/types.js";
import type { FieldOperatorInput } from "./field-spec.js";
import { createFieldOperator } from "./factory.js";

const comparisonReason = (label: string) => (input: FieldOperatorInput) =>
  `{${input.path}} must be ${label} ${input.value}`;

const lengthReason = (label: string) => (input: FieldOperatorInput) =>
  `{${input.path}} length must be ${label} ${input.value}`;

const eq = createFieldOperator({
  kind: "eq",
  reason: comparisonReason("equal to"),
  predicate: ({ actual, input }) => actual === input.value,
});

const ne = createFieldOperator({
  kind: "ne",
  reason: comparisonReason("not equal to"),
  predicate: ({ actual, input }) => actual !== input.value,
});

const lt = createFieldOperator({
  kind: "lt",
  reason: comparisonReason("less than"),
  predicate: ({ actual, input }) =>
    typeof actual === "number" && typeof input.value === "number" && actual < (input.value as number),
});

const lte = createFieldOperator({
  kind: "lte",
  reason: comparisonReason("less than or equal to"),
  predicate: ({ actual, input }) =>
    typeof actual === "number" && typeof input.value === "number" && actual <= (input.value as number),
});

const gt = createFieldOperator({
  kind: "gt",
  reason: comparisonReason("greater than"),
  predicate: ({ actual, input }) =>
    typeof actual === "number" && typeof input.value === "number" && actual > (input.value as number),
});

const gte = createFieldOperator({
  kind: "gte",
  reason: comparisonReason("greater than or equal to"),
  predicate: ({ actual, input }) =>
    typeof actual === "number" && typeof input.value === "number" && actual >= (input.value as number),
});

const within = createFieldOperator({
  kind: "in",
  reason: (input) => `{${input.path}} must be within [${(input.values ?? []).join(", ")}]`,
  predicate: ({ actual, input }) => (input.values ?? []).some((value) => value === actual),
});

const notIn = createFieldOperator({
  kind: "notIn",
  reason: (input) => `{${input.path}} must not be within [${(input.values ?? []).join(", ")}]`,
  predicate: ({ actual, input }) => !(input.values ?? []).some((value) => value === actual),
});

const exists = createFieldOperator({
  kind: "exists",
  reason: (input) => `{${input.path}} must exist`,
  predicate: ({ actual }) => actual !== undefined && actual !== null,
});

const missing = createFieldOperator({
  kind: "missing",
  reason: (input) => `{${input.path}} must be missing`,
  predicate: ({ actual }) => actual === undefined || actual === null,
});

const regex = createFieldOperator({
  kind: "regex",
  reason: (input) => `{${input.path}} must match /${input.pattern}/${input.flags ?? ""}`,
  predicate: ({ actual, input }) => {
    if (typeof actual !== "string" || !input.pattern) return false;
    try {
      const flags = input.flags ?? "";
      const exp = new RegExp(input.pattern, flags);
      return exp.test(actual);
    } catch {
      return false;
    }
  },
});

const startsWith = createFieldOperator({
  kind: "startsWith",
  reason: (input) => `{${input.path}} must start with ${input.value}`,
  predicate: ({ actual, input }) => typeof actual === "string" && actual.startsWith(String(input.value ?? "")),
});

const endsWith = createFieldOperator({
  kind: "endsWith",
  reason: (input) => `{${input.path}} must end with ${input.value}`,
  predicate: ({ actual, input }) => typeof actual === "string" && actual.endsWith(String(input.value ?? "")),
});

const contains = createFieldOperator({
  kind: "contains",
  reason: (input) => `{${input.path}} must contain ${input.value}`,
  predicate: ({ actual, input }) =>
    (typeof actual === "string" && actual.includes(String(input.value ?? ""))) ||
    (Array.isArray(actual) && actual.includes(input.value)),
});

const lengthEq = createFieldOperator({
  kind: "lengthEq",
  reason: lengthReason("equal to"),
  predicate: ({ actual, input }) => getLength(actual) === input.value,
});

const lengthLt = createFieldOperator({
  kind: "lengthLt",
  reason: lengthReason("less than"),
  predicate: ({ actual, input }) => compareLength(actual, input.value, (l, v) => l < v),
});

const lengthLte = createFieldOperator({
  kind: "lengthLte",
  reason: lengthReason("less than or equal to"),
  predicate: ({ actual, input }) => compareLength(actual, input.value, (l, v) => l <= v),
});

const lengthGt = createFieldOperator({
  kind: "lengthGt",
  reason: lengthReason("greater than"),
  predicate: ({ actual, input }) => compareLength(actual, input.value, (l, v) => l > v),
});

const lengthGte = createFieldOperator({
  kind: "lengthGte",
  reason: lengthReason("greater than or equal to"),
  predicate: ({ actual, input }) => compareLength(actual, input.value, (l, v) => l >= v),
});

const getLength = (value: unknown): number | undefined => {
  if (typeof value === "string" || Array.isArray(value)) return value.length;
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).length;
  }
  return undefined;
};

const compareLength = (
  actual: unknown,
  expected: unknown,
  predicate: (length: number, value: number) => boolean,
): boolean => {
  const length = getLength(actual);
  if (length == null || typeof expected !== "number") return false;
  return predicate(length, expected);
};

export const builtInOperators: Operator[] = [
  eq,
  ne,
  lt,
  lte,
  gt,
  gte,
  within,
  notIn,
  exists,
  missing,
  regex,
  startsWith,
  endsWith,
  contains,
  lengthEq,
  lengthLt,
  lengthLte,
  lengthGt,
  lengthGte,
];
