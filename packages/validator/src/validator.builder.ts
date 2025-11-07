import type {
  SchemaRegistry,
  ValidatorOptions,
  SchemaLoader,
  SchemaCacheOptions,
  SchemaJsonInput,
} from "./validator.js";
import { Validator } from "./validator.js";

/**
 * Fluent builder to compose validators with schemas, loaders, and caching
 */
export class ValidatorBuilder<
  TSchemas extends SchemaRegistry = SchemaRegistry
> {
  private options: ValidatorOptions = {};
  private schemas: Partial<TSchemas> = {};
  private loader?: SchemaLoader<TSchemas>;
  private cacheOptions?: SchemaCacheOptions<TSchemas>;

  static create<TSchemas extends SchemaRegistry = SchemaRegistry>() {
    return new ValidatorBuilder<TSchemas>();
  }

  withOptions(options: ValidatorOptions): this {
    this.options = {
      ...this.options,
      ...options,
    };
    return this;
  }

  withSchema<K extends keyof TSchemas>(type: K, schema: TSchemas[K]): this {
    this.schemas = {
      ...this.schemas,
      [type]: schema,
    };
    return this;
  }

  withSchemas(schemas: Partial<TSchemas>): this {
    this.schemas = {
      ...this.schemas,
      ...schemas,
    };
    return this;
  }

  fromJSON(input: SchemaJsonInput<TSchemas>): this {
    const payload =
      typeof input === "string" ? (JSON.parse(input) as unknown) : input;
    if (
      typeof payload !== "object" ||
      payload === null ||
      Array.isArray(payload)
    ) {
      throw new Error("Schema JSON must be an object keyed by schema type");
    }

    this.withSchemas(payload as Partial<TSchemas>);
    return this;
  }

  withSchemaLoader(loader: SchemaLoader<TSchemas>): this {
    this.loader = loader;
    return this;
  }

  withCache(options: SchemaCacheOptions<TSchemas> = {}): this {
    this.cacheOptions = options;
    return this;
  }

  build(): Validator<TSchemas> {
    const validator = new Validator<TSchemas>(this.options);

    if (this.cacheOptions) {
      validator.enableSchemaCache(this.cacheOptions);
    }

    if (this.loader) {
      validator.setSchemaLoader(this.loader);
    }

    if (Object.keys(this.schemas).length > 0) {
      validator.registerSchemas(this.schemas);
    }

    return validator;
  }
}
