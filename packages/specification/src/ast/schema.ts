import { SchemaBuilder } from "@fajarnugraha37/validator";

// Define the recursive AST schema using JSON Schema with $ref
export const AstSchema = SchemaBuilder.create({
  $id: "ast-node",
  $defs: {
    astNode: {
      oneOf: [
        {
          type: "object",
          required: ["type", "kind", "input"],
          properties: {
            type: { type: "string", const: "op" },
            kind: { type: "string" },
            input: {
              type: "object",
              required: ["path"],
              properties: {
                path: { type: "string" },
                value: {},
                values: { type: "array", items: {} },
                pattern: { type: "string" },
                flags: { type: "string" },
                min: { type: "number" },
                max: { type: "number" },
              },
              additionalProperties: false,
            },
          },
          additionalProperties: false,
        },
        {
          type: "object",
          required: ["type", "node"],
          properties: {
            type: { type: "string", const: "not" },
            node: { $ref: "#/$defs/astNode" },
          },
          additionalProperties: false,
        },
        {
          type: "object",
          required: ["type", "nodes"],
          properties: {
            type: { type: "string", const: "and" },
            nodes: { type: "array", items: { $ref: "#/$defs/astNode" } },
          },
          additionalProperties: false,
        },
        {
          type: "object",
          required: ["type", "nodes"],
          properties: {
            type: { type: "string", const: "or" },
            nodes: { type: "array", items: { $ref: "#/$defs/astNode" } },
          },
          additionalProperties: false,
        },
        {
          type: "object",
          required: ["type", "id"],
          properties: {
            type: { type: "string", const: "ref" },
            id: { type: "string" },
          },
          additionalProperties: false,
        },
      ],
    },
  },
  $ref: "#/$defs/astNode",
}).build();

// Manually define the TypeScript types for AST nodes
export type AstOpNode = {
  type: "op";
  kind: string;
  input: {
    path: string;
    value?: unknown;
    values?: unknown[];
    pattern?: string;
    flags?: string;
    min?: number;
    max?: number;
  };
};

export type AstNotNode = {
  type: "not";
  node: AstNode;
};

export type AstAndNode = {
  type: "and";
  nodes: AstNode[];
};

export type AstOrNode = {
  type: "or";
  nodes: AstNode[];
};

export type AstRefNode = {
  type: "ref";
  id: string;
};

export type AstNode = AstOpNode | AstNotNode | AstAndNode | AstOrNode | AstRefNode;
