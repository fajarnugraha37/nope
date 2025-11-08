import { SpecificationError } from "../utils/errors.js";
import type { SpecContext, Specification } from "./types.js";
import type { Operator, Registry, SpecMeta } from "./types.js";

/**
 * Internal registry entry for a reusable specification.
 * 
 * @typeParam T - The value type
 * @typeParam Ctx - The context type
 */
export interface RegisteredSpecEntry<T, Ctx extends SpecContext> {
  /** Unique identifier */
  id: string;
  /** Factory function to create the spec */
  factory: (args: unknown) => Specification<T, Ctx>;
  /** Optional metadata */
  meta?: SpecMeta;
}

/**
 * Configuration options for registry creation.
 * 
 * @example
 * ```typescript
 * const registry = createRegistry({
 *   operators: [...builtInOperators, ...customOperators]
 * });
 * ```
 */
export interface RegistryOptions {
  /** Pre-register operators during initialization */
  operators?: Operator[];
}

class RegistryImpl implements Registry {
  private readonly operators = new Map<string, Operator>();
  private readonly specs = new Map<string, RegisteredSpecEntry<any, any>>();

  constructor(options?: RegistryOptions) {
    options?.operators?.forEach((op) => this.addOperator(op));
  }

  /**
   * Registers a new operator in the registry.
   * 
   * @param operator - The operator to register
   * @throws {SpecificationError} If an operator with the same kind already exists
   * 
   * @example
   * ```typescript
   * registry.addOperator({
   *   kind: "custom",
   *   create: (input) => new CustomSpec(input)
   * });
   * ```
   */
  addOperator(operator: Operator): void {
    if (this.operators.has(operator.kind)) {
      throw new SpecificationError(
        "SPEC_REGISTRY_DUPLICATE",
        `Operator "${operator.kind}" already registered`,
      );
    }
    this.operators.set(operator.kind, operator);
  }

  /**
   * Registers a reusable specification factory.
   * 
   * @param factory - Function that creates the specification
   * @param meta - Metadata (must include `id` for registration)
   * @throws {SpecificationError} If meta.id is missing or already registered
   * 
   * @example
   * ```typescript
   * registry.addSpec(
   *   (args) => spec.field("age").gte(18),
   *   { id: "adult_check", name: "Adult Validation" }
   * );
   * 
   * const spec = registry.getSpec("adult_check");
   * ```
   */
  addSpec<T, Ctx extends SpecContext>(factory: (args: unknown) => Specification<T, Ctx>, meta?: SpecMeta): void {
    const id = meta?.id;
    if (!id) {
      throw new SpecificationError("SPEC_VALIDATION", "Spec meta.id is required for registration");
    }
    if (this.specs.has(id)) {
      throw new SpecificationError("SPEC_REGISTRY_DUPLICATE", `Spec "${id}" already registered`);
    }
    this.specs.set(id, { id, factory, meta });
  }

  /**
   * Retrieves an operator by its kind identifier.
   * 
   * @param kind - The operator kind (e.g., "eq", "gte", "contains")
   * @returns The operator if found, undefined otherwise
   * 
   * @example
   * ```typescript
   * const eqOp = registry.getOperator("eq");
   * if (eqOp) {
   *   const spec = eqOp.create({ path: "status", value: "active" });
   * }
   * ```
   */
  getOperator(kind: string): Operator | undefined {
    return this.operators.get(kind);
  }

  /**
   * Retrieves a registered specification by its id.
   * 
   * @param id - The specification id
   * @returns The specification instance if found, undefined otherwise
   * 
   * @example
   * ```typescript
   * const spec = registry.getSpec<User>("admin_check");
   * if (spec) {
   *   const isAdmin = spec.isSatisfiedBy(user);
   * }
   * ```
   */
  getSpec<T, Ctx extends SpecContext>(id: string): Specification<T, Ctx> | undefined {
    const entry = this.specs.get(id);
    return entry?.factory(entry.meta);
  }
}

/**
 * Creates a new registry instance.
 * 
 * The registry manages operators and reusable specifications.
 * Operators can be pre-registered via options or added later.
 * 
 * @param options - Configuration options
 * @param options.operators - Array of operators to pre-register
 * @returns A new registry instance
 * 
 * @example
 * ```typescript
 * import { builtInOperators } from "./ops";
 * 
 * const registry = createRegistry({
 *   operators: builtInOperators
 * });
 * 
 * // Add custom operators
 * registry.addOperator(myCustomOperator);
 * 
 * // Register plugins
 * geoPlugin.register(registry);
 * ```
 */
export const createRegistry = (options?: RegistryOptions): RegistryImpl => {
  return new RegistryImpl(options);
};
