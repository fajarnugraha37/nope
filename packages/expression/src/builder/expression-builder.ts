import type {
  ExpressionSchema,
  Operation,
  OperatorOption,
  OperationOperand,
  ValidatorFn,
  ValidateErrorGetter,
  ExpressionMetadata,
  CombinationOperator,
  validateExpressionFn,
} from "../expression.js";
import { ExpressionValidationError } from "../error/index.js";
import { Ops } from "./ops.js";
import { createValidator } from "@fajarnugraha37/validator";
import expressionSchema from "../schema/expression.schema.json" with { type: "json" };

export const defaultValidator = createValidator(
  "expression-schema",
  expressionSchema
);

export class ExpressionBuilder {
  private _id: string;
  private _name?: string;
  private _description?: string;
  private _multipleOperations: CombinationOperator = "and";
  private _operations: Operation[] = [];
  private _metadata: Partial<ExpressionMetadata> = {};
  private _version?: string;

  // Validation
  private _validator?: ValidatorFn;
  private _errors?: ValidateErrorGetter;
  private _strictValidation = false;
  private _validateExpression: validateExpressionFn;

  private constructor(id: string, validateExpression: validateExpressionFn) {
    this._id = id;
    this._validateExpression = validateExpression;
  }

  /**
   * Create a new expression builder
   */
  static create(id: string, validateExpression: validateExpressionFn = defaultValidator.validate): ExpressionBuilder {
    return new ExpressionBuilder(id, validateExpression);
  }

  /**
   * Create from existing schema
   */
  static fromSchema(schema: ExpressionSchema, validateExpression: validateExpressionFn = defaultValidator.validate): ExpressionBuilder {
    const builder = new ExpressionBuilder(schema.id, validateExpression);
    builder._name = schema.name;
    builder._description = schema.description;
    builder._multipleOperations = schema.multipleOperations;
    builder._operations = [...schema.operations];
    builder._metadata = { ...schema.metadata };
    builder._version = schema.version;
    return builder;
  }

  /**
   * Set expression name
   */
  name(name: string): this {
    this._name = name;
    return this;
  }

  /**
   * Set expression description
   */
  description(description: string): this {
    this._description = description;
    return this;
  }

  /**
   * Set version
   */
  version(version: string): this {
    this._version = version;
    return this;
  }

  /**
   * Set metadata
   */
  metadata(metadata: Partial<ExpressionMetadata>): this {
    this._metadata = { ...this._metadata, ...metadata };
    return this;
  }

  /**
   * Add tags to metadata
   */
  tags(...tags: string[]): this {
    this._metadata = {
      ...this._metadata,
      tags: [...(this._metadata.tags || []), ...tags],
    };
    return this;
  }

  /**
   * Set category in metadata
   */
  category(category: string): this {
    this._metadata = { ...this._metadata, category };
    return this;
  }

  /**
   * Set priority in metadata
   */
  priority(priority: number): this {
    this._metadata = { ...this._metadata, priority };
    return this;
  }

  /**
   * Set author in metadata
   */
  author(author: string): this {
    this._metadata = { ...this._metadata, author };
    return this;
  }

  /**
   * Use AND logic for combining operations
   */
  all(): this {
    this._multipleOperations = "and";
    return this;
  }

  /**
   * Use OR logic for combining operations
   */
  any(): this {
    this._multipleOperations = "or";
    return this;
  }

  /**
   * Set combination operator explicitly
   */
  combine(operator: CombinationOperator): this {
    this._multipleOperations = operator;
    return this;
  }

  /**
   * Add a single operation
   */
  add(operation: Operation): this {
    this._operations.push(operation);
    return this;
  }

  /**
   * Add multiple operations
   */
  addMany(...operations: Operation[]): this {
    this._operations.push(...operations);
    return this;
  }

  /**
   * Create and add an operation inline
   */
  op<K extends OperatorOption>(operator: K, ...args: OperationOperand[]): this {
    this._operations.push(Ops.op(operator, ...args));
    return this;
  }

  /**
   * Add a conditional operation
   */
  if(
    condition: OperationOperand,
    thenValue: OperationOperand,
    elseValue?: OperationOperand
  ): this {
    if (elseValue !== undefined) {
      return this.op("if", condition, thenValue, elseValue);
    }
    return this.op("if", condition, thenValue);
  }

  /**
   * Add a switch operation
   */
  switch(
    value: OperationOperand,
    cases: Record<string, OperationOperand>,
    defaultCase?: OperationOperand
  ): this {
    const caseOperations: OperationOperand[] = [value];

    for (const [caseValue, result] of Object.entries(cases)) {
      caseOperations.push(caseValue, result);
    }

    if (defaultCase !== undefined) {
      caseOperations.push(defaultCase);
    }

    return this.op("switch", ...caseOperations);
  }

  /**
   * Math addition operation
   */
  plus(...operands: OperationOperand[]): this {
    return this.op("+", ...operands);
  }

  /**
   * Subtract operation
   */
  subtract(a: OperationOperand, b: OperationOperand): this {
    return this.op("-", a, b);
  }

  /**
   * Multiply operation
   */
  multiply(...operands: OperationOperand[]): this {
    return this.op("*", ...operands);
  }

  /**
   * Divide operation
   */
  divide(a: OperationOperand, b: OperationOperand): this {
    return this.op("/", a, b);
  }

