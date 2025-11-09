import { describe, it, expect } from "bun:test";
import { Validator } from "../src/validator.ts";
import {
  buildSchemaMap,
  createTypeValidatorFromBuilders,
  createTypeValidatorFromJSON,
  createValidatorFromBuilders,
  defineSchemas,
  validatorBuilder
} from "../src/short-hand.ts";
import { SchemaBuilder } from "../src/schema-builder.ts";

const expressionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type", "value"],
  properties: {
    type: { type: "string", enum: ["literal", "ref"] },
    value: {
      oneOf: [
        { type: ["string", "number", "boolean"] },
        {
          type: "object",
          required: ["path"],
          properties: { path: { type: "string" } }
        }
      ]
    }
  }
};

describe("Validator enhancements", () => {
  it("validates data via the fluent builder and async APIs", async () => {
    const validator = Validator.builder()
      .withOptions({ coerceTypes: true })
      .fromJSON({ "expression-schema": expressionSchema })
      .build();

    const validPayload = { type: "literal", value: 42 };
    const asyncResult = await validator.validateAsync(
      "expression-schema",
      validPayload
    );
    expect(asyncResult.valid).toBeTrue();
    expect(asyncResult.data).toEqual(validPayload);

    let thrown: unknown;
    try {
      await validator.validateStrictAsync("expression-schema", {
        type: "literal"
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeTruthy();
    console.log(thrown);
    expect((thrown as Error).message).toContain("value");
  });

  it("round-trips schemas through JSON helpers and shortcut builders", () => {
    const schemaDump = {
      "form-schema": {
        type: "object",
        additionalProperties: false,
        required: ["id", "steps"],
        properties: {
          id: { type: "string" },
          steps: {
            type: "array",
            minItems: 1,
            items: { type: "object" }
          }
        }
      }
    };

    const validator = new Validator();
    validator.importSchemasFromJSON(schemaDump);
    const exportedObject = validator.exportSchemas();
    expect(exportedObject).toEqual(schemaDump);

    const exportedJSON = validator.exportSchemasToJSON();
    expect(JSON.parse(exportedJSON)).toEqual(schemaDump);

    const formValidator = createTypeValidatorFromJSON(
      "form-schema",
      schemaDump
    );
    const formResult = formValidator.validateStrict({
      id: "signup",
      steps: [{}]
    });
    expect(formResult).toEqual({ id: "signup", steps: [{}] });
  });

  it("hydrates schemas via loader once and relies on the LRU cache afterwards", async () => {
    const loaderSchema = {
      type: "object",
      required: ["slug"],
      properties: {
        slug: { type: "string" }
      }
    };

    let loadCount = 0;
    const validator = validatorBuilder()
      .withCache({ maxEntries: 10, ttlMs: 1_000 })
      .withSchemaLoader(async (type) => {
        if (type !== "cached-schema") {
          return undefined;
        }

        loadCount += 1;
        return loaderSchema;
      })
      .build();

    const payload = { slug: "article" };

    await validator.validateStrictAsync("cached-schema", payload);

    // Manually drop the compiled schema to force rehydration, the cache should prevent a reload.
    (validator as any).validators.delete("cached-schema");
    delete (validator as any).schemas["cached-schema"];

    await validator.validateStrictAsync("cached-schema", payload);
    expect(loadCount).toBe(1);
  });

  it("supports SchemaBuilder DSL and helper conversions", () => {
    const expressionBuilder = SchemaBuilder.object()
      .title("Expression")
      .description("Simple expression schema")
      .property("type", SchemaBuilder.string().enum(["literal", "ref"]), {
        required: true
      })
      .property(
        "value",
        SchemaBuilder.create().anyOf(
          SchemaBuilder.string(),
          SchemaBuilder.number(),
          SchemaBuilder.boolean(),
          SchemaBuilder.object().property("path", SchemaBuilder.string(), {
            required: true
          })
        ),
        { required: true }
      )
      .additionalProperties(false);

    const schemas = defineSchemas({
      "expression-schema": expressionBuilder,
      "form-schema": SchemaBuilder.object()
        .property("id", SchemaBuilder.string(), { required: true })
        .property(
          "steps",
          SchemaBuilder.array()
            .items(
              SchemaBuilder.object().property("title", SchemaBuilder.string(), {
                required: true
              })
            )
            .minItems(1),
          { required: true }
        )
        .additionalProperties(false)
    });

    const plainMap = buildSchemaMap(schemas);
    expect(plainMap["expression-schema"]).toMatchObject({
      type: "object",
      required: ["type", "value"],
      additionalProperties: false
    });

    const manualValidator = new Validator();
    manualValidator.registerSchemaBuilder("expression-schema", expressionBuilder.clone());

    expect(
      manualValidator.validateStrict("expression-schema", {
        type: "literal",
        value: "active"
      })
    ).toEqual({ type: "literal", value: "active" });

    const builderBacked = validatorBuilder()
      .withSchemaBuilder("expression-schema", expressionBuilder.clone())
      .build();

    expect(
      builderBacked.validateStrict("expression-schema", {
        type: "ref",
        value: { path: "profile.age" }
      })
    ).toEqual({
      type: "ref",
      value: { path: "profile.age" }
    });

    const validatorFromBuilders = createValidatorFromBuilders(schemas);
    expect(
      validatorFromBuilders.validate("form-schema", {
        id: "signup",
        steps: [{ title: "Start" }]
      }).valid
    ).toBeTrue();

    const typeValidator = createTypeValidatorFromBuilders(
      "expression-schema",
      schemas
    );
    expect(() =>
      typeValidator.validateStrict({
        type: "literal"
      })
    ).toThrow();
  });
});
