export type JsonSchema = Record<string, any>;
export type SchemaLike = JsonSchema | SchemaBuilder;

const clone = <T>(value: T): T => {
  const structuredCloneFn = (globalThis as any).structuredClone;
  if (typeof structuredCloneFn === "function") {
    return structuredCloneFn(value);
  }
  return JSON.parse(JSON.stringify(value));
};

const normalizeInput = (input: SchemaLike): JsonSchema => {
  return input instanceof SchemaBuilder ? input.build() : clone(input);
};

const ensureObject = (value: unknown): Record<string, JsonSchema> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, JsonSchema>;
};

const unique = (values: string[]): string[] => Array.from(new Set(values));

export class SchemaBuilder<TSchema extends JsonSchema = JsonSchema> {
  protected schema: JsonSchema;

  protected constructor(initialSchema: JsonSchema = {}) {
    this.schema = clone(initialSchema);
  }

  /**
   * Create a builder from an existing schema object
   */
  static create(schema: JsonSchema = {}): SchemaBuilder {
    return new SchemaBuilder(schema);
  }

  /**
   * Start an object schema
   */
  static object(): SchemaBuilder {
    return new SchemaBuilder({
      type: "object",
      properties: {},
      required: [],
    });
  }

  /**
   * Start an array schema
   */
  static array(): SchemaBuilder {
    return new SchemaBuilder({
      type: "array",
    });
  }

  /**
   * Start a string schema
   */
  static string(): SchemaBuilder {
    return new SchemaBuilder({
      type: "string",
    });
  }

  /**
   * Start a number schema
   */
  static number(): SchemaBuilder {
    return new SchemaBuilder({
      type: "number",
    });
  }

  /**
   * Start an integer schema
   */
  static integer(): SchemaBuilder {
    return new SchemaBuilder({
      type: "integer",
    });
  }

  /**
   * Start a boolean schema
   */
  static boolean(): SchemaBuilder {
    return new SchemaBuilder({
      type: "boolean",
    });
  }

  /**
   * Start a null schema
   */
  static nil(): SchemaBuilder {
    return new SchemaBuilder({
      type: "null",
    });
  }

  /**
   * Clone the builder (useful for branching)
   */
  clone(): SchemaBuilder<TSchema> {
    return new SchemaBuilder<TSchema>(this.build());
  }

  /**
   * Merge another schema/builder into the current schema
   */
  extend(schema: SchemaLike): this {
    Object.assign(this.schema, normalizeInput(schema));
    return this;
  }

  /**
   * Generic metadata setters
   */
  title(value: string): this {
    this.schema.title = value;
    return this;
  }

  description(value: string): this {
    this.schema.description = value;
    return this;
  }

  default(value: unknown): this {
    this.schema.default = value;
    return this;
  }

  examples(...values: unknown[]): this {
    this.schema.examples = values;
    return this;
  }

  example(value: unknown): this {
    const list = Array.isArray(this.schema.examples)
      ? this.schema.examples
      : [];
    list.push(value);
    this.schema.examples = list;
    return this;
  }

  const(value: unknown): this {
    this.schema.const = value;
    return this;
  }

  enum(values: unknown[]): this {
    this.schema.enum = values;
    return this;
  }

  format(name: string): this {
    this.schema.format = name;
    return this;
  }

  $id(value: string): this {
    this.schema.$id = value;
    return this;
  }

  $schema(value: string): this {
    this.schema.$schema = value;
    return this;
  }

  ref(pointer: string): this {
    this.schema.$ref = pointer;
    return this;
  }

  readOnly(value = true): this {
    this.schema.readOnly = value;
    return this;
  }

  writeOnly(value = true): this {
    this.schema.writeOnly = value;
    return this;
  }

  nullable(value = true): this {
    const current = this.schema.type;
    if (value) {
      if (Array.isArray(current)) {
        this.schema.type = unique([...current, "null"]);
      } else if (current && current !== "null") {
        this.schema.type = unique([current, "null"]);
      } else {
        this.schema.type = "null";
      }
    } else if (Array.isArray(current)) {
      this.schema.type = current.filter((t) => t !== "null");
    } else if (current === "null") {
      delete this.schema.type;
    }
    return this;
  }

  type(value: string | string[]): this {
    this.schema.type = value;
    return this;
  }

  /**
   * Object helpers
   */
  property(
    name: string,
    schema: SchemaLike,
    options: { required?: boolean } = {}
  ): this {
    const properties = ensureObject(this.schema.properties);
    properties[name] = normalizeInput(schema);
    this.schema.properties = properties;
    if (options.required) {
      this.required(name);
    }
    return this;
  }

