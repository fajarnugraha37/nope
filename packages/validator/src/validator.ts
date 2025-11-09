import Ajv, { type ValidateFunction, type ErrorObject } from "ajv";
import addFormats from "ajv-formats";
import addErrors from "ajv-errors";
import addKeywords from "ajv-keywords";
import {
  ValidationError,
  type ValidationErrorInfo,
  type ValidationResult,
} from "@fajarnugraha37/error";
import { LruTtlCache, type LruTtlOpts } from "@fajarnugraha37/cache";
import { ValidatorBuilder } from "./validator.builder.js";
import type { SchemaBuilder } from "./schema-builder.js";

/**
 * Schema registry for different entity types
 */
export interface SchemaRegistry {
  "expression-schema": any;
  "form-schema"?: any;
  "step-schema"?: any;
  "component-schema"?: any;
  "hook-schema"?: any;
  "ui-schema"?: any;
  [key: string]: any;
}

/**
 * Validator configuration options
 */
export interface ValidatorOptions {
  strict?: boolean;
  allErrors?: boolean;
  removeAdditional?: boolean | "all" | "failing";
  useDefaults?: boolean;
  coerceTypes?: boolean | "array";
  verbose?: boolean;
}

/**
 * Schema loader function definition that can be used to fetch schemas dynamically
 */
export type SchemaLoader<TSchemas extends SchemaRegistry = SchemaRegistry> = <
  K extends keyof TSchemas
>(
  type: K
) => Promise<TSchemas[K] | undefined> | TSchemas[K] | undefined;

/**
 * Options for the schema cache (built on top of @fajarnugraha37/cache LRU implementation)
 */
export type SchemaCacheOptions<
  TSchemas extends SchemaRegistry = SchemaRegistry
> = LruTtlOpts<TSchemas[keyof TSchemas]> & {
  ttlMs?: number;
  slidingTtlMs?: number;
};

/**
 * JSON import helper types
 */
export type SchemaJsonInput<TSchemas extends SchemaRegistry = SchemaRegistry> =
  | string
  | Partial<TSchemas>;

/**
 * Generic validator class that can validate different types of structures
 * using JSON Schema validation with AJV
 */
export class Validator<TSchemas extends SchemaRegistry = SchemaRegistry> {
  private ajv: Ajv.default;
  private validators: Map<keyof TSchemas, ValidateFunction> = new Map();
  private schemas: Partial<TSchemas> = {};
  private schemaLoader?: SchemaLoader<TSchemas>;
  private schemaCache?: LruTtlCache<keyof TSchemas, TSchemas[keyof TSchemas]>;
  private schemaCacheTtl?: { ttlMs?: number; slidingTtlMs?: number };

  constructor(options: ValidatorOptions = {}) {
    // Initialize AJV with default options
    const defaultOptions = {
      strict: true,
      allErrors: true,
      removeAdditional: false,
      useDefaults: true,
      coerceTypes: false,
      verbose: true,
      ...options,
    };

    this.ajv = new Ajv.default({
      ...defaultOptions,
      strict: false,
      validateSchema: false,
      addUsedSchema: false,
    });

    // Add format support (date-time, email, etc.)
    try {
      addFormats.default(this.ajv);
    } catch (e) {
      // Ignore format errors for now
    }

    // Add error enhancement
    try {
      addErrors.default(this.ajv);
    } catch (e) {
      // Ignore error enhancement errors for now
    }

    // Add additional keywords
    try {
      addKeywords.default(this.ajv);
    } catch (e) {
      // Ignore keyword errors for now
    }

    // Register built-in schemas
  }

  /**
   * Fluent builder entrypoint
   */
  static builder<TSchemas extends SchemaRegistry = SchemaRegistry>() {
    return new ValidatorBuilder<TSchemas>();
  }

  /**
   * Register a new schema for a specific entity type
   */
  registerSchema<K extends keyof TSchemas>(type: K, schema: TSchemas[K]): this {
    try {
      this.schemas[type] = schema;
      const validator = this.ajv.compile(schema as object);
      this.validators.set(type, validator);
      this.cacheSchema(type, schema);
      return this;
    } catch (error) {
      throw new Error(
        `Failed to register schema for type '${String(type)}': ${error}`
      );
    }
  }

  /**
   * Register multiple schemas at once
   */
  registerSchemas(schemas: Partial<TSchemas>): this {
    for (const [type, schema] of Object.entries(schemas)) {
      this.registerSchema(type as keyof TSchemas, schema);
    }
    return this;
  }

  /**
   * Register a schema produced via the fluent SchemaBuilder
   */
  registerSchemaBuilder<K extends keyof TSchemas>(
    type: K,
    builder: SchemaBuilder
  ): this {
    return this.registerSchema(type, builder.build() as TSchemas[K]);
  }

