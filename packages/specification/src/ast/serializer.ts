import { Validator } from "@fajarnugraha37/validator";
import type { Specification, Registry, SpecContext } from "../core/types.js";
import { FieldSpec } from "../ops/field-spec.js";
import { CompositeSpec } from "../core/base-spec.js";
import { all, any, not } from "../core/combinators.js";
import { SpecificationError } from "../utils/errors.js";
import { AstSchema, type AstNode } from "./schema.js";

export interface ToAstOptions {
  registry?: Registry;
}

// Create a validator instance for AST validation
const astValidator = new Validator();
astValidator.registerSchema("ast-node", AstSchema);

export const toAst = (spec: Specification<any, any>, options?: ToAstOptions): AstNode => {
  if (spec instanceof FieldSpec) {
    const json = spec.toJSON();
    return {
      type: "op",
      kind: json.kind as string,
      input: {
        path: json.path as string,
        ...(json.input ?? {}),
      },
    };
  }

  if (spec instanceof CompositeSpec) {
    const { mode, specs } = spec.descriptor;
    if (mode === "not") {
      return { type: "not", node: toAst(specs[0]!, options) };
    }
    const nodes = specs.map((child) => toAst(child, options));
    return { type: mode, nodes };
  }

  const meta = (spec as { meta?: { id?: string } }).meta;
  if (options?.registry && meta?.id) {
    return { type: "ref", id: meta.id };
  }

  throw new SpecificationError("SPEC_AST_INVALID", "Cannot convert specification to AST");
};

export const fromAst = <T, Ctx extends SpecContext>(ast: AstNode, registry: Registry): Specification<T, Ctx> => {
  // Validate the AST structure
  const validation = astValidator.validate("ast-node", ast);
  if (!validation.valid) {
    const errors = validation.errors?.map((e: any) => e.message).join(", ") || "Unknown validation error";
    throw new SpecificationError("SPEC_AST_INVALID", `Invalid AST: ${errors}`);
  }

  switch (ast.type) {
    case "op": {
      const operator = registry.getOperator(ast.kind);
      if (!operator) {
        throw new SpecificationError(
          "SPEC_REGISTRY_UNKNOWN",
          `Operator "${ast.kind}" is not registered`,
        );
      }
      return operator.create(ast.input);
    }
    case "not":
      return not(fromAst<T, Ctx>(ast.node, registry));
    case "and":
      return all(...ast.nodes.map((node) => fromAst<T, Ctx>(node, registry)));
    case "or":
      return any(...ast.nodes.map((node) => fromAst<T, Ctx>(node, registry)));
    case "ref": {
      const spec = registry.getSpec<T, Ctx>(ast.id);
      if (!spec) {
        throw new SpecificationError("SPEC_REGISTRY_UNKNOWN", `Spec "${ast.id}" is not registered`);
      }
      return spec;
    }
    default:
      throw new SpecificationError("SPEC_AST_INVALID", "Unsupported AST node type");
  }
};