  properties(
    entries: Record<string, SchemaLike>,
    options: { required?: (keyof typeof entries)[] } = {}
  ): this {
    for (const [name, schema] of Object.entries(entries)) {
      this.property(name, schema);
    }
    if (options.required) {
      this.required(...(options.required as string[]));
    }
    return this;
  }

  required(...fields: string[]): this {
    const requiredList = Array.isArray(this.schema.required)
      ? this.schema.required
      : [];
    this.schema.required = unique([...requiredList, ...fields]);
    return this;
  }

  additionalProperties(value: boolean | SchemaLike): this {
    this.schema.additionalProperties =
      typeof value === "boolean" ? value : normalizeInput(value);
    return this;
  }

  patternProperty(pattern: string, schema: SchemaLike): this {
    const patternProperties = ensureObject(this.schema.patternProperties);
    patternProperties[pattern] = normalizeInput(schema);
    this.schema.patternProperties = patternProperties;
    return this;
  }

  propertyNames(schema: SchemaLike): this {
    this.schema.propertyNames = normalizeInput(schema);
    return this;
  }

  minProperties(count: number): this {
    this.schema.minProperties = count;
    return this;
  }

  maxProperties(count: number): this {
    this.schema.maxProperties = count;
    return this;
  }

  /**
   * Array helpers
   */
  items(schema: SchemaLike): this {
    this.schema.items = normalizeInput(schema);
    return this;
  }

  prefixItems(...schemas: SchemaLike[]): this {
    this.schema.prefixItems = schemas.map(normalizeInput);
    return this;
  }

  contains(schema: SchemaLike): this {
    this.schema.contains = normalizeInput(schema);
    return this;
  }

  minItems(count: number): this {
    this.schema.minItems = count;
    return this;
  }

  maxItems(count: number): this {
    this.schema.maxItems = count;
    return this;
  }

  uniqueItems(value = true): this {
    this.schema.uniqueItems = value;
    return this;
  }

  /**
   * String helpers
   */
  minLength(length: number): this {
    this.schema.minLength = length;
    return this;
  }

  maxLength(length: number): this {
    this.schema.maxLength = length;
    return this;
  }

  pattern(regex: string): this {
    this.schema.pattern = regex;
    return this;
  }

  /**
   * Number helpers
   */
  minimum(value: number): this {
    this.schema.minimum = value;
    return this;
  }

  maximum(value: number): this {
    this.schema.maximum = value;
    return this;
  }

  exclusiveMinimum(value: number): this {
    this.schema.exclusiveMinimum = value;
    return this;
  }

  exclusiveMaximum(value: number): this {
    this.schema.exclusiveMaximum = value;
    return this;
  }

  multipleOf(value: number): this {
    this.schema.multipleOf = value;
    return this;
  }

  /**
   * Logical combinators
   */
  allOf(...schemas: SchemaLike[]): this {
    this.schema.allOf = schemas.map(normalizeInput);
    return this;
  }

  anyOf(...schemas: SchemaLike[]): this {
    this.schema.anyOf = schemas.map(normalizeInput);
    return this;
  }

  oneOf(...schemas: SchemaLike[]): this {
    this.schema.oneOf = schemas.map(normalizeInput);
    return this;
  }

  not(schema: SchemaLike): this {
    this.schema.not = normalizeInput(schema);
    return this;
  }

  ifSchema(schema: SchemaLike): this {
    this.schema.if = normalizeInput(schema);
    return this;
  }

  thenSchema(schema: SchemaLike): this {
    this.schema.then = normalizeInput(schema);
    return this;
  }

  elseSchema(schema: SchemaLike): this {
    this.schema.else = normalizeInput(schema);
    return this;
  }

  /**
   * Definition helpers
   */
  definition(name: string, schema: SchemaLike): this {
    const defs = ensureObject(this.schema.$defs);
    defs[name] = normalizeInput(schema);
    this.schema.$defs = defs;
    return this;
  }

  definitions(entries: Record<string, SchemaLike>): this {
    for (const [name, schema] of Object.entries(entries)) {
      this.definition(name, schema);
    }
    return this;
  }

  /**
   * Arbitrary keyword helper
   */
  meta(key: string, value: unknown): this {
    this.schema[key] = value;
    return this;
  }

  /**
   * Build the schema object (cloned to avoid external mutation)
   */
  build(): TSchema {
    return clone(this.schema) as TSchema;
  }

  /**
   * JSON.stringify support
   */
  toJSON(): TSchema {
    return this.build();
  }
}
