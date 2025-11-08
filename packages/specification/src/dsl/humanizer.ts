import type { ExplainNode, SpecMeta } from "../core/types.js";

export interface HumanizerContext {
  id: string;
  kind: string;
  path?: string;
  value?: unknown;
  actualValue?: unknown;
  expectedValue?: unknown;
  operator?: string;
  meta?: SpecMeta;
  locale?: string;
}

export type HumanizerTemplate = (ctx: HumanizerContext) => string;

export type LocalizationFunction = (key: string, params?: Record<string, unknown>) => string;

export interface HumanizerOptions {
  locale?: string;
  localize?: LocalizationFunction;
  fallbackTemplate?: HumanizerTemplate;
}

/**
 * HumanizerRegistry manages templates for converting specification nodes
 * into human-readable messages. Supports per-operator templates and localization.
 */
export class HumanizerRegistry {
  private readonly templates = new Map<string, HumanizerTemplate>();
  private locale: string;
  private localize?: LocalizationFunction;
  private fallbackTemplate?: HumanizerTemplate;

  constructor(options: HumanizerOptions = {}) {
    this.locale = options.locale ?? "en";
    this.localize = options.localize;
    this.fallbackTemplate = options.fallbackTemplate;
  }

  /**
   * Register a custom template for a specific operator kind
   */
  register(kind: string, template: HumanizerTemplate): this {
    this.templates.set(kind, template);
    return this;
  }

  /**
   * Register multiple templates at once
   */
  registerAll(templates: Record<string, HumanizerTemplate>): this {
    for (const [kind, template] of Object.entries(templates)) {
      this.templates.set(kind, template);
    }
    return this;
  }

  /**
   * Set the current locale for humanization
   */
  setLocale(locale: string): this {
    this.locale = locale;
    return this;
  }

  /**
   * Set the localization function
   */
  setLocalize(fn: LocalizationFunction): this {
    this.localize = fn;
    return this;
  }

  /**
   * Get a template for a specific operator kind
   */
  getTemplate(kind: string): HumanizerTemplate | undefined {
    return this.templates.get(kind);
  }

  /**
   * Check if a template exists for a kind
   */
  hasTemplate(kind: string): boolean {
    return this.templates.has(kind);
  }

  /**
   * Convert an ExplainNode to human-readable text
   */
  humanize(node: ExplainNode): string {
    const kind = node.meta?.kind as string | undefined;
    const operator = node.operator;

    // Try to get template by kind or operator
    const template = (kind && this.templates.get(kind)) || 
                     (operator && this.templates.get(operator));

    if (template) {
      return template({
        id: node.id,
        kind: kind ?? operator ?? "unknown",
        path: node.path,
        value: node.meta?.value,
        actualValue: node.actualValue,
        expectedValue: node.expectedValue,
        operator: node.operator,
        meta: node.meta,
        locale: this.locale,
      });
    }

    // Fall back to reason or fallback template
    if (node.reason) {
      return node.reason;
    }

    if (this.fallbackTemplate) {
      return this.fallbackTemplate({
        id: node.id,
        kind: kind ?? operator ?? "unknown",
        path: node.path,
        actualValue: node.actualValue,
        expectedValue: node.expectedValue,
        operator: node.operator,
        meta: node.meta,
        locale: this.locale,
      });
    }

    return `Specification ${node.id} failed`;
  }

  /**
   * Humanize an entire explain tree recursively
   */
  humanizeTree(node: ExplainNode, depth = 0): string {
    const indent = "  ".repeat(depth);
    const message = this.humanize(node);
    const status = node.pass === true ? "✓" : node.pass === false ? "✗" : "?";
    
    let result = `${indent}${status} ${message}`;

    if (node.children && node.children.length > 0) {
      const childResults = node.children
        .map((child) => this.humanizeTree(child, depth + 1))
        .join("\n");
      result += "\n" + childResults;
    }

    return result;
  }

  /**
   * Helper for localization using the registered function
   */
  protected t(key: string, params?: Record<string, unknown>): string {
    if (this.localize) {
      return this.localize(key, params);
    }
    // Simple fallback if no localization function
    return key;
  }
}

/**
 * Built-in templates for all standard operators
 */
