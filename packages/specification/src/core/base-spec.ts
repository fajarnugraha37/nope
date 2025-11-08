import { asyncRequiredError } from "../utils/errors.js";
import { timeIt } from "../utils/timing.js";
import { isPromise, type MaybePromise } from "../utils/types.js";
import { SpecMemoizer } from "./memo.js";
import type {
  BaseSpecOptions,
  EvaluateHooks,
  ExplainNode,
  Specification,
  SpecContext,
  SpecMeta,
} from "./types.js";
import type { ValueHasher } from "./types.js";
import { evaluateSpec } from "./evaluate.js";

let anonymousCounter = 0;

const nextId = () => `spec_${++anonymousCounter}`;

export abstract class BaseSpec<TValue, Ctx extends SpecContext = SpecContext>
  implements Specification<TValue, Ctx>
{
  readonly id: string;
  readonly name?: string;
  readonly meta?: SpecMeta;
  private readonly hooks?: EvaluateHooks<TValue, Ctx>;
  private readonly memoizer?: SpecMemoizer<TValue>;

  protected constructor(id?: string, options?: BaseSpecOptions<TValue, Ctx>) {
    const meta = options?.meta ?? {};
    this.id = meta.id ?? id ?? nextId();
    this.name = meta.name;
    this.meta = { ...meta, id: this.id };
    this.hooks = options?.hooks;
    this.memoizer = options?.memoize ? new SpecMemoizer(options?.hasher as ValueHasher<TValue>) : undefined;
  }

  and(other: Specification<TValue, Ctx>): Specification<TValue, Ctx> {
    return createAllSpec([this, other]);
  }

  or(other: Specification<TValue, Ctx>): Specification<TValue, Ctx> {
    return createAnySpec([this, other]);
  }

  not(): Specification<TValue, Ctx> {
    return createNotSpec(this);
  }

  explain(value: TValue, ctx?: Ctx): ExplainNode {
    const node = this.describe(value, ctx);
    const timed = timeIt(() => this.run(value, ctx));
    if (isPromise(timed.result)) {
      return {
        ...node,
        pass: "unknown",
        reason: node.reason ?? "Asynchronous evaluation required for explanation",
      };
    }
    return {
      ...node,
      pass: timed.result,
      durationMs: timed.durationMs,
    };
  }

  isSatisfiedBy(value: TValue, ctx?: Ctx): boolean {
    const node = this.describe(value, ctx);
    this.hooks?.onEvaluateStart?.(node, value, ctx);
    const cached = this.memoizer?.get(value);
    if (typeof cached === "boolean") {
      this.hooks?.onEvaluateEnd?.(node, value, ctx, cached);
      return cached;
    }
    const verdict = this.run(value, ctx);
    if (isPromise(verdict)) {
      throw asyncRequiredError(this.id);
    }
    this.memoizer?.set(value, verdict);
    this.hooks?.onEvaluateEnd?.(node, value, ctx, verdict);
    return verdict;
  }

  isSatisfiedByAsync(value: TValue, ctx?: Ctx): Promise<boolean> {
    const node = this.describe(value, ctx);
    this.hooks?.onEvaluateStart?.(node, value, ctx);
    const cached = this.memoizer?.get(value);
    if (typeof cached === "boolean") {
      this.hooks?.onEvaluateEnd?.(node, value, ctx, cached);
      return Promise.resolve(cached);
    }

    return Promise.resolve(this.run(value, ctx)).then((verdict) => {
      this.memoizer?.set(value, verdict);
      this.hooks?.onEvaluateEnd?.(node, value, ctx, verdict);
      return verdict;
    });
  }

  protected abstract evaluate(value: TValue, ctx?: Ctx): MaybePromise<boolean>;

  protected describe(value: TValue, ctx?: Ctx): ExplainNode {
    return {
      id: this.id,
      name: this.name,
      pass: "unknown",
      meta: this.meta ? { ...this.meta } : undefined,
    };
  }

  private run(value: TValue, ctx?: Ctx): MaybePromise<boolean> {
    return this.evaluate(value, ctx);
  }
}

