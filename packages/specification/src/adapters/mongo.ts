import type { Specification } from "../core/types.js";
import type { AstNode } from "../ast/schema.js";
import { toAst } from "../ast/serializer.js";
import { type Adapter } from "./adapter.js";

export type MongoQuery =
  | Record<string, unknown>
  | { $and: MongoQuery[] }
  | { $or: MongoQuery[] }
  | { $not: MongoQuery }
  | { $nor: MongoQuery[] };

const compileOp = (node: Extract<AstNode, { type: "op" }>): MongoQuery => {
  const field = node.input.path as string;
  switch (node.kind) {
    case "eq":
      return { [field]: node.input.value };
    case "ne":
      return { [field]: { $ne: node.input.value } };
    case "lt":
      return { [field]: { $lt: node.input.value } };
    case "lte":
      return { [field]: { $lte: node.input.value } };
    case "gt":
      return { [field]: { $gt: node.input.value } };
    case "gte":
      return { [field]: { $gte: node.input.value } };
    case "in":
      return { [field]: { $in: node.input.values } };
    case "notIn":
      return { [field]: { $nin: node.input.values } };
    case "exists":
      return { [field]: { $exists: true, $ne: null } };
    case "missing":
      return { [field]: { $exists: false } };
    case "regex":
      return {
        [field]: { $regex: node.input.pattern, $options: node.input.flags },
      };
    case "startsWith":
      return { [field]: { $regex: `^${node.input.value}` } };
    case "endsWith":
      return { [field]: { $regex: `${node.input.value}$` } };
    case "contains":
      return { [field]: { $regex: node.input.value } };
    default:
      return { [field]: { $expr: { kind: node.kind, input: node.input } } };
  }
};

const compileAst = (node: AstNode): MongoQuery => {
  switch (node.type) {
    case "op":
      return compileOp(node);
    case "and":
      return { $and: node.nodes.map(compileAst) };
    case "or":
      return { $or: node.nodes.map(compileAst) };
    case "not":
      return { $not: compileAst(node.node) };
    case "ref":
      return { $comment: `ref:${node.id}` };
    default:
      return {};
  }
};

export const mongoAdapter: Adapter<MongoQuery> = {
  compile<T>(spec: Specification<T>) {
    const ast = toAst(spec);
    return compileAst(ast);
  },
};