export const builtInTemplates: Record<string, HumanizerTemplate> = {
  eq: (ctx) => {
    const path = ctx.path ?? "value";
    const metaAny = ctx.meta as Record<string, unknown> | undefined;
    const expected = JSON.stringify(ctx.expectedValue ?? metaAny?.value);
    const actual = ctx.actualValue !== undefined ? JSON.stringify(ctx.actualValue) : "undefined";
    return `${path} must equal ${expected} (got ${actual})`;
  },

  ne: (ctx) => {
    const path = ctx.path ?? "value";
    const metaAny = ctx.meta as Record<string, unknown> | undefined;
    const notExpected = JSON.stringify(ctx.expectedValue ?? metaAny?.value);
    return `${path} must not equal ${notExpected}`;
  },

  lt: (ctx) => {
    const path = ctx.path ?? "value";
    const metaAny = ctx.meta as Record<string, unknown> | undefined;
    const limit = ctx.expectedValue ?? metaAny?.value;
    const actual = ctx.actualValue;
    return `${path} must be less than ${limit} (got ${actual})`;
  },

  lte: (ctx) => {
    const path = ctx.path ?? "value";
    const metaAny = ctx.meta as Record<string, unknown> | undefined;
    const limit = ctx.expectedValue ?? metaAny?.value;
    const actual = ctx.actualValue;
    return `${path} must be at most ${limit} (got ${actual})`;
  },

  gt: (ctx) => {
    const path = ctx.path ?? "value";
    const metaAny = ctx.meta as Record<string, unknown> | undefined;
    const limit = ctx.expectedValue ?? metaAny?.value;
    const actual = ctx.actualValue;
    return `${path} must be greater than ${limit} (got ${actual})`;
  },

  gte: (ctx) => {
    const path = ctx.path ?? "value";
    const metaAny = ctx.meta as Record<string, unknown> | undefined;
    const limit = ctx.expectedValue ?? metaAny?.value;
    const actual = ctx.actualValue;
    return `${path} must be at least ${limit} (got ${actual})`;
  },

  in: (ctx) => {
    const path = ctx.path ?? "value";
    const metaAny = ctx.meta as Record<string, unknown> | undefined;
    const values = ctx.expectedValue ?? metaAny?.values;
    const actual = ctx.actualValue;
    const valuesStr = Array.isArray(values) ? values.map(v => JSON.stringify(v)).join(", ") : String(values);
    return `${path} must be one of [${valuesStr}] (got ${JSON.stringify(actual)})`;
  },

  notIn: (ctx) => {
    const path = ctx.path ?? "value";
    const metaAny = ctx.meta as Record<string, unknown> | undefined;
    const values = ctx.expectedValue ?? metaAny?.values;
    const valuesStr = Array.isArray(values) ? values.map(v => JSON.stringify(v)).join(", ") : String(values);
    return `${path} must not be one of [${valuesStr}]`;
  },

  exists: (ctx) => {
    const path = ctx.path ?? "value";
    return `${path} must exist and not be null`;
  },

  missing: (ctx) => {
    const path = ctx.path ?? "value";
    return `${path} must not exist or be null`;
  },

  regex: (ctx) => {
    const path = ctx.path ?? "value";
    const metaAny = ctx.meta as Record<string, unknown> | undefined;
    const pattern = metaAny?.pattern ?? ctx.expectedValue;
    const flags = metaAny?.flags;
    const flagsStr = flags ? ` with flags "${flags}"` : "";
    return `${path} must match pattern /${pattern}/${flagsStr}`;
  },

  startsWith: (ctx) => {
    const path = ctx.path ?? "value";
    const metaAny = ctx.meta as Record<string, unknown> | undefined;
    const prefix = ctx.expectedValue ?? metaAny?.value;
    return `${path} must start with "${prefix}"`;
  },

  endsWith: (ctx) => {
    const path = ctx.path ?? "value";
    const metaAny = ctx.meta as Record<string, unknown> | undefined;
    const suffix = ctx.expectedValue ?? metaAny?.value;
    return `${path} must end with "${suffix}"`;
  },

  contains: (ctx) => {
    const path = ctx.path ?? "value";
    const metaAny = ctx.meta as Record<string, unknown> | undefined;
    const substring = ctx.expectedValue ?? metaAny?.value;
    return `${path} must contain "${substring}"`;
  },

  // Composite operators
  and: (ctx) => {
    return `All conditions must be met`;
  },

  or: (ctx) => {
    return `At least one condition must be met`;
  },

  not: (ctx) => {
    return `Condition must not be met`;
  },
};

/**
 * Default humanizer with built-in templates
 */
export const defaultHumanizer = new HumanizerRegistry()
  .registerAll(builtInTemplates);

/**
 * Create a new humanizer with custom options
 */
export function createHumanizer(options: HumanizerOptions = {}): HumanizerRegistry {
  return new HumanizerRegistry(options).registerAll(builtInTemplates);
}
