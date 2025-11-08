import type { JsonValue } from "../utils/types.js";

/**
 * Represents the evaluation result of a specification.
 * 
 * - `true`: The specification is satisfied
 * - `false`: The specification is not satisfied
 * - `"unknown"`: The result cannot be determined (async evaluation needed)
 */
export type Verdict = true | false | "unknown";

/**
 * Context object passed during specification evaluation.
 * 
 * Can contain any additional data needed for evaluation:
 * - User session information
 * - Database connections
 * - Feature flags
 * - Request metadata
 * 
 * @example
 * ```typescript
 * interface MyContext extends SpecContext {
 *   userId: string;
 *   roles: string[];
 *   featureFlags: Record<string, boolean>;
 * }
 * ```
 */
export interface SpecContext {
  [key: string]: unknown;
}

/**
 * Node in an explain tree that describes why a specification passed or failed.
 * 
 * Contains rich debugging information including:
 * - Pass/fail status
 * - Evaluation timing
 * - Expected vs actual values
 * - Nested children for composite specs
 * - Path context for field specifications
 * 
 * @example
 * ```typescript
 * {
 *   id: "age_check",
 *   name: "Age Validation",
 *   pass: false,
 *   operator: "gte",
 *   expectedValue: 18,
 *   actualValue: 15,
 *   path: "user.age",
 *   reason: "user.age (15) must be >= 18",
 *   durationMs: 0.045
 * }
 * ```
 */
export interface ExplainNode {
  /** Unique identifier of the specification */
  id: string;
  /** Human-readable name */
  name?: string;
  /** Whether the specification passed, failed, or is unknown */
  pass: boolean | "unknown";
  /** Field path for field specifications (e.g., "user.email") */
  path?: string;
  /** Human-readable explanation of the result */
  reason?: string;
  /** Additional metadata */
  meta?: Record<string, unknown>;
  /** Child nodes for composite specifications */
  children?: ExplainNode[];
  /** Evaluation time in milliseconds */
  durationMs?: number;
  /** Operator used (e.g., "gte", "eq", "contains") */
  operator?: string;
  /** Expected value for comparison operators */
  expectedValue?: unknown;
  /** Actual value that was evaluated */
  actualValue?: unknown;
  /** Full path from root for nested objects */
  parentPath?: string;
}

/**
 * Core interface for all specifications in the system.
 * 
 * Specifications are immutable objects that evaluate values and can be combined
 * using boolean logic (and, or, not).
 * 
 * @typeParam T - The type of value to evaluate
 * @typeParam Ctx - The context type (defaults to SpecContext)
 * 
 * @example
 * ```typescript
 * const ageSpec: Specification<{ age: number }> = 
 *   spec.field("age").gte(18);
 *   
 * ageSpec.isSatisfiedBy({ age: 25 }); // true
 * ageSpec.isSatisfiedBy({ age: 15 }); // false
 * ```
 */
export interface Specification<T, Ctx extends SpecContext = SpecContext> {
  /** Unique identifier */
  readonly id: string;
  /** Human-readable name */
  readonly name?: string;
  /** Evaluates the value synchronously (throws if async required) */
  isSatisfiedBy(value: T, ctx?: Ctx): boolean;
  /** Evaluates the value asynchronously (supports both sync and async specs) */
  isSatisfiedByAsync?(value: T, ctx?: Ctx): Promise<boolean>;
  /** Generates an explain tree (synchronous, may return "unknown" for async specs) */
  explain(value: T, ctx?: Ctx): ExplainNode;
  /** Generates an explain tree asynchronously with accurate results */
  explainAsync?(value: T, ctx?: Ctx): Promise<ExplainNode>;
  /** Combines with another spec using AND logic */
  and(other: Specification<T, Ctx>): Specification<T, Ctx>;
  /** Combines with another spec using OR logic */
  or(other: Specification<T, Ctx>): Specification<T, Ctx>;
  /** Negates this spec using NOT logic */
  not(): Specification<T, Ctx>;
}

/**
 * Factory for creating specifications from input parameters.
 * 
 * Operators are registered in a Registry and can be invoked by name
 * (e.g., "eq", "gte", "contains") to create specifications.
 * 
 * @typeParam I - The input type (operator-specific parameters)
 * @typeParam T - The value type that the created spec will evaluate
 * @typeParam Ctx - The context type
 * 
 * @example
 * ```typescript
 * const gteOperator: Operator<number, { age: number }> = {
 *   kind: "gte",
 *   create: (threshold) => new GteSpec("age", threshold)
 * };
 * 
 * const spec = gteOperator.create(18);
 * ```
 */
export interface Operator<
  I = unknown,
  T = unknown,
  Ctx extends SpecContext = SpecContext,
> {
  /** Unique operator identifier (e.g., "eq", "gte", "contains") */
  readonly kind: string;
  /** Creates a specification from input parameters */
  create(input: I): Specification<T, Ctx>;
}

/**
 * Plugin that registers custom operators and specifications.
 * 
 * Plugins provide a clean way to extend the specification system
 * with domain-specific operators (e.g., geospatial, time-based).
 * 
 * @example
 * ```typescript
 * const geoPlugin: Plugin = {
 *   name: "geo-plugin",
 *   version: "1.0.0",
 *   register: (registry) => {
 *     registry.addOperator(withinRadiusOperator);
 *     registry.addOperator(withinBoundsOperator);
 *   }
 * };
 * 
 * geoPlugin.register(myRegistry);
 * ```
 */
export interface Plugin {
  /** Plugin name */
  name: string;
  /** Semantic version */
  version: string;
  /** Registration callback to add operators/specs */
  register(registry: Registry): void;
}

