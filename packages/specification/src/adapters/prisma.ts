import type { Specification } from "../core/types.js";
import type { AstNode } from "../ast/schema.js";
import { toAst } from "../ast/serializer.js";
import { type Adapter } from "./adapter.js";

export interface PrismaQuery {
  AND?: PrismaQuery[];
  OR?: PrismaQuery[];
  NOT?: PrismaQuery[];
  [field: string]: unknown;
}

const setPath = (path: string, value: unknown): PrismaQuery => {
  const fields = toSegments(path);
  const root: PrismaQuery = {};
  let current: Record<string, unknown> = root;
  for (let i = 0; i < fields.length - 1; i++) {
    const key = fields[i]!;
    current[key] = current[key] ?? {};
    current = current[key] as Record<string, unknown>;
  }
  const index = fields[fields.length - 1]!;
  current[index] = value;
  return root;
};

const toSegments = (path: string): string[] => {
  return path.replace(/\[(\d+)\]/g, ".$1").split(".");
};

const compileOp = (node: Extract<AstNode, { type: "op" }>): PrismaQuery => {
  const { kind, input } = node;
  switch (kind) {
    case "eq":
      return setPath(input.path as string, input.value);
    case "ne":
      return setPath(input.path as string, { not: input.value });
    case "lt":
      return setPath(input.path as string, { lt: input.value });
    case "lte":
      return setPath(input.path as string, { lte: input.value });
    case "gt":
      return setPath(input.path as string, { gt: input.value });
    case "gte":
      return setPath(input.path as string, { gte: input.value });
    case "in":
      return setPath(input.path as string, { in: input.values });
    case "notIn":
      return setPath(input.path as string, { notIn: input.values });
    case "exists":
      return setPath(input.path as string, { not: null });
    case "missing":
      return setPath(input.path as string, null);
    case "regex":
      return setPath(input.path as string, {
        search: { mode: "regex", pattern: input.pattern, options: input.flags },
      });
    case "startsWith":
      return setPath(input.path as string, { startsWith: input.value });
    case "endsWith":
      return setPath(input.path as string, { endsWith: input.value });
    case "contains":
      return setPath(input.path as string, { contains: input.value });
    default:
      return setPath(input.path as string, { raw: { kind, input } });
  }
};

const compileAst = (node: AstNode): PrismaQuery => {
  switch (node.type) {
    case "op":
      return compileOp(node);
    case "and":
      return { AND: node.nodes.map(compileAst) };
    case "or":
      return { OR: node.nodes.map(compileAst) };
    case "not":
      return { NOT: [compileAst(node.node)] };
    case "ref":
      return { REF: node.id };
    default:
      return {};
  }
};

export const prismaAdapter: Adapter<PrismaQuery> = {
  compile<T>(spec: Specification<T>) {
    const ast = toAst(spec);
    return compileAst(ast);
  },
};
