import type { ExplainNode } from "../core/types.js";

/**
 * Generate a human-readable failure reason based on operator and values
 */
export const generateFailureReason = (node: ExplainNode): string | undefined => {
  if (node.pass === true || node.pass === "unknown") {
    return node.reason;
  }

  const { operator, actualValue, expectedValue, path } = node;
  
  if (!operator) {
    return node.reason;
  }

  const pathStr = path ? `Field '${path}'` : "Value";
  const actualStr = formatValue(actualValue);
  const expectedStr = formatValue(expectedValue);

  switch (operator) {
    case "eq":
      return `${pathStr}: Expected ${expectedStr}, but got ${actualStr}`;
    case "ne":
      return `${pathStr}: Expected not ${expectedStr}, but got ${actualStr}`;
    case "gt":
      return `${pathStr}: Expected > ${expectedStr}, but got ${actualStr}`;
    case "gte":
      return `${pathStr}: Expected >= ${expectedStr}, but got ${actualStr}`;
    case "lt":
      return `${pathStr}: Expected < ${expectedStr}, but got ${actualStr}`;
    case "lte":
      return `${pathStr}: Expected <= ${expectedStr}, but got ${actualStr}`;
    case "in":
      return `${pathStr}: Expected one of ${expectedStr}, but got ${actualStr}`;
    case "nin":
      return `${pathStr}: Expected none of ${expectedStr}, but got ${actualStr}`;
    case "contains":
      return `${pathStr}: Expected to contain ${expectedStr}, but got ${actualStr}`;
    case "startsWith":
      return `${pathStr}: Expected to start with ${expectedStr}, but got ${actualStr}`;
    case "endsWith":
      return `${pathStr}: Expected to end with ${expectedStr}, but got ${actualStr}`;
    case "regex":
      return `${pathStr}: Expected to match pattern ${expectedStr}, but got ${actualStr}`;
    case "exists":
      return `${pathStr}: Expected to exist, but was ${actualStr}`;
    case "missing":
      return `${pathStr}: Expected to be missing, but was ${actualStr}`;
    case "and":
      return `${pathStr}: Not all conditions met`;
    case "or":
      return `${pathStr}: No conditions met`;
    case "not":
      return `${pathStr}: Negation failed - condition was true`;
    default:
      return node.reason ?? `${pathStr}: Condition '${operator}' failed`;
  }
};

/**
 * Format a value for display in error messages
 */
const formatValue = (value: unknown): string => {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") return `"${value}"`;
  if (Array.isArray(value)) {
    if (value.length > 5) {
      return `[${value.slice(0, 5).map(formatValue).join(", ")}, ... (${value.length} items)]`;
    }
    return `[${value.map(formatValue).join(", ")}]`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length > 3) {
      return `{ ${keys.slice(0, 3).join(", ")}, ... }`;
    }
    return JSON.stringify(value);
  }
  return String(value);
};

/**
 * Recursively enhance all nodes in an explain tree with generated reasons
 */
export const enhanceExplainTree = (node: ExplainNode): ExplainNode => {
  const enhanced: ExplainNode = {
    ...node,
    reason: node.reason ?? generateFailureReason(node),
  };

  if (node.children) {
    enhanced.children = node.children.map(enhanceExplainTree);
  }

  return enhanced;
};

/**
 * Format an explain tree as a readable text report
 */
export const formatExplainTree = (node: ExplainNode, indent = 0): string => {
  const prefix = "  ".repeat(indent);
  const statusIcon = node.pass === true ? "✓" : node.pass === false ? "✗" : "?";
  const name = node.name ?? node.id;
  const duration = node.durationMs !== undefined ? ` (${node.durationMs.toFixed(2)}ms)` : "";
  
  let output = `${prefix}${statusIcon} ${name}${duration}`;
  
  if (node.reason && node.pass === false) {
    output += `\n${prefix}  → ${node.reason}`;
  }

  if (node.children) {
    for (const child of node.children) {
      output += "\n" + formatExplainTree(child, indent + 1);
    }
  }

  return output;
};
