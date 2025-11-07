import {
  Validator,
  type SchemaCacheOptions,
  type SchemaJsonInput,
  type SchemaLoader,
  type SchemaRegistry,
  type ValidatorOptions
} from "./validator.js";
import { SchemaBuilder } from "./schema-builder.js";

export type SchemaSource<TSchemas extends SchemaRegistry = SchemaRegistry> =
  | SchemaBuilder
  | TSchemas[keyof TSchemas];

export type SchemaSourceMap<TSchemas extends SchemaRegistry = SchemaRegistry> =
  Partial<Record<keyof TSchemas, SchemaSource<TSchemas>>>;

const isSchemaBuilder = (input: unknown): input is SchemaBuilder =>
  input instanceof SchemaBuilder;

const toSchemaObject = <TSchema>(
  input: SchemaSource<any>
): TSchema => {
  return (isSchemaBuilder(input) ? input.build() : input) as TSchema;
};

/**
 * Default validator instance that keeps schemas cached for quick reuse
 */
export const defaultValidator = Validator.builder()
  .withCache({ maxEntries: 100 })
  .build();

/**
 * Schema definition helpers for better DX/inference
 */
export const defineSchemas = <
  TSchemas extends SchemaRegistry = SchemaRegistry
>(
  schemas: SchemaSourceMap<TSchemas>
) => schemas;

export const buildSchemaMap = <
  TSchemas extends SchemaRegistry = SchemaRegistry
>(
  schemas: SchemaSourceMap<TSchemas>
): Partial<TSchemas> => {
  const output: Partial<TSchemas> = {};
  for (const [type, schema] of Object.entries(schemas)) {
    if (!schema) continue;
    output[type as keyof TSchemas] = toSchemaObject(schema);
  }
  return output;
};

/**
 * Convenience functions for common validation tasks
 */
export const validateExpression = (data: unknown) =>
  defaultValidator.validate("expression-schema", data);

export const validateExpressionStrict = (data: unknown) =>
  defaultValidator.validateStrict("expression-schema", data);

/**
 * Type-specific validator creators
 */
export const createValidator = (schemaKey: string, schema: any) => {
  const validator = new Validator();
  validator.registerSchema(schemaKey, schema);
  return validator.createTypeValidator(schemaKey);
};

/**
 * Configuration for builder helpers
 */
export interface ValidatorFactoryConfig<
  TSchemas extends SchemaRegistry = SchemaRegistry
> {
  options?: ValidatorOptions;
  cache?: SchemaCacheOptions<TSchemas>;
  loader?: SchemaLoader<TSchemas>;
}

/**
 * Quickly bootstrap a validator from JSON or plain schema maps
 */
export const createValidatorFromJSON = <
  TSchemas extends SchemaRegistry = SchemaRegistry
>(
  schemaJson: SchemaJsonInput<TSchemas>,
  config: ValidatorFactoryConfig<TSchemas> = {}
) => {
  const builder = Validator.builder<TSchemas>();
  if (config.options) {
    builder.withOptions(config.options);
  }
  if (config.cache) {
    builder.withCache(config.cache);
  }
  if (config.loader) {
    builder.withSchemaLoader(config.loader);
  }
  builder.fromJSON(schemaJson);
  return builder.build();
};

/**
 * Builder-friendly variant of createValidatorFromJSON
 */
export const createValidatorFromBuilders = <
  TSchemas extends SchemaRegistry = SchemaRegistry
>(
  schemas: SchemaSourceMap<TSchemas>,
  config: ValidatorFactoryConfig<TSchemas> = {}
) => createValidatorFromJSON<TSchemas>(buildSchemaMap(schemas), config);

/**
 * Convenience for builder access (fluent API)
 */
export const validatorBuilder = <
  TSchemas extends SchemaRegistry = SchemaRegistry
>() => Validator.builder<TSchemas>();

/**
 * Create a type-specific validator from JSON definitions
 */
export const createTypeValidatorFromJSON = <
  TSchemas extends SchemaRegistry = SchemaRegistry,
  K extends keyof TSchemas = keyof TSchemas
>(
  schemaKey: K,
  schemaJson: SchemaJsonInput<TSchemas>,
  config: ValidatorFactoryConfig<TSchemas> = {}
) => createValidatorFromJSON<TSchemas>(schemaJson, config).createTypeValidator(schemaKey);

export const createTypeValidatorFromBuilders = <
  TSchemas extends SchemaRegistry = SchemaRegistry,
  K extends keyof TSchemas = keyof TSchemas
>(
  schemaKey: K,
  schemas: SchemaSourceMap<TSchemas>,
  config: ValidatorFactoryConfig<TSchemas> = {}
) =>
  createValidatorFromBuilders<TSchemas>(schemas, config).createTypeValidator(
    schemaKey
  );
