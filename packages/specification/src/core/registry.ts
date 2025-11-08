import { SpecificationError } from "../utils/errors.js";
import type { SpecContext, Specification } from "./types.js";
import type { Operator, Registry, SpecMeta } from "./types.js";

export interface RegisteredSpecEntry<T, Ctx extends SpecContext> {
  id: string;
  factory: (args: unknown) => Specification<T, Ctx>;
  meta?: SpecMeta;
}

export interface RegistryOptions {
  operators?: Operator[];
}

class RegistryImpl implements Registry {
  private readonly operators = new Map<string, Operator>();
  private readonly specs = new Map<string, RegisteredSpecEntry<any, any>>();

  constructor(options?: RegistryOptions) {
    options?.operators?.forEach((op) => this.addOperator(op));
  }

  addOperator(operator: Operator): void {
    if (this.operators.has(operator.kind)) {
      throw new SpecificationError(
        "SPEC_REGISTRY_DUPLICATE",
        `Operator "${operator.kind}" already registered`,
      );
    }
    this.operators.set(operator.kind, operator);
  }

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

  getOperator(kind: string): Operator | undefined {
    return this.operators.get(kind);
  }

  getSpec<T, Ctx extends SpecContext>(id: string): Specification<T, Ctx> | undefined {
    const entry = this.specs.get(id);
    return entry?.factory(entry.meta);
  }
}

export const createRegistry = (options?: RegistryOptions): RegistryImpl => {
  return new RegistryImpl(options);
};