  /**
   * Register multiple SchemaBuilder instances at once
   */
  registerSchemaBuilders(
    builders: Partial<Record<keyof TSchemas, SchemaBuilder>>
  ): this {
    for (const [type, builder] of Object.entries(builders)) {
      if (builder) {
        this.registerSchemaBuilder(type as keyof TSchemas, builder);
      }
    }
    return this;
  }

  /**
   * Enable schema level caching with LRU eviction
   */
  enableSchemaCache(options: SchemaCacheOptions<TSchemas> = {}): this {
    this.schemaCache = new LruTtlCache<
      keyof TSchemas,
      TSchemas[keyof TSchemas]
    >({
      maxEntries: options.maxEntries,
      maxSize: options.maxSize,
      sizer: options.sizer,
      sweepIntervalMs: options.sweepIntervalMs,
    });
    this.schemaCacheTtl = {
      ttlMs: options.ttlMs,
      slidingTtlMs: options.slidingTtlMs,
    };
    for (const [type, schema] of Object.entries(this.schemas)) {
      if (schema) {
        this.cacheSchema(
          type as keyof TSchemas,
          schema as TSchemas[keyof TSchemas]
        );
      }
    }
    return this;
  }

  /**
   * Configure a lazy schema loader, useful when schemas live in an external store
   */
  setSchemaLoader(loader: SchemaLoader<TSchemas>): this {
    this.schemaLoader = loader;
    return this;
  }

  /**
   * Import schemas from JSON (string or plain object) and optionally register them right away
   */
  importSchemasFromJSON(
    input: SchemaJsonInput<TSchemas>,
    options: { register?: boolean } = {}
  ): Partial<TSchemas> {
    const schemas = this.normalizeSchemaInput(input);
    if (options.register ?? true) {
      this.registerSchemas(schemas);
    }
    return schemas;
  }

  /**
   * Export in-memory schemas (optionally filtered by type)
   */
  exportSchemas(types?: (keyof TSchemas)[]): Partial<TSchemas> {
    const selectedTypes =
      types ?? (Object.keys(this.schemas) as (keyof TSchemas)[]);
    const payload: Partial<TSchemas> = {};
    for (const type of selectedTypes) {
      const schema = this.schemas[type];
      if (schema) {
        payload[type] = schema;
      }
    }
    return payload;
  }

  /**
   * Export schemas as a JSON string
   */
  exportSchemasToJSON(types?: (keyof TSchemas)[], space = 2): string {
    return JSON.stringify(this.exportSchemas(types), null, space);
  }

  /**
   * Validate data against a registered schema
   */
  validate<K extends keyof TSchemas>(
    type: K,
    data: unknown
  ): ValidationResult<TSchemas[K]> {
    const validator = this.validators.get(type);

    if (!validator) {
      throw new Error(`No schema registered for type '${String(type)}'`);
    }

    try {
      const valid = validator(data);

      if (valid) {
        return {
          valid: true,
          data: data as TSchemas[K],
        };
      }

      return {
        valid: false,
        errors: this.formatErrors(validator.errors || []),
      };
    } catch (error) {
      return {
        valid: false,
        errors: [
          {
            keyword: "exception",
            instancePath: "",
            schemaPath: "",
            params: {},
            message: `Validation exception: ${error}`,
            data,
          },
        ],
      };
    }
  }

  /**
   * Async variant that auto-fetches schemas via the configured loader
   */
  async validateAsync<K extends keyof TSchemas>(
    type: K,
    data: unknown
  ): Promise<ValidationResult<TSchemas[K]>> {
    await this.ensureSchemaLoaded(type);
    return this.validate(type, data);
  }

  /**
   * Validate data and throw on validation failure
   */
  validateStrict<K extends keyof TSchemas>(
    type: K,
    data: unknown
  ): TSchemas[K] {
    const result = this.validate(type, data);

    if (!result.valid) {
      const errorMessages =
        result.errors?.map((e) => e.message).join(", ") ||
        "Unknown validation error";
      throw new ValidationError(
        `Validation failed for type '${String(type)}': ${errorMessages}`
      );
    }

    return result.data!;
  }

  /**
   * Async variant of validateStrict that can hydrate schemas on-demand
   */
  async validateStrictAsync<K extends keyof TSchemas>(
    type: K,
    data: unknown
  ): Promise<TSchemas[K]> {
    const result = await this.validateAsync(type, data);
    if (!result.valid) {
      const errorMessages =
        result.errors?.map((e) => e.message).join(", ") ||
        "Unknown validation error";
      throw new ValidationError(
        `Validation failed for type '${String(type)}': ${errorMessages}`
      );
    }
    return result.data!;
  }

  /**
   * Check if a schema is registered for a type
   */
  hasSchema<K extends keyof TSchemas>(type: K): boolean {
    return this.validators.has(type);
  }

  /**
   * Get the registered schema for a type
   */
  getSchema<K extends keyof TSchemas>(type: K): TSchemas[K] | undefined {
    return this.schemas[type];
  }

