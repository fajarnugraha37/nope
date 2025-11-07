import type {
  OperatorOption,
  OperationOperand,
  Operation,
} from "../expression.js";
import { Ops } from "./ops.js";

export class OperationBuilder {
  private _operator!: OperatorOption;
  private _args: OperationOperand[] = [];

  /**
   * Create a new operation builder
   */
  static create(operator: OperatorOption): OperationBuilder {
    const builder = new OperationBuilder();
    builder._operator = operator;
    return builder;
  }

  /**
   * Create builder from existing operation
   */
  static fromOperation(operation: Operation): OperationBuilder {
    const entries = Object.entries(operation);
    if (entries.length !== 1) {
      throw new Error("Operation must have exactly one operator");
    }

    const [operator, args] = entries[0]!;
    const builder = new OperationBuilder();
    builder._operator = operator as OperatorOption;
    builder._args = Array.isArray(args) ? [...args] : [args];
    return builder;
  }

  /**
   * Add arguments to the operation
   */
  arg(...items: OperationOperand[]): this {
    this._args.push(...items);
    return this;
  }

  /**
   * Add a nested operation using another builder
   */
  nest(builder: OperationBuilder): this {
    this._args.push(builder.build());
    return this;
  }

  /**
   * Add a variable reference
   */
  var(name: string, defaultValue?: unknown): this {
    this._args.push(Ops.v(name, defaultValue));
    return this;
  }

  /**
   * Add a literal value
   */
  literal(value: unknown): this {
    this._args.push(Ops.literal(value));
    return this;
  }

  /**
   * Add a value array
   */
  val(values: readonly string[]): this {
    this._args.push(Ops.val(values));
    return this;
  }

  /**
   * Add a reference to another expression
   */
  ref(id: string): this {
    this._args.push(Ops.ref(id));
    return this;
  }

  /**
   * Clear all arguments
   */
  clear(): this {
    this._args = [];
    return this;
  }

  /**
   * Get the current operator
   */
  get operator(): OperatorOption {
    return this._operator;
  }

  /**
   * Get the current arguments
   */
  get args(): readonly OperationOperand[] {
    return [...this._args];
  }

  /**
   * Get the number of arguments
   */
  get argCount(): number {
    return this._args.length;
  }

  /**
   * Check if builder has arguments
   */
  get hasArgs(): boolean {
    return this._args.length > 0;
  }

  /**
   * Clone the builder
   */
  clone(): OperationBuilder {
    const cloned = new OperationBuilder();
    cloned._operator = this._operator;
    cloned._args = [...this._args];
    return cloned;
  }

