import {
  Validator,
  type SchemaCacheOptions,
  type SchemaJsonInput,
  type SchemaLoader,
  type SchemaRegistry,
  type ValidatorOptions
} from "./validator.js";

/**
 * Default validator instance that keeps schemas cached for quick reuse
 */
export const defaultValidator = Validator.builder()
  .withCache({ maxEntries: 100 })
  .build();

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