export const withMeta = <T, Ctx extends SpecContext>(
  spec: Specification<T, Ctx>,
  meta: SpecMeta,
): Specification<T, Ctx> => {
  if (spec instanceof BaseSpec) {
    (spec as any).meta = { ...spec.meta, ...meta };
    (spec as any).id = meta.id ?? spec.id;
    (spec as any).name = meta.name ?? spec.name;
  }
  return spec;
};

export type CompositeMode = "and" | "or" | "not";

export class CompositeSpec<TValue, Ctx extends SpecContext> extends BaseSpec<TValue, Ctx> {
  constructor(
    private readonly mode: CompositeMode,
    private readonly specs: Specification<TValue, Ctx>[],
    meta?: SpecMeta,
  ) {
    super(meta?.id, { meta });
  }

  get descriptor() {
    return { mode: this.mode, specs: [...this.specs] };
  }

  override explain(value: TValue, ctx?: Ctx): ExplainNode {
    const children = this.specs.map((spec) => spec.explain(value, ctx));
    const node = {
      id: this.id,
      name: this.name,
      pass: computeCompositeVerdict(this.mode, children),
      children,
      meta: this.meta,
    } as ExplainNode;
    return node;
  }

  protected evaluate(value: TValue, ctx?: Ctx): MaybePromise<boolean> {
    if (this.mode === "not") {
      return evaluateNegation(this.specs[0]!, value, ctx);
    }
    if (this.mode === "and") {
      return evaluateLogical(this.specs, value, ctx, "and");
    }
    return evaluateLogical(this.specs, value, ctx, "or");
  }
}

const evaluateNegation = <T, Ctx extends SpecContext>(
  spec: Specification<T, Ctx>,
  value: T,
  ctx?: Ctx,
): MaybePromise<boolean> => {
  const prefersAsync = Boolean(spec.isSatisfiedByAsync);
  if (!prefersAsync) {
    return !spec.isSatisfiedBy(value, ctx);
  }
  return Promise.resolve(spec.isSatisfiedByAsync?.(value, ctx)).then((result) => !result);
};

const evaluateLogical = <T, Ctx extends SpecContext>(
  specs: Specification<T, Ctx>[],
  value: T,
  ctx: Ctx | undefined,
  mode: "and" | "or",
): MaybePromise<boolean> => {
  const hasAsync = specs.some((spec) => typeof spec.isSatisfiedByAsync === "function");
  if (!hasAsync) {
    if (mode === "and") {
      return specs.every((spec) => spec.isSatisfiedBy(value, ctx));
    }
    return specs.some((spec) => spec.isSatisfiedBy(value, ctx));
  }

  return (async () => {
    for (const spec of specs) {
      const result = await evaluateSpec(spec, value, ctx);
      if (mode === "and" && !result) return false;
      if (mode === "or" && result) return true;
    }
    return mode === "and";
  })();
};

const computeCompositeVerdict = (mode: CompositeMode, children: ExplainNode[]): "unknown" | boolean => {
  const hasUnknown = children.some((child) => child.pass === "unknown");
  if (hasUnknown) {
    return "unknown";
  }
  if (mode === "and") {
    return children.every((child) => child.pass === true);
  }
  if (mode === "or") {
    return children.some((child) => child.pass === true);
  }
  const child = children[0];
  if (child && child.pass === "unknown") 
    return "unknown";
  return !child?.pass || "unknown";
};

export const createAllSpec = <T, Ctx extends SpecContext>(
  specs: Specification<T, Ctx>[],
  meta?: SpecMeta,
): Specification<T, Ctx> => new CompositeSpec("and", specs, meta);

export const createAnySpec = <T, Ctx extends SpecContext>(
  specs: Specification<T, Ctx>[],
  meta?: SpecMeta,
): Specification<T, Ctx> => new CompositeSpec("or", specs, meta);

export const createNotSpec = <T, Ctx extends SpecContext>(
  spec: Specification<T, Ctx>,
  meta?: SpecMeta,
): Specification<T, Ctx> => new CompositeSpec("not", [spec], meta);
