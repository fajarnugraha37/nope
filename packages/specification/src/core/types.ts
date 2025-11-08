import type { JsonValue } from "../utils/types.js";

export type Verdict = true | false | "unknown";

export interface SpecContext {
  [key: string]: unknown;
}

export interface ExplainNode {
  id: string;
  name?: string;
  pass: boolean | "unknown";
  path?: string;
  reason?: string;
  meta?: Record<string, unknown>;
  children?: ExplainNode[];
  durationMs?: number;
}

export interface Specification<T, Ctx extends SpecContext = SpecContext> {
  readonly id: string;
  readonly name?: string;
  isSatisfiedBy(value: T, ctx?: Ctx): boolean;
  isSatisfiedByAsync?(value: T, ctx?: Ctx): Promise<boolean>;
  explain(value: T, ctx?: Ctx): ExplainNode;
  and(other: Specification<T, Ctx>): Specification<T, Ctx>;
  or(other: Specification<T, Ctx>): Specification<T, Ctx>;
  not(): Specification<T, Ctx>;
}

export interface Operator<
  I = unknown,
  T = unknown,
  Ctx extends SpecContext = SpecContext,
> {
  readonly kind: string;
  create(input: I): Specification<T, Ctx>;
}

export interface Plugin {
  name: string;
  version: string;
  register(registry: Registry): void;
}

export interface Registry {
  addOperator(operator: Operator): void;
  addSpec<T, Ctx extends SpecContext = SpecContext>(
    factory: (args: unknown) => Specification<T, Ctx>,
    meta?: SpecMeta,
  ): void;
  getOperator(kind: string): Operator | undefined;
  getSpec<T, Ctx extends SpecContext = SpecContext>(id: string): Specification<T, Ctx> | undefined;
}

export type Ast =
  | { type: "op"; kind: string; input: JsonValue }
  | { type: "not"; node: Ast }
  | { type: "and"; nodes: Ast[] }
  | { type: "or"; nodes: Ast[] }
  | { type: "ref"; id: string };

export interface SpecMeta {
  id?: string;
  name?: string;
  tags?: string[];
  version?: string;
  owner?: string;
}

export interface EvaluateHooks<T = unknown, Ctx extends SpecContext = SpecContext> {
  onEvaluateStart?(node: ExplainNode, value: T, ctx?: Ctx): void;
  onEvaluateEnd?(node: ExplainNode, value: T, ctx: Ctx | undefined, pass: Verdict): void;
}

export interface BaseSpecOptions<T, Ctx extends SpecContext> {
  meta?: SpecMeta;
  hooks?: EvaluateHooks<T, Ctx>;
  memoize?: boolean;
  hasher?: ValueHasher<T>;
}

export type ValueHasher<T> = (value: T) => string;

export interface HumanizerTemplateInput {
  id: string;
  kind: string;
  path?: string;
  meta?: SpecMeta;
  input?: JsonValue;
}
