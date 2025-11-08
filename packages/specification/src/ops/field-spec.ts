import { BaseSpec } from "../core/base-spec.js";
import type { SpecContext, SpecMeta } from "../core/types.js";
import type { ExplainNode } from "../core/types.js";
import { getPath } from "../utils/get-path.js";
import type { MaybePromise } from "../utils/types.js";

export interface FieldOperatorInput {
  path: string;
  value?: unknown;
  values?: unknown[];
  pattern?: string;
  flags?: string;
  min?: number;
  max?: number;
  [key: string]: unknown;
}

export interface FieldSpecOptions<T, Ctx extends SpecContext> {
  kind: string;
  path: string;
  reason?: string;
  meta?: SpecMeta;
  input?: FieldOperatorInput;
  predicate(value: unknown, root: T, ctx?: Ctx): MaybePromise<boolean>;
}

export class FieldSpec<T, Ctx extends SpecContext> extends BaseSpec<T, Ctx> {
  private readonly kind: string;
  private readonly path: string;
  private readonly reason?: string;
  private readonly predicate: FieldSpecOptions<T, Ctx>["predicate"];
  private readonly input?: FieldOperatorInput;

  constructor(options: FieldSpecOptions<T, Ctx>) {
    super(undefined, { meta: options.meta });
    this.kind = options.kind;
    this.path = options.path;
    this.reason = options.reason;
    this.predicate = options.predicate;
    this.input = options.input;
  }

  protected evaluate(value: T, ctx?: Ctx): MaybePromise<boolean> {
    const actual = getPath(value as Record<string, unknown>, this.path);
    return this.predicate(actual, value, ctx);
  }

  protected override describe(value: T, ctx?: Ctx): ExplainNode {
    const actual = getPath(value as Record<string, unknown>, this.path);
    const expected = this.input?.value ?? this.input?.values ?? this.input?.pattern ?? this.input?.min ?? this.input?.max;
    
    return {
      id: this.id,
      name: this.name,
      pass: "unknown",
      path: this.path,
      reason: this.reason,
      operator: this.kind,
      actualValue: actual,
      expectedValue: expected,
      meta: {
        kind: this.kind,
        ...this.input,
        ...this.meta,
      },
    };
  }

  toJSON(): Record<string, unknown> {
    return {
      kind: this.kind,
      path: this.path,
      input: this.input,
    };
  }
}