  /**
   * Get all registered schema types
   */
  getRegisteredTypes(): (keyof TSchemas)[] {
    return Array.from(this.validators.keys());
  }

  /**
   * Validate multiple items of the same type
   */
  validateMany<K extends keyof TSchemas>(
    type: K,
    items: unknown[]
  ): ValidationResult<TSchemas[K][]> {
    const results: ValidationResult<TSchemas[K]>[] = items.map((item) =>
      this.validate(type, item)
    );

    const errors: ValidationErrorInfo[] = [];
    const validData: TSchemas[K][] = [];

    results.forEach((result, index) => {
      if (result.valid && result.data) {
        validData.push(result.data);
      } else if (result.errors) {
        // Prefix errors with item index
        const itemErrors = result.errors.map((error) => ({
          ...error,
          instancePath: `[${index}]${error.instancePath}`,
          message: `Item ${index}: ${error.message}`,
        }));
        errors.push(...itemErrors);
      }
    });

    return {
      valid: errors.length === 0,
      data: errors.length === 0 ? validData : undefined,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Async variant for batch validation with lazy schema hydration
   */
  async validateManyAsync<K extends keyof TSchemas>(
    type: K,
    items: unknown[]
  ): Promise<ValidationResult<TSchemas[K][]>> {
    await this.ensureSchemaLoaded(type);
    return this.validateMany(type, items);
  }

  /**
   * Create a specialized validator for a specific type
   */
  createTypeValidator<K extends keyof TSchemas>(type: K) {
    if (!this.hasSchema(type)) {
      throw new Error(`No schema registered for type '${String(type)}'`);
    }

    return {
      validate: (data: unknown) => this.validate(type, data),
      validateAsync: (data: unknown) => this.validateAsync(type, data),
      validateStrict: (data: unknown) => this.validateStrict(type, data),
      validateStrictAsync: (data: unknown) =>
        this.validateStrictAsync(type, data),
      validateMany: (items: unknown[]) => this.validateMany(type, items),
      validateManyAsync: (items: unknown[]) =>
        this.validateManyAsync(type, items),
    };
  }

  /**
   * Add a custom validation function
   */
  addCustomValidation<K extends keyof TSchemas>(
    type: K,
    name: string,
    validationFn: (data: any) => boolean | string
  ): this {
    this.ajv.addKeyword({
      keyword: name,
      validate: function validate(schema: any, data: any) {
        const result = validationFn(data);
        if (typeof result === "string") {
          (validate as any).errors = [{ message: result }];
          return false;
        }
        return result;
      },
    });
    return this;
  }

  /**
   * Make sure a schema exists, optionally hydrating it via the loader/cache
   */
  private async ensureSchemaLoaded<K extends keyof TSchemas>(
    type: K
  ): Promise<void> {
    if (this.hasSchema(type)) {
      return;
    }

    const cachedSchema = this.schemaCache?.get(type);
    if (cachedSchema) {
      this.registerSchema(type, cachedSchema as TSchemas[K]);
      return;
    }

    if (!this.schemaLoader) {
      throw new Error(
        `No schema registered for type '${String(
          type
        )}' and no schema loader configured`
      );
    }

    const loadedSchema = await this.schemaLoader(type);
    if (!loadedSchema) {
      throw new Error(
        `Schema loader did not return a schema for type '${String(type)}'`
      );
    }

    this.registerSchema(type, loadedSchema);
  }

  /**
   * Cache helper to keep schema copies stored in the LRU
   */
  private cacheSchema<K extends keyof TSchemas>(type: K, schema: TSchemas[K]) {
    if (!this.schemaCache) {
      return;
    }

    this.schemaCache.set(type, schema, {
      ttlMs: this.schemaCacheTtl?.ttlMs,
      slidingTtlMs: this.schemaCacheTtl?.slidingTtlMs,
    });
  }

  /**
   * Normalize schema JSON input ensuring it's an object map
   */
  private normalizeSchemaInput(
    input: SchemaJsonInput<TSchemas>
  ): Partial<TSchemas> {
    const payload =
      typeof input === "string" ? (JSON.parse(input) as unknown) : input;

    if (
      typeof payload !== "object" ||
      payload === null ||
      Array.isArray(payload)
    ) {
      throw new Error("Schema JSON must be an object keyed by schema type");
    }

    return payload as Partial<TSchemas>;
  }

  /**
   * Format AJV errors into our ValidationErrorInfo format
   */
  private formatErrors(ajvErrors: ErrorObject[]): ValidationErrorInfo[] {
    return ajvErrors.map((error) => ({
      keyword: error.keyword,
      instancePath: error.instancePath || "",
      schemaPath: error.schemaPath || "",
      params: error.params || {},
      message: error.message || "Validation error",
      data: error.data,
      parentSchema: error.parentSchema,
      schema: error.schema,
    }));
  }
}