  /**
   * Validate the operation
   */
  validate(): boolean {
    try {
      this.build();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Build the final operation
   */
  build(): Operation {
    if (!this._operator) {
      throw new Error("Operator is required");
    }

    return Ops.op(this._operator, ...this._args);
  }

  /**
   * Convert to JSON string
   */
  toJSON(): string {
    return JSON.stringify(this.build(), null, 2);
  }

  /**
   * Get a summary of the builder state
   */
  toString(): string {
    return `OperationBuilder(${this._operator}, args=${this._args.length})`;
  }
}

/**
 * Specialized builders for different operation types
 */
export class MathOperationBuilder extends OperationBuilder {
  static add(): MathOperationBuilder {
    return new MathOperationBuilder().setOperator("+");
  }

  static subtract(): MathOperationBuilder {
    return new MathOperationBuilder().setOperator("-");
  }

  static multiply(): MathOperationBuilder {
    return new MathOperationBuilder().setOperator("*");
  }

  static divide(): MathOperationBuilder {
    return new MathOperationBuilder().setOperator("/");
  }

  static modulo(): MathOperationBuilder {
    return new MathOperationBuilder().setOperator("%");
  }

  static power(): MathOperationBuilder {
    return new MathOperationBuilder().setOperator("**");
  }

  static min(): MathOperationBuilder {
    return new MathOperationBuilder().setOperator("min");
  }

  static max(): MathOperationBuilder {
    return new MathOperationBuilder().setOperator("max");
  }

  private setOperator(op: string): this {
    (this as any)._operator = op;
    return this;
  }

  /**
   * Add numeric operands with validation
   */
  numbers(...values: number[]): this {
    return this.arg(...values);
  }

  /**
   * Add variable operands
   */
  variables(...names: string[]): this {
    names.forEach((name) => this.var(name));
    return this;
  }
}

export class ComparisonOperationBuilder extends OperationBuilder {
  static eq(): ComparisonOperationBuilder {
    return new ComparisonOperationBuilder().setOperator("==");
  }

  static strictEq(): ComparisonOperationBuilder {
    return new ComparisonOperationBuilder().setOperator("===");
  }

  static neq(): ComparisonOperationBuilder {
    return new ComparisonOperationBuilder().setOperator("!=");
  }

  static strictNeq(): ComparisonOperationBuilder {
    return new ComparisonOperationBuilder().setOperator("!==");
  }

  static gt(): ComparisonOperationBuilder {
    return new ComparisonOperationBuilder().setOperator(">");
  }

  static gte(): ComparisonOperationBuilder {
    return new ComparisonOperationBuilder().setOperator(">=");
  }

  static lt(): ComparisonOperationBuilder {
    return new ComparisonOperationBuilder().setOperator("<");
  }

  static lte(): ComparisonOperationBuilder {
    return new ComparisonOperationBuilder().setOperator("<=");
  }

  private setOperator(op: string): this {
    (this as any)._operator = op;
    return this;
  }

  /**
   * Set left and right operands for binary comparison
   */
  compare(left: OperationOperand, right: OperationOperand): this {
    return this.clear().arg(left, right);
  }
}

export class LogicOperationBuilder extends OperationBuilder {
  static and(): LogicOperationBuilder {
    return new LogicOperationBuilder().setOperator("and");
  }

  static or(): LogicOperationBuilder {
    return new LogicOperationBuilder().setOperator("or");
  }

  static not(): LogicOperationBuilder {
    return new LogicOperationBuilder().setOperator("not");
  }

  static xor(): LogicOperationBuilder {
    return new LogicOperationBuilder().setOperator("xor");
  }

  private setOperator(op: string): this {
    (this as any)._operator = op;
    return this;
  }

  /**
   * Add multiple conditions for AND/OR operations
   */
  conditions(...conditions: OperationOperand[]): this {
    return this.arg(...conditions);
  }

  /**
   * Add a single condition for NOT operation
   */
  condition(condition: OperationOperand): this {
    return this.clear().arg(condition);
  }
}

export class ArrayOperationBuilder extends OperationBuilder {
  static map(): ArrayOperationBuilder {
    return new ArrayOperationBuilder().setOperator("map");
  }

  static filter(): ArrayOperationBuilder {
    return new ArrayOperationBuilder().setOperator("filter");
  }

  static reduce(): ArrayOperationBuilder {
    return new ArrayOperationBuilder().setOperator("reduce");
  }

  static find(): ArrayOperationBuilder {
    return new ArrayOperationBuilder().setOperator("find");
  }

  static every(): ArrayOperationBuilder {
    return new ArrayOperationBuilder().setOperator("every");
  }

  static some(): ArrayOperationBuilder {
    return new ArrayOperationBuilder().setOperator("some");
  }

  private setOperator(op: string): this {
    (this as any)._operator = op;
    return this;
  }

  /**
   * Set array and callback for higher-order operations
   */
  array(array: OperationOperand): this {
    if (this.argCount === 0) {
      return this.arg(array);
    }
    throw new Error("Array already set");
  }

  /**
   * Set callback function for array operations
   */
  callback(callback: OperationOperand): this {
    if (this.argCount === 1) {
      return this.arg(callback);
    }
    throw new Error("Callback can only be set after array");
  }

  /**
   * Set initial value for reduce operation
   */
  initialValue(value: OperationOperand): this {
    if (this.operator === "reduce" && this.argCount === 2) {
      return this.arg(value);
    }
    throw new Error(
      "Initial value only valid for reduce operation with array and callback set"
    );
  }
}

/**
 * Factory for creating specialized builders
 */
export class BuilderFactory {
  static math = MathOperationBuilder;
  static comparison = ComparisonOperationBuilder;
  static logic = LogicOperationBuilder;
  static array = ArrayOperationBuilder;

  static operation(operator: OperatorOption): OperationBuilder {
    return OperationBuilder.create(operator);
  }

  static fromOperation(operation: Operation): OperationBuilder {
    return OperationBuilder.fromOperation(operation);
  }
}
