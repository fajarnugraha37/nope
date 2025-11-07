import { LruTtlCache } from "@nope/cache";
import { AsyncLogicEngine } from "json-logic-engine";
import type {
  ExpressionSchema,
  ExecutionContext,
  ExecutionResult,
  ExecutionMetadata,
  EvaluatorConfig,
} from "../expression.js";
import { EvaluationError, TimeoutError } from "../error/index.js";

export class ExpressionEvaluator {
  private readonly cache: LruTtlCache<string, Promise<Function>>;
  private readonly engine: AsyncLogicEngine;
  private readonly config: Required<EvaluatorConfig>;

  constructor(config: EvaluatorConfig = {}) {
    // Set default configuration
    this.config = {
      cache: {
        maxEntries: 1000,
        maxSize: 10 * 1024 * 1024, // 10 MB
        ttl: 30 * 60 * 1000, // 30 minutes
        sweepInterval: 15 * 60 * 1000, // 15 minutes
        ...config.cache,
      },
      timeout: config.timeout || 30000, // 30 seconds
      maxDepth: config.maxDepth || 100,
      strictMode: config.strictMode ?? false,
      asyncMode: config.asyncMode ?? true,
      debug: config.debug ?? false,
    };

    // Initialize cache
    this.cache = new LruTtlCache<string, Promise<Function>>({
      maxEntries: this.config.cache.maxEntries,
      maxSize: this.config.cache.maxSize,
      sweepIntervalMs: this.config.cache.sweepInterval,
    });

    // Initialize engine
    this.engine = new AsyncLogicEngine();

    // Add built-in methods
    this.addBuiltinMethods();
  }

  /**
   * Add a custom keyword/method to the engine
   */
  addKeyword(
    alias: string,
    method: (
      args: any,
      context: any,
      above: any[],
      engine: AsyncLogicEngine
    ) => any,
    options: {
      deterministic?: boolean;
      lazy?: boolean;
      traverse?: boolean;
    } = {}
  ): this {
    this.engine.addMethod(alias, {
      method,
      deterministic: options.deterministic ?? false,
      lazy: options.lazy ?? false,
      traverse: options.traverse ?? true,
    });
    return this;
  }

  /**
   * Add a synchronous module
   */
  addSyncModule(
    alias: string,
    module: unknown,
    options: { deterministic?: boolean } = {}
  ): this {
    this.engine.addModule(alias, module, {
      deterministic: options.deterministic ?? false,
      sync: true,
    });
    return this;
  }

  /**
   * Add an asynchronous module
   */
  addAsyncModule(
    alias: string,
    module: unknown,
    options: { deterministic?: boolean } = {}
  ): this {
    this.engine.addModule(alias, module, {
      deterministic: options.deterministic ?? false,
      async: true,
    });
    return this;
  }

  /**
   * Evaluate an expression with comprehensive result tracking
   */
  async evaluate<T = unknown>(
    schema: ExpressionSchema,
    context: ExecutionContext
  ): Promise<ExecutionResult<T>> {
    const startTime = performance.now();
    let cacheHits = 0;
    let cacheMisses = 0;
    let operations = 0;
    let depth = 0;

    try {
      // Validate input
      this.validateSchema(schema);
      this.validateContext(context);

      // Create timeout promise if configured
      const evaluatePromise = this.evaluateInternal(schema, context);

      let result: T;
      if (this.config.timeout > 0) {
        result = (await Promise.race([
          evaluatePromise,
          this.createTimeoutPromise<T>(this.config.timeout),
        ])) as T;
      } else {
        result = (await evaluatePromise) as T;
      }

      const endTime = performance.now();
      const metadata: ExecutionMetadata = {
        duration: endTime - startTime,
        operations,
        cacheHits,
        cacheMisses,
        depth,
      };

      return {
        value: result,
        success: true,
        metadata,
      };
    } catch (error) {
      const endTime = performance.now();
      const metadata: ExecutionMetadata = {
        duration: endTime - startTime,
        operations,
        cacheHits,
        cacheMisses,
        depth,
      };

      if (this.config.debug) {
        console.error("Expression evaluation failed:", {
          schema: schema.id,
          error: error instanceof Error ? error.message : String(error),
          metadata,
        });
      }

      return {
        value: undefined as T,
        success: false,
        error:
          error instanceof Error ? error : new EvaluationError(String(error)),
        metadata,
      };
    }
  }