/**
 * Central registry for operators and reusable specifications.
 * 
 * Manages the catalog of available operators and named specifications.
 * Prevents duplicate registrations and provides lookup by name.
 * 
 * @example
 * ```typescript
 * const registry = createRegistry({
 *   operators: builtInOperators
 * });
 * 
 * geoPlugin.register(registry);
 * 
 * const eqOp = registry.getOperator("eq");
 * const spec = eqOp?.create({ path: "status", value: "active" });
 * ```
 */
export interface Registry {
  /** Registers a new operator (throws if already registered) */
  addOperator(operator: Operator): void;
  /** Registers a reusable spec factory with metadata */
  addSpec<T, Ctx extends SpecContext = SpecContext>(
    factory: (args: unknown) => Specification<T, Ctx>,
    meta?: SpecMeta,
  ): void;
  /** Retrieves an operator by kind (returns undefined if not found) */
  getOperator(kind: string): Operator | undefined;
  /** Retrieves a spec by id (returns undefined if not found) */
  getSpec<T, Ctx extends SpecContext = SpecContext>(id: string): Specification<T, Ctx> | undefined;
}

/**
 * Abstract Syntax Tree representation of a specification.
 * 
 * Used for serialization, persistence, and adapter compilation.
 * Can be converted to/from specifications using `toAst` and `fromAst`.
 * 
 * @example
 * ```typescript
 * // Operator node
 * { type: "op", kind: "gte", input: { path: "age", value: 18 } }
 * 
 * // Composite node
 * { type: "and", nodes: [...] }
 * 
 * // Reference to registered spec
 * { type: "ref", id: "admin_check" }
 * ```
 */
export type Ast =
  | { type: "op"; kind: string; input: JsonValue }
  | { type: "not"; node: Ast }
  | { type: "and"; nodes: Ast[] }
  | { type: "or"; nodes: Ast[] }
  | { type: "ref"; id: string };

/**
 * Metadata attached to specifications for identification and organization.
 * 
 * Used for:
 * - Unique identification (id)
 * - Human-readable naming (name)
 * - Categorization (tags)
 * - Versioning (version)
 * - Ownership tracking (owner)
 * 
 * @example
 * ```typescript
 * const meta: SpecMeta = {
 *   id: "adult_check",
 *   name: "Adult Age Validation",
 *   tags: ["age", "validation", "legal"],
 *   version: "1.0.0",
 *   owner: "compliance-team"
 * };
 * ```
 */
export interface SpecMeta {
  /** Unique identifier */
  id?: string;
  /** Human-readable name */
  name?: string;
  /** Categorization tags */
  tags?: string[];
  /** Semantic version */
  version?: string;
  /** Owner or team name */
  owner?: string;
}

/**
 * Lifecycle hooks for specification evaluation events.
 * 
 * Useful for:
 * - Logging and monitoring
 * - Performance tracking
 * - Debugging and tracing
 * - Metrics collection
 * 
 * @example
 * ```typescript
 * const hooks: EvaluateHooks = {
 *   onEvaluateStart: (node, value) => {
 *     console.log(`Evaluating ${node.id}...`);
 *   },
 *   onEvaluateEnd: (node, value, ctx, pass) => {
 *     console.log(`${node.id} => ${pass}`);
 *   }
 * };
 * ```
 */
export interface EvaluateHooks<T = unknown, Ctx extends SpecContext = SpecContext> {
  /** Called before evaluation begins */
  onEvaluateStart?(node: ExplainNode, value: T, ctx?: Ctx): void;
  /** Called after evaluation completes */
  onEvaluateEnd?(node: ExplainNode, value: T, ctx: Ctx | undefined, pass: Verdict): void;
}

/**
 * Configuration options for BaseSpec construction.
 * 
 * @typeParam T - The value type
 * @typeParam Ctx - The context type
 * 
 * @example
 * ```typescript
 * const options: BaseSpecOptions<User, MyContext> = {
 *   meta: { id: "user_check", name: "User Validation" },
 *   hooks: { onEvaluateEnd: (node, value, ctx, pass) => log(pass) },
 *   memoize: true,
 *   hasher: (user) => `${user.id}:${user.email}`
 * };
 * ```
 */
export interface BaseSpecOptions<T, Ctx extends SpecContext> {
  /** Metadata (id, name, tags, version, owner) */
  meta?: SpecMeta;
  /** Lifecycle hooks for evaluation events */
  hooks?: EvaluateHooks<T, Ctx>;
  /** Enable memoization for repeated evaluations */
  memoize?: boolean;
  /** Custom hash function for memoization keys */
  hasher?: ValueHasher<T>;
}

/**
 * Function that converts a value to a hash string for memoization.
 * 
 * @typeParam T - The value type
 * 
 * @example
 * ```typescript
 * const hasher: ValueHasher<User> = (user) => 
 *   `${user.id}:${user.email}:${user.status}`;
 * ```
 */
export type ValueHasher<T> = (value: T) => string;

/**
 * Input data for humanizer templates.
 * 
 * Used to generate human-readable descriptions of specifications.
 * 
 * @example
 * ```typescript
 * const input: HumanizerTemplateInput = {
 *   id: "age_check",
 *   kind: "gte",
 *   path: "user.age",
 *   meta: { name: "Adult Check" },
 *   input: { value: 18 }
 * };
 * ```
 */
export interface HumanizerTemplateInput {
  id: string;
  kind: string;
  path?: string;
  meta?: SpecMeta;
  input?: JsonValue;
}
