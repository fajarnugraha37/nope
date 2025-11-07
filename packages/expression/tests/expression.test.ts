import { describe, expect, test } from "bun:test";
import {
  ExpressionBuilder,
  ExpressionEvaluator,
  Ops,
  when,
  Compare,
  MathOps,
  Logic,
  Str,
  Arr,
  $,
  BuilderFactory,
  ExpressionAnalyzer,
  ExpressionValidator,
  ExpressionDebugger,
  type ExpressionSchema,
  type ExecutionContext,
} from "../src/index.js";

describe("Enhanced Expression System", () => {
  test("should create basic expression with ExpressionBuilder", () => {
    const expr = ExpressionBuilder.create("test-001")
      .name("Basic Math Test")
      .description("Test basic math operations")
      .author("Test Author")
      .tags("math", "basic")
      .category("arithmetic")
      .all()
      .plus(Ops.v("a"), 3)
      .multiply(Ops.v("b"), 2)
      .build();

    expect(expr.id).toBe("test-001");
    expect(expr.name).toBe("Basic Math Test");
    expect(expr.description).toBe("Test basic math operations");
    expect(expr.metadata?.author).toBe("Test Author");
    expect(expr.metadata?.tags).toContain("math");
    expect(expr.operations).toHaveLength(2);
  });

  test("should use fluent operations with short-hands", () => {
    const expr = ExpressionBuilder.create("fluent-001")
      .name("Fluent Operations")
      .description("Test fluent API operations")
      .any() // OR combination
      .add(Compare.gt(Ops.v("score"), 80))
      .add(
        Logic.and(
          Compare.eq(Ops.v("status"), "premium"),
          Compare.gte(Ops.v("points"), 1000)
        )
      )
      .build();

    expect(expr.multipleOperations).toBe("or");
    expect(expr.operations).toHaveLength(2);
  });

  test("should create complex conditional expressions", () => {
    const expr = ExpressionBuilder.create("conditional-001")
      .name("Complex Conditional")
      .description("Multi-level conditional logic")
      .all()
      .if(
        Compare.gt(Ops.v("age"), 18),
        when(
          Ops.v("membership"),
          {
            gold: "full_access",
            silver: "limited_access",
            bronze: "basic_access",
          },
          "no_access"
        ),
        "underage"
      )
      .build();

    expect(expr.operations).toHaveLength(1);
  });

  test("should use FluentOps for chained operations", () => {
    const operation = $(Ops.v("score")).multiply(1.5).add(10).gt(100).build();

    expect(operation).toBeDefined();
  });

  test("should use specialized builders", () => {
    const mathOp = BuilderFactory.math
      .add()
      .numbers(1, 2, 3)
      .variables("x", "y")
      .build();

    expect(mathOp).toHaveProperty("+");

    const comparison = BuilderFactory.comparison
      .gt()
      .compare(Ops.v("score"), 80)
      .build();

    expect(comparison).toHaveProperty(">");
  });

  test("should analyze expression dependencies", () => {
    const expr = ExpressionBuilder.create("analysis-test")
      .name("Analysis Test")
      .description("Test expression analysis")
      .all()
      .add(Compare.gt(Ops.v("score"), 80))
      .add(
        Logic.and(
          Compare.eq(Ops.v("status"), "active"),
          Compare.gte(Ops.v("points"), 100)
        )
      )
      .build();

    const variables = ExpressionAnalyzer.extractVariables(expr);
    const summary = ExpressionAnalyzer.generateSummary(expr);

    expect(variables).toContain("score");
    expect(variables).toContain("status");
    expect(variables).toContain("points");
    expect(summary.complexity).toBeGreaterThan(0);
    expect(summary.variablesCount).toBe(3);
  });

  test("should validate expression structure", () => {
    const validExpr = ExpressionBuilder.create("valid-001")
      .name("Valid Expression")
      .description("A valid expression")
      .add(Compare.eq(Ops.v("test"), true))
      .build();

    const validation = ExpressionValidator.validate(validExpr);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);

    // Test invalid expression
    const invalidExpr: ExpressionSchema = {
      id: "",
      name: "",
      description: "",
      multipleOperations: "and",
      operations: [],
    };

    const invalidValidation = ExpressionValidator.validate(invalidExpr);
    expect(invalidValidation.valid).toBe(false);
    expect(invalidValidation.errors.length).toBeGreaterThan(0);
  });

  test("should format expression for debugging", () => {
    const expr = ExpressionBuilder.create("debug-test")
      .name("Debug Test")
      .description("Test expression debugging")
      .add(
        Logic.and(
          Compare.gt(Ops.v("age"), 21),
          Compare.eq(Ops.v("verified"), true)
        )
      )
      .build();

    const formatted = ExpressionDebugger.format(expr);
    const trace = ExpressionDebugger.generateTrace(expr);

    expect(formatted).toContain("Debug Test");
    expect(trace).toContain("Expression: Debug Test");
    expect(trace).toContain("Variables: age, verified");
  });

  test("should evaluate expressions with new evaluator", async () => {
    const expr = ExpressionBuilder.create("eval-test")
      .name("Evaluation Test")
      .description("Test expression evaluation")
      .add(MathOps.add(Ops.v("a"), Ops.v("b")))
      .build();

    const evaluator = new ExpressionEvaluator({
      debug: true,
      timeout: 5000,
    });

    const context: ExecutionContext = {
      data: { a: 5, b: 3 },
    };

    const result = await evaluator.evaluate<number>(expr, context);

    expect(result.success).toBe(true);
    expect(result.value).toBe(8);
    expect(result.metadata?.duration).toBeDefined();
  });

  test("should handle string operations", () => {
    const expr = ExpressionBuilder.create("string-test")
      .name("String Test")
      .description("Test string operations")
      .all()
      .add(Str.contains(Ops.v("text"), "hello"))
      .add(Compare.gt(Str.length(Ops.v("text")), 10))
      .build();

    const variables = ExpressionAnalyzer.extractVariables(expr);
    expect(variables).toContain("text");
  });

  test("should handle array operations", () => {
    const expr = ExpressionBuilder.create("array-test")
      .name("Array Test")
      .description("Test array operations")
      .add(Arr.some(Ops.v("numbers"), Compare.gt(Ops.v("item"), 10)))
      .build();

    const variables = ExpressionAnalyzer.extractVariables(expr);
    expect(variables).toContain("numbers");
    expect(variables).toContain("item");
  });

  test("should create expression from existing schema", () => {
    const originalSchema: ExpressionSchema = {
      id: "original-001",
      name: "Original",
      description: "Original schema",
      multipleOperations: "and",
      operations: [Compare.eq(Ops.v("status"), "active")],
    };

    const builder = ExpressionBuilder.fromSchema(originalSchema);
    const newExpr = builder
      .name("Modified Original")
      .add(Compare.gt(Ops.v("score"), 50))
      .build();

    expect(newExpr.name).toBe("Modified Original");
    expect(newExpr.operations).toHaveLength(2);
  });

  test("should clone and modify builders", () => {
    const original = ExpressionBuilder.create("clone-test")
      .name("Original Builder")
      .description("Original description")
      .add(Compare.eq(Ops.v("test"), true));

    const cloned = original.clone();
    cloned.name("Cloned Builder").add(Compare.gt(Ops.v("score"), 100));

    const originalExpr = original.build();
    const clonedExpr = cloned.build();

    expect(originalExpr.name).toBe("Original Builder");
    expect(clonedExpr.name).toBe("Cloned Builder");
    expect(originalExpr.operations).toHaveLength(1);
    expect(clonedExpr.operations).toHaveLength(2);
  });

  test("should detect expression complexity", () => {
    const simpleExpr = ExpressionBuilder.create("simple")
      .name("Simple")
      .description("Simple expression")
      .add(Compare.eq(Ops.v("x"), 1))
      .build();

    const complexExpr = ExpressionBuilder.create("complex")
      .name("Complex")
      .description("Complex expression")
      .add(
        Arr.map(
          Ops.v("items"),
          Arr.filter(
            Ops.v("subItems"),
            Logic.and(
              Compare.gt(Ops.v("value"), 0),
              Compare.lt(Ops.v("value"), 100),
              Str.contains(Ops.v("category"), "premium")
            )
          )
        )
      )
      .build();

    const simpleComplexity = ExpressionAnalyzer.calculateComplexity(simpleExpr);
    const complexComplexity =
      ExpressionAnalyzer.calculateComplexity(complexExpr);

    expect(complexComplexity).toBeGreaterThan(simpleComplexity);
  });

  test("should generate comprehensive expression summaries", () => {
    const expr = ExpressionBuilder.create("summary-test")
      .name("Summary Test")
      .description("Expression for testing summaries")
      .tags("test", "summary", "analysis")
      .category("testing")
      .priority(1)
      .add(
        Logic.or(
          Compare.gt(Ops.v("score"), 80),
          Logic.and(
            Compare.eq(Ops.v("status"), "vip"),
            Compare.gte(Ops.v("points"), 1000)
          ),
          Str.contains(Ops.v("tags"), "premium")
        )
      )
      .build();

    const summary = ExpressionAnalyzer.generateSummary(expr);

    expect(summary.id).toBe("summary-test");
    expect(summary.name).toBe("Summary Test");
    expect(summary.variablesCount).toBe(4);
    expect(summary.variables).toContain("score");
    expect(summary.variables).toContain("status");
    expect(summary.variables).toContain("points");
    expect(summary.variables).toContain("tags");
    expect(summary.estimatedPerformance).toBeDefined();
  });
});