  /**
   * Greater than comparison
   */
  gt(a: OperationOperand, b: OperationOperand): this {
    return this.op(">", a, b);
  }

  /**
   * Greater than or equal comparison
   */
  gte(a: OperationOperand, b: OperationOperand): this {
    return this.op(">=", a, b);
  }

  /**
   * Less than comparison
   */
  lt(a: OperationOperand, b: OperationOperand): this {
    return this.op("<", a, b);
  }

  /**
   * Less than or equal comparison
   */
  lte(a: OperationOperand, b: OperationOperand): this {
    return this.op("<=", a, b);
  }

  /**
   * Equality comparison
   */
  equals(a: OperationOperand, b: OperationOperand): this {
    return this.op("==", a, b);
  }

  /**
   * Strict equality comparison
   */
  strictEquals(a: OperationOperand, b: OperationOperand): this {
    return this.op("===", a, b);
  }

  /**
   * Logical AND operation
   */
  and(...operands: OperationOperand[]): this {
    return this.op("and", ...operands);
  }

  /**
   * Logical OR operation
   */
  or(...operands: OperationOperand[]): this {
    return this.op("or", ...operands);
  }

  /**
   * Logical NOT operation
   */
  not(operand: OperationOperand): this {
    return this.op("not", operand);
  }

  /**
   * Configure validation
   */
  withValidator(validator: ValidatorFn, getErrors: ValidateErrorGetter): this {
    this._validator = validator;
    this._errors = getErrors;
    return this;
  }

  /**
   * Enable strict validation mode
   */
  strictValidation(enabled = true): this {
    this._strictValidation = enabled;
    return this;
  }

  /**
   * Clear all operations
   */
  clear(): this {
    this._operations = [];
    return this;
  }

  /**
   * Clone the builder
   */
  clone(): ExpressionBuilder {
    const cloned = new ExpressionBuilder(this._id + "_copy", this._validateExpression);
    cloned._name = this._name;
    cloned._description = this._description;
    cloned._multipleOperations = this._multipleOperations;
    cloned._operations = [...this._operations];
    cloned._metadata = { ...this._metadata };
    cloned._version = this._version;
    cloned._validator = this._validator;
    cloned._errors = this._errors;
    cloned._strictValidation = this._strictValidation;
    return cloned;
  }

  /**
   * Get current operations count
   */
  get operationsCount(): number {
    return this._operations.length;
  }

  /**
   * Check if builder is empty
   */
  get isEmpty(): boolean {
    return this._operations.length === 0;
  }

  /**
   * Validate required fields
   */
  private validateRequiredFields(): void {
    const errors: string[] = [];

    if (!this._name?.trim()) {
      errors.push("name is required");
    }

    if (!this._description?.trim()) {
      errors.push("description is required");
    }

    if (this._operations.length === 0) {
      errors.push("at least one operation is required");
    }

    if (errors.length > 0) {
      throw new ExpressionValidationError(
        `Expression validation failed: ${errors.join(", ")}`
      );
    }
  }

  /**
   * Validate the expression structure using existing validator
   */
  private validateStructure(schema: ExpressionSchema): void {
    if (this._strictValidation) {
      try {
        const result = this._validateExpression(schema);
        if (!result.valid && result.errors && result.errors.length > 0) {
          const errorMessages = result.errors
            .map(
              (err: any) =>
                `${err.instancePath || err.schemaPath}: ${err.message}`
            )
            .join("; ");
          throw new ExpressionValidationError(
            `Expression structure validation failed: ${errorMessages}`
          );
        }
      } catch (error) {
        if (error instanceof ExpressionValidationError) {
          throw error;
        }
        // If validation fails due to validator issues, throw error
        const errorMessage =
          error instanceof Error ? error.message : "Validation failed";
        throw new ExpressionValidationError(
          `Expression structure validation failed: ${errorMessage}`
        );
      }
    }
  }

  /**
   * Build the expression schema
   */
  build(): ExpressionSchema {
    this.validateRequiredFields();

    // Set timestamps in ISO string format for validation
    const now = new Date().toISOString();
    if (!this._metadata.createdAt) {
      this._metadata = { ...this._metadata, createdAt: now };
    }
    this._metadata = { ...this._metadata, updatedAt: now };

    const schema: ExpressionSchema = {
      id: this._id,
      name: this._name!,
      description: this._description!,
      multipleOperations: this._multipleOperations,
      operations: [...this._operations],
      metadata: { ...this._metadata },
      version: this._version || "1.0.0",
    };

    this.validateStructure(schema);

    return schema;
  }

  /**
   * Build with custom validation
   */
  buildOrThrow(): ExpressionSchema {
    const schema = this.build();

    if (this._validator && !this._validator(schema)) {
      const errors = this._errors ? this._errors() : "validation failed";
      const error = new ExpressionValidationError(
        "Expression validation failed"
      );
      (error as any).details = errors;
      throw error;
    }

    return schema;
  }

  /**
   * Build and return as JSON string
   */
  toJSON(): string {
    return JSON.stringify(this.build(), null, 2);
  }

  /**
   * Get a summary of the builder state
   */
  summary(): string {
    return `ExpressionBuilder(id=${this._id}, name=${
      this._name || "unnamed"
    }, operations=${this._operations.length}, combination=${
      this._multipleOperations
    })`;
  }
}