  /**
   * Evaluate multiple expressions in parallel
   */
  async evaluateMany<T = unknown>(
    schemas: ExpressionSchema[],
    context: ExecutionContext
  ): Promise<ExecutionResult<T>[]> {
    const promises = schemas.map((schema) => this.evaluate<T>(schema, context));
    return Promise.all(promises);
  }

  /**
   * Evaluate with simple interface (throws on error)
   */
  async evaluateOrThrow<T = unknown>(
    schema: ExpressionSchema,
    data: unknown
  ): Promise<T> {
    const context: ExecutionContext = { data };
    const result = await this.evaluate<T>(schema, context);

    if (!result.success) {
      throw result.error || new EvaluationError("Evaluation failed");
    }

    return result.value;
  }

  /**
   * Check if an expression is cached
   */
  isCached(schema: ExpressionSchema): boolean {
    const key = this.getCacheKey(schema);
    return this.cache.has(key);
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.config.cache.maxSize,
      // hitRate: this.cache.hitRate, // Not available in current cache implementation
      // Add more statistics as needed
    };
  }

  /**
   * Pre-compile expressions for better performance
   */
  async precompile(schemas: ExpressionSchema[]): Promise<void> {
    const promises = schemas.map((schema) => this.compile(schema));
    await Promise.all(promises);
  }

  /**
   * Validate expression without executing
   */
  async validate(schema: ExpressionSchema): Promise<boolean> {
    try {
      await this.compile(schema);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get expression dependencies (variables referenced)
   */
  getDependencies(schema: ExpressionSchema): string[] {
    const dependencies = new Set<string>();

    const extractVars = (obj: any): void => {
      if (obj && typeof obj === "object") {
        if ("var" in obj && typeof obj.var === "string") {
          dependencies.add(obj.var);
        } else if (Array.isArray(obj)) {
          obj.forEach(extractVars);
        } else {
          Object.values(obj).forEach(extractVars);
        }
      }
    };

    extractVars({
      [schema.multipleOperations]: schema.operations,
    });

    return Array.from(dependencies);
  }

  /**
   * Internal evaluation logic
   */
  private async evaluateInternal<T>(
    schema: ExpressionSchema,
    context: ExecutionContext
  ): Promise<T> {
    const compiled = await this.compile(schema);
    return compiled(context.data) as T;
  }

  /**
   * Compile an expression to executable function
   */
  private async compile(schema: ExpressionSchema): Promise<Function> {
    const key = this.getCacheKey(schema);

    let cached = this.cache.get(key);
    if (cached) {
      return cached;
    }

    const compilePromise = this.engine.build({
      [schema.multipleOperations]: schema.operations,
    });

    this.cache.set(key, compilePromise);
    return compilePromise;
  }

  /**
   * Generate cache key from schema
   */
  private getCacheKey(schema: ExpressionSchema): string {
    // Use schema ID and version for caching
    const baseKey = schema.id + (schema.version ? `@${schema.version}` : "");

    // In strict mode, include the entire schema in the key
    if (this.config.strictMode) {
      const schemaHash = this.hashSchema(schema);
      return `${baseKey}#${schemaHash}`;
    }

    return baseKey;
  }

  /**
   * Create a simple hash of the schema for cache invalidation
   */
  private hashSchema(schema: ExpressionSchema): string {
    // Simple hash implementation - in production, use a proper hash function
    const str = JSON.stringify({
      operations: schema.operations,
      multipleOperations: schema.multipleOperations,
    });

    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return hash.toString(36);
  }

  /**
   * Create a timeout promise
   */
  private createTimeoutPromise<T>(timeout: number): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new TimeoutError(timeout)), timeout);
    });
  }

  /**
   * Validate expression schema
   */
  private validateSchema(schema: ExpressionSchema): void {
    if (!schema.id) {
      throw new EvaluationError("Schema must have an ID");
    }

    if (!schema.operations || schema.operations.length === 0) {
      throw new EvaluationError("Schema must have at least one operation");
    }

    if (!["and", "or"].includes(schema.multipleOperations)) {
      throw new EvaluationError("Invalid multiple operations type");
    }
  }

  /**
   * Validate execution context
   */
  private validateContext(context: ExecutionContext): void {
    if (!context || typeof context !== "object") {
      throw new EvaluationError("Invalid execution context");
    }
  }

  /**
   * Add built-in methods to the engine
   */
  private addBuiltinMethods(): void {
    // Add enhanced math operations
    this.addKeyword("abs", (args) => Math.abs(args[0]), {
      deterministic: true,
    });
    this.addKeyword("round", (args) => Math.round(args[0]), {
      deterministic: true,
    });
    this.addKeyword("floor", (args) => Math.floor(args[0]), {
      deterministic: true,
    });
    this.addKeyword("ceil", (args) => Math.ceil(args[0]), {
      deterministic: true,
    });
    this.addKeyword("**", (args) => Math.pow(args[0], args[1]), {
      deterministic: true,
    });
    this.addKeyword("sqrt", (args) => Math.sqrt(args[0]), {
      deterministic: true,
    });

    // Add string operations
    this.addKeyword("toLowerCase", (args) => String(args[0]).toLowerCase(), {
      deterministic: true,
    });
    this.addKeyword("toUpperCase", (args) => String(args[0]).toUpperCase(), {
      deterministic: true,
    });
    this.addKeyword("trim", (args) => String(args[0]).trim(), {
      deterministic: true,
    });
    this.addKeyword(
      "contains",
      (args) => String(args[0]).includes(String(args[1])),
      {
        deterministic: true,
      }
    );
    this.addKeyword(
      "startsWith",
      (args) => String(args[0]).startsWith(String(args[1])),
      {
        deterministic: true,
      }
    );
    this.addKeyword(
      "endsWith",
      (args) => String(args[0]).endsWith(String(args[1])),
      {
        deterministic: true,
      }
    );

    // Add validation operations
    this.addKeyword("isNull", (args) => args[0] === null, {
      deterministic: true,
    });
    this.addKeyword("isDefined", (args) => args[0] !== undefined, {
      deterministic: true,
    });
    this.addKeyword(
      "isEmpty",
      (args) => {
        const val = args[0];
        return (
          val === null ||
          val === undefined ||
          val === "" ||
          (Array.isArray(val) && val.length === 0) ||
          (typeof val === "object" && Object.keys(val).length === 0)
        );
      },
      { deterministic: true }
    );

    this.addKeyword("isString", (args) => typeof args[0] === "string", {
      deterministic: true,
    });
    this.addKeyword("isNumber", (args) => typeof args[0] === "number", {
      deterministic: true,
    });
    this.addKeyword("isBoolean", (args) => typeof args[0] === "boolean", {
      deterministic: true,
    });
    this.addKeyword("isArray", (args) => Array.isArray(args[0]), {
      deterministic: true,
    });
    this.addKeyword(
      "isObject",
      (args) =>
        args[0] !== null &&
        typeof args[0] === "object" &&
        !Array.isArray(args[0]),
      { deterministic: true }
    );

    // Add date operations
    this.addKeyword("now", () => new Date(), { deterministic: false });
    this.addKeyword(
      "today",
      () => {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        return date;
      },
      { deterministic: false }
    );

    // Add array operations
    this.addKeyword(
      "includes",
      (args) => {
        const [array, value] = args;
        return Array.isArray(array) ? array.includes(value) : false;
      },
      { deterministic: true }
    );

    this.addKeyword(
      "unique",
      (args) => {
        const array = args[0];
        return Array.isArray(array) ? [...new Set(array)] : array;
      },
      { deterministic: true }
    );

    this.addKeyword(
      "flatten",
      (args) => {
        const array = args[0];
        return Array.isArray(array) ? array.flat() : array;
      },
      { deterministic: true }
    );

    // Add object operations
    this.addKeyword(
      "keys",
      (args) => {
        const obj = args[0];
        return obj && typeof obj === "object" ? Object.keys(obj) : [];
      },
      { deterministic: true }
    );

    this.addKeyword(
      "values",
      (args) => {
        const obj = args[0];
        return obj && typeof obj === "object" ? Object.values(obj) : [];
      },
      { deterministic: true }
    );

    this.addKeyword(
      "has",
      (args) => {
        const [obj, key] = args;
        return obj && typeof obj === "object" ? key in obj : false;
      },
      { deterministic: true }
    );
  }
}
