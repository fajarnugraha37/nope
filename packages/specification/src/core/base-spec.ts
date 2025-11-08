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

/**
 * Base class for all specifications in the system.
 * 
 * Provides common functionality for specification evaluation including:
 * - Synchronous and asynchronous evaluation
 * - Memoization support for performance optimization
 * - Explain tree generation for debugging
 * - Lifecycle hooks for evaluation events
 * - Combinators (and, or, not)
 * 
 * @typeParam TValue - The type of value this specification evaluates
 * @typeParam Ctx - The context type (defaults to SpecContext)
 * 
 * @example
 * ```typescript
 * class AgeSpec extends BaseSpec<{ age: number }> {
 *   protected evaluate(value: { age: number }): boolean {
 *     return value.age >= 18;
 *   }
 * }
 * 
 * const spec = new AgeSpec();
 * spec.isSatisfiedBy({ age: 25 }); // true
 * ```
 */
export abstract class BaseSpec<TValue, Ctx extends SpecContext = SpecContext>
  implements Specification<TValue, Ctx>
{
  /** Unique identifier for this specification */
  readonly id: string;
  /** Human-readable name for this specification */
  readonly name?: string;
  /** Additional metadata (tags, version, owner, etc.) */
  readonly meta?: SpecMeta;
  private readonly hooks?: EvaluateHooks<TValue, Ctx>;
  private readonly memoizer?: SpecMemoizer<TValue>;

  /**
   * Creates a new specification instance.
   * 
   * @param id - Optional unique identifier (auto-generated if not provided)
   * @param options - Configuration options
   * @param options.meta - Metadata including id, name, tags, version, owner
   * @param options.hooks - Lifecycle hooks for evaluation events
   * @param options.memoize - Enable memoization for repeated evaluations
   * @param options.hasher - Custom hash function for memoization keys
   */
  protected constructor(id?: string, options?: BaseSpecOptions<TValue, Ctx>) {
    const meta = options?.meta ?? {};
    this.id = meta.id ?? id ?? nextId();
    this.name = meta.name;
    this.meta = { ...meta, id: this.id };
    this.hooks = options?.hooks;
    this.memoizer = options?.memoize ? new SpecMemoizer(options?.hasher as ValueHasher<TValue>) : undefined;
  }

  /**
   * Combines this specification with another using AND logic.
   * Both specifications must be satisfied for the result to pass.
   * 
   * @param other - The specification to combine with
   * @returns A new composite specification
   * 
   * @example
   * ```typescript
   * const ageSpec = spec.field("age").gte(18);
   * const nameSpec = spec.field("name").exists();
   * const combined = ageSpec.and(nameSpec);
   * ```
   */
  and(other: Specification<TValue, Ctx>): Specification<TValue, Ctx> {
    return createAllSpec([this, other]);
  }

  /**
   * Combines this specification with another using OR logic.
   * Either specification can be satisfied for the result to pass.
   * 
   * @param other - The specification to combine with
   * @returns A new composite specification
   * 
   * @example
   * ```typescript
   * const adminSpec = spec.field("role").eq("admin");
   * const ownerSpec = spec.field("role").eq("owner");
   * const hasAccess = adminSpec.or(ownerSpec);
   * ```
   */
  or(other: Specification<TValue, Ctx>): Specification<TValue, Ctx> {
    return createAnySpec([this, other]);
  }

  /**
   * Negates this specification using NOT logic.
   * The result passes when this specification fails.
   * 
   * @returns A new negated specification
   * 
   * @example
   * ```typescript
   * const activeSpec = spec.field("status").eq("active");
   * const inactiveSpec = activeSpec.not();
   * ```
   */
  not(): Specification<TValue, Ctx> {
    return createNotSpec(this);
  }

  /**
   * Generates an explanation tree for why this specification passed or failed.
   * 
   * **Important**: For synchronous evaluation only. If the specification requires
   * async evaluation, returns a node with `pass: "unknown"`. Use `explainAsync`
   * for accurate async explanations.
   * 
   * @param value - The value to evaluate
   * @param ctx - Optional context for evaluation
   * @returns An explain tree with pass/fail status and timing
   * 
   * @example
   * ```typescript
   * const spec = spec.field("age").gte(18);
   * const node = spec.explain({ age: 15 });
   * // node.pass === false
   * // node.reason === "age (15) must be >= 18"
   * ```
   */
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

  /**
   * Asynchronously generates an explanation tree with accurate timing.
   * 
   * Use this method when the specification involves async evaluation
   * to get accurate pass/fail results and timing information.
   * 
   * @param value - The value to evaluate
   * @param ctx - Optional context for evaluation
   * @returns Promise resolving to an explain tree
   * 
   * @example
   * ```typescript
   * const spec = spec.field("userId").custom(async (id) => {
   *   return await db.users.exists(id);
   * });
   * const node = await spec.explainAsync({ userId: "123" });
   * ```
   */
  async explainAsync(value: TValue, ctx?: Ctx): Promise<ExplainNode> {
    const node = this.describe(value, ctx);
    const start = performance.now();
    const result = await Promise.resolve(this.run(value, ctx));
    const durationMs = performance.now() - start;
    return {
      ...node,
      pass: result,
      durationMs,
    };
  }

  /**
   * Evaluates whether the value satisfies this specification synchronously.
   * 
   * **Throws**: SpecificationError if async evaluation is required.
   * Use `isSatisfiedByAsync` for specifications that require async evaluation.
   * 
   * Supports memoization when enabled via constructor options.
   * Triggers evaluation lifecycle hooks if configured.
   * 
   * @param value - The value to evaluate
   * @param ctx - Optional context for evaluation
   * @returns true if the specification is satisfied, false otherwise
   * @throws {SpecificationError} If async evaluation is required
   * 
   * @example
   * ```typescript
   * const spec = spec.field("age").gte(18);
   * const isValid = spec.isSatisfiedBy({ age: 25 }); // true
   * ```
   */
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

  /**
   * Asynchronously evaluates whether the value satisfies this specification.
   * 
   * Supports both sync and async specifications. Always returns a Promise.
   * Supports memoization when enabled via constructor options.
   * Triggers evaluation lifecycle hooks if configured.
   * 
   * @param value - The value to evaluate
   * @param ctx - Optional context for evaluation
   * @returns Promise resolving to true if satisfied, false otherwise
   * 
   * @example
   * ```typescript
   * const spec = spec.field("email").custom(async (email) => {
   *   return await isEmailUnique(email);
   * });
   * const isValid = await spec.isSatisfiedByAsync({ email: "user@example.com" });
   * ```
   */
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

  /**
   * Core evaluation logic to be implemented by subclasses.
   * 
   * Can return either a boolean (sync) or Promise<boolean> (async).
   * Called internally by `isSatisfiedBy` and `isSatisfiedByAsync`.
   * 
   * @param value - The value to evaluate
   * @param ctx - Optional context for evaluation
   * @returns Boolean or Promise<boolean> indicating satisfaction
   */
  protected abstract evaluate(value: TValue, ctx?: Ctx): MaybePromise<boolean>;

  /**
   * Generates the base explain node structure.
   * 
   * Override this method to provide custom explain metadata.
   * Called by `explain` and `explainAsync` before evaluation.
   * 
   * @param value - The value being evaluated
   * @param ctx - Optional context for evaluation
   * @returns Base explain node with id, name, and metadata
   */
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

/**
 * Attaches or updates metadata on an existing specification.
 * 
 * Mutates the spec's metadata fields (id, name, meta).
 * Useful for adding metadata to specs after construction.
 * 
 * @param spec - The specification to update
 * @param meta - Metadata to attach (merged with existing)
 * @returns The same specification instance (mutated)
 * 
 * @example
 * ```typescript
 * const spec = spec.field("age").gte(18);
 * withMeta(spec, { name: "Adult Check", tags: ["age", "validation"] });
 * ```
 */
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

/**
 * A specification that combines multiple specifications using boolean logic.
 * 
 * Supports three modes:
 * - **and**: All child specs must pass (short-circuits on first failure)
 * - **or**: At least one child spec must pass (short-circuits on first success)
 * - **not**: Negates a single child spec
 * 
 * Handles both synchronous and asynchronous evaluation.
 * Generates explain trees with nested children for debugging.
 * 
 * @typeParam TValue - The type of value this specification evaluates
 * @typeParam Ctx - The context type (defaults to SpecContext)
 * 
 * @example
 * ```typescript
 * // Created via combinators
 * const spec = all([
 *   spec.field("age").gte(18),
 *   spec.field("status").eq("active")
 * ]);
 * ```
 */
export class CompositeSpec<TValue, Ctx extends SpecContext> extends BaseSpec<TValue, Ctx> {
  constructor(
    private readonly mode: CompositeMode,
    private readonly specs: Specification<TValue, Ctx>[],
    meta?: SpecMeta,
  ) {
    super(meta?.id, { meta });
  }

  /**
   * Returns the composite structure (mode and child specifications).
   * 
   * @returns Object containing mode and a copy of child specs array
   */
  get descriptor() {
    return { mode: this.mode, specs: [...this.specs] };
  }

  override explain(value: TValue, ctx?: Ctx): ExplainNode {
    const children = this.specs.map((spec) => {
      const childNode = spec.explain(value, ctx);
      // Propagate parent path if this is a nested composite
      if (childNode.path && !childNode.parentPath) {
        return { ...childNode, parentPath: childNode.path };
      }
      return childNode;
    });
    const node = {
      id: this.id,
      name: this.name,
      pass: computeCompositeVerdict(this.mode, children),
      children,
      meta: this.meta as Record<string, unknown> | undefined,
      operator: this.mode,
    } as ExplainNode;
    return node;
  }

  override async explainAsync(value: TValue, ctx?: Ctx): Promise<ExplainNode> {
    const start = performance.now();
    const children = await Promise.all(
      this.specs.map(async (spec) => {
        const childNode = spec.explainAsync 
          ? await spec.explainAsync(value, ctx) 
          : spec.explain(value, ctx);
        // Propagate parent path if this is a nested composite
        if (childNode.path && !childNode.parentPath) {
          return { ...childNode, parentPath: childNode.path };
        }
        return childNode;
      })
    );
    const durationMs = performance.now() - start;
    
    return {
      id: this.id,
      name: this.name,
      pass: computeCompositeVerdict(this.mode, children),
      children,
      meta: this.meta as Record<string, unknown> | undefined,
      operator: this.mode,
      durationMs,
    };
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

/**
 * Creates a composite specification that requires ALL child specs to pass (AND logic).
 * 
 * Short-circuits evaluation: stops on the first failing spec.
 * Works with both sync and async specifications.
 * 
 * @param specs - Array of specifications to combine
 * @param meta - Optional metadata for the composite spec
 * @returns A new composite specification
 * 
 * @example
 * ```typescript
 * const spec = createAllSpec([
 *   spec.field("age").gte(18),
 *   spec.field("email").exists(),
 *   spec.field("status").eq("active")
 * ]);
 * ```
 */
export const createAllSpec = <T, Ctx extends SpecContext>(
  specs: Specification<T, Ctx>[],
  meta?: SpecMeta,
): Specification<T, Ctx> => new CompositeSpec("and", specs, meta);

/**
 * Creates a composite specification that requires ANY child spec to pass (OR logic).
 * 
 * Short-circuits evaluation: stops on the first passing spec.
 * Works with both sync and async specifications.
 * 
 * @param specs - Array of specifications to combine
 * @param meta - Optional metadata for the composite spec
 * @returns A new composite specification
 * 
 * @example
 * ```typescript
 * const spec = createAnySpec([
 *   spec.field("role").eq("admin"),
 *   spec.field("role").eq("moderator"),
 *   spec.field("permissions").contains("manage_users")
 * ]);
 * ```
 */
export const createAnySpec = <T, Ctx extends SpecContext>(
  specs: Specification<T, Ctx>[],
  meta?: SpecMeta,
): Specification<T, Ctx> => new CompositeSpec("or", specs, meta);

/**
 * Creates a composite specification that negates a child spec (NOT logic).
 * 
 * The result passes when the child spec fails.
 * Works with both sync and async specifications.
 * 
 * @param spec - The specification to negate
 * @param meta - Optional metadata for the composite spec
 * @returns A new negated specification
 * 
 * @example
 * ```typescript
 * const spec = createNotSpec(
 *   spec.field("status").eq("deleted")
 * );
 * // Passes when status is NOT "deleted"
 * ```
 */
export const createNotSpec = <T, Ctx extends SpecContext>(
  spec: Specification<T, Ctx>,
  meta?: SpecMeta,
): Specification<T, Ctx> => new CompositeSpec("not", [spec], meta);
