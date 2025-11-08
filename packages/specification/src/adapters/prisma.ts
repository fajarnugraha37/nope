import type { Specification } from "../core/types.js";
import type { AstNode } from "../ast/schema.js";
import { toAst } from "../ast/serializer.js";
import { type Adapter } from "./adapter.js";

/**
 * Prisma query filter structure.
 * 
 * Represents WHERE clause conditions compatible with Prisma Client.
 * Supports nested AND/OR/NOT logic and field-level comparisons.
 * 
 * @example
 * ```typescript
 * const query: PrismaQuery = {
 *   AND: [
 *     { age: { gte: 18 } },
 *     { status: "active" }
 *   ]
 * };
 * 
 * const users = await prisma.user.findMany({ where: query });
 * ```
 */
export interface PrismaQuery {
  /** Logical AND conditions */
  AND?: PrismaQuery[];
  /** Logical OR conditions */
  OR?: PrismaQuery[];
  /** Logical NOT conditions */
  NOT?: PrismaQuery[];
  /** Field-level filters */
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

/**
 * Prisma adapter for compiling specifications to Prisma queries.
 * 
 * Translates specification ASTs into Prisma Client WHERE clause filters.
 * Supports all built-in operators and nested boolean logic.
 * 
 * **Supported Operators:**
 * - Comparison: eq, ne, lt, lte, gt, gte
 * - Collection: in, notIn
 * - String: regex, startsWith, endsWith, contains
 * - Existence: exists, missing
 * - Boolean: and, or, not
 * 
 * **Limitations:**
 * - Registered spec references (`ref`) are passed through as-is
 * - Unsupported operators fall back to `{ raw: { kind, input } }`
 * 
 * @example
 * ```typescript
 * import { spec, prismaAdapter } from "@fajarnugraha37/specification";
 * 
 * const ageSpec = spec.field<User>("age").gte(18);
 * const query = prismaAdapter.compile(ageSpec);
 * 
 * // query => { age: { gte: 18 } }
 * 
 * const users = await prisma.user.findMany({ where: query });
 * ```
 * 
 * @example
 * ```typescript
 * // Complex query
 * const spec = all(
 *   spec.field<User>("age").gte(18),
 *   any(
 *     spec.field<User>("role").eq("admin"),
 *     spec.field<User>("permissions").contains("manage_users")
 *   )
 * );
 * 
 * const query = prismaAdapter.compile(spec);
 * // query => {
 * //   AND: [
 * //     { age: { gte: 18 } },
 * //     { OR: [
 * //       { role: "admin" },
 * //       { permissions: { contains: "manage_users" } }
 * //     ]}
 * //   ]
 * // }
 * ```
 */
export const prismaAdapter: Adapter<PrismaQuery> = {
  compile<T>(spec: Specification<T>) {
    const ast = toAst(spec);
    return compileAst(ast);
  },
};
