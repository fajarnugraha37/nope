# Architecture Guide

## Overview

`@fajarnugraha37/specification` is a composable specification pattern implementation for TypeScript. It provides a powerful abstraction for defining, combining, and evaluating business rules in a type-safe, testable, and portable way.

## Core Philosophy

### Design Principles

1. **Composability**: Specifications can be combined using boolean logic (AND, OR, NOT)
2. **Immutability**: Specifications never mutate; combinators create new instances
3. **Type Safety**: Full TypeScript support with generic types throughout
4. **Extensibility**: Plugin system for custom operators and adapters
5. **Portability**: Serialize to AST for persistence and database query compilation
6. **Performance**: Memoization support and short-circuit evaluation
7. **Debuggability**: Rich explain trees with failure reasons and timing

### Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                         DSL Layer                           │
│  (spec.field("age").gte(18), fluent API, type safety)      │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     Specification Layer                      │
│  (BaseSpec, CompositeSpec, evaluation, combinators)         │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      Operator Layer                          │
│  (FieldSpec, 14 built-in operators, custom operators)       │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      Extension Points                        │
│  (Registry, Plugins, Adapters, Serialization, Humanizer)   │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

```
src/
├── core/                        # Core specification system
│   ├── base-spec.ts            # BaseSpec abstract class, CompositeSpec
│   ├── types.ts                # Core type definitions and interfaces
│   ├── registry.ts             # Operator and spec registration
│   ├── combinators.ts          # all(), any(), none(), xor() helpers
│   ├── evaluate.ts             # Evaluation utilities
│   └── memo.ts                 # Memoization support
│
├── dsl/                         # Fluent DSL for building specs
│   ├── spec-builder.ts         # SpecDSL, FieldBuilder, createSpecDSL()
│   └── humanizer.ts            # Human-readable template system
│
├── ops/                         # Built-in operators
│   ├── builtins.ts             # 14 standard operators (eq, gte, contains, etc.)
│   ├── factory.ts              # createFieldOperator() helper
│   └── field-spec.ts           # FieldSpec implementation
│
├── ast/                         # AST serialization
│   ├── schema.ts               # JSON Schema definition
│   └── serializer.ts           # toAst() and fromAst()
│
├── adapters/                    # Database query compilers
│   ├── adapter.ts              # Adapter interface
│   ├── prisma.ts               # Prisma adapter
│   └── mongo.ts                # MongoDB adapter
│
├── plugins/                     # Plugin system
│   ├── create-plugin.ts        # Plugin factory
│   ├── geo.ts                  # Geospatial operators
│   ├── time.ts                 # Time-based operators
│   └── string.ts               # String operators
│
└── utils/                       # Utilities
    ├── errors.ts               # Error classes
    ├── hash.ts                 # Hashing for memoization
    ├── timing.ts               # Performance measurement
    ├── types.ts                # Type utilities
    └── explain.ts              # Explain tree utilities
```

## Code Flow

### 1. Building a Specification

```typescript
// User writes:
const spec = spec.field<User>("age").gte(18);

// Flow:
// 1. spec.field("age") creates FieldBuilder
// 2. .gte(18) calls registry.getOperator("gte")
// 3. Operator creates FieldSpec instance
// 4. Returns Specification<User>
```

**Internal Steps:**
1. `createSpecDSL()` creates the `spec` singleton with built-in operators
2. `spec.field("age")` returns `FieldBuilderImpl` with path "age"
3. `.gte(18)` calls `factory("gte", { path: "age", value: 18 })`
4. Factory retrieves `gteOperator` from registry
5. `gteOperator.create()` instantiates `FieldSpec` with:
   - `kind: "gte"`
   - `path: "age"`
   - `input: { path: "age", value: 18 }`
   - `predicate: (actual) => actual >= 18`

### 2. Combining Specifications

```typescript
// User writes:
const spec = ageSpec.and(emailSpec);

// Flow:
// 1. .and() calls createAllSpec([ageSpec, emailSpec])
// 2. Returns CompositeSpec with mode="and"
```

**Internal Steps:**
1. `BaseSpec.and(other)` is called on `ageSpec`
2. Calls `createAllSpec([this, other])`
3. Creates `CompositeSpec` with:
   - `mode: "and"`
   - `specs: [ageSpec, emailSpec]`
4. Returns new `CompositeSpec` instance

### 3. Evaluating a Specification

```typescript
// User writes:
const pass = spec.isSatisfiedBy({ age: 25 });

// Flow:
// 1. BaseSpec.isSatisfiedBy() called
// 2. Checks memoization cache
// 3. Calls evaluate() (implemented by subclass)
// 4. For CompositeSpec: evaluates children with short-circuit
// 5. For FieldSpec: extracts field value and runs predicate
// 6. Returns boolean result
```

**Internal Steps (FieldSpec):**
1. `isSatisfiedBy({ age: 25 })` enters `BaseSpec.isSatisfiedBy()`
2. Fires `onEvaluateStart` hook if configured
3. Checks `memoizer.get(value)` - cache miss
4. Calls `this.evaluate(value)` (delegated to FieldSpec)
5. FieldSpec:
   - Extracts field: `actual = value["age"] = 25`
   - Runs predicate: `25 >= 18 = true`
6. Stores in memoizer: `memoizer.set(value, true)`
7. Fires `onEvaluateEnd` hook
8. Returns `true`

**Internal Steps (CompositeSpec with AND):**
1. `isSatisfiedBy(value)` enters `BaseSpec.isSatisfiedBy()`
2. Calls `this.evaluate(value)` (delegated to CompositeSpec)
3. CompositeSpec with mode="and":
   - Checks if any child is async
   - If all sync: `specs.every(s => s.isSatisfiedBy(value))`
   - JavaScript's `every()` short-circuits on first `false`
4. Returns boolean result

### 4. Generating Explain Tree

```typescript
// User writes:
const tree = spec.explain({ age: 15 });

// Flow:
// 1. BaseSpec.explain() called
// 2. Calls describe() to create base node
// 3. Times the evaluation
// 4. For CompositeSpec: recursively explains children
// 5. For FieldSpec: includes path, operator, expected/actual values
// 6. Returns ExplainNode with pass/fail and reason
```

**Internal Steps:**
1. `explain({ age: 15 })` enters `BaseSpec.explain()`
2. Calls `describe()` to create base node:
   ```typescript
   { id: "age_check", name: "Age Check", pass: "unknown" }
   ```
3. Wraps evaluation in `timeIt()`:
   - Calls `this.run(value)` → `this.evaluate(value)`
   - Measures duration
4. FieldSpec evaluation:
   - Extracts `actual = 15`
   - Runs predicate: `15 >= 18 = false`
5. Enhances node with failure context:
   ```typescript
   {
     id: "age_check",
     pass: false,
     path: "age",
     operator: "gte",
     expectedValue: 18,
     actualValue: 15,
     reason: "age (15) must be >= 18",
     durationMs: 0.023
   }
   ```
6. Returns enhanced ExplainNode

### 5. Serializing to AST

```typescript
// User writes:
const ast = toAst(spec);

// Flow:
// 1. Check if spec is FieldSpec → operator node
// 2. Check if spec is CompositeSpec → composite node
// 3. Recursively convert children
// 4. Returns AST structure
```

**Internal Steps:**
1. `toAst(spec)` enters serializer
2. Checks `spec instanceof FieldSpec`:
   - Calls `spec.toJSON()` → `{ kind, path, input }`
   - Returns: `{ type: "op", kind: "gte", input: { path: "age", value: 18 } }`
3. For CompositeSpec:
   - Gets `descriptor` → `{ mode: "and", specs: [...] }`
   - Recursively calls `toAst()` on children
   - Returns: `{ type: "and", nodes: [...] }`
4. Result can be `JSON.stringify()`'d for storage

### 6. Compiling to Database Query

```typescript
// User writes:
const query = prismaAdapter.compile(spec);

// Flow:
// 1. Convert spec to AST
// 2. Recursively compile AST nodes
// 3. Map operators to Prisma query syntax
// 4. Returns Prisma WHERE clause
```

**Internal Steps:**
1. `prismaAdapter.compile(spec)` called
2. Calls `toAst(spec)` to get AST
3. Calls `compileAst(ast)`:
   - For `{ type: "op", kind: "gte", input: { path: "age", value: 18 } }`:
     - Calls `compileOp(node)`
     - Returns `{ age: { gte: 18 } }`
   - For `{ type: "and", nodes: [...] }`:
     - Maps children with `compileAst()`
     - Returns `{ AND: [...] }`
4. Result ready for Prisma:
   ```typescript
   await prisma.user.findMany({ where: query });
   ```

## Key Design Patterns

### 1. Specification Pattern

Encapsulates business rules as objects that can be evaluated, combined, and reused.

**Implementation:**
- `Specification<T>` interface defines the contract
- `BaseSpec<T>` provides common implementation
- Subclasses implement `evaluate()` method

### 2. Composite Pattern

Specifications can contain other specifications, forming a tree structure.

**Implementation:**
- `CompositeSpec` holds array of child specs
- Evaluates children using `and`, `or`, `not` logic
- Supports recursive explain tree generation

### 3. Builder Pattern

Fluent API for constructing specifications in a readable way.

**Implementation:**
- `FieldBuilder` interface with operator methods
- `FieldBuilderImpl` delegates to operator factory
- Type-safe paths via TypeScript mapped types

### 4. Factory Pattern

Operators create specifications without exposing construction details.

**Implementation:**
- `Operator<I, T>` interface with `create(input: I)` method
- `createFieldOperator()` helper simplifies operator creation
- Registry manages operator instances

### 5. Registry Pattern

Centralized catalog of operators and named specifications.

**Implementation:**
- `Registry` interface with add/get methods
- `RegistryImpl` uses Maps for storage
- Prevents duplicate registrations

### 6. Visitor Pattern (AST)

Traverse and transform specification trees via AST.

**Implementation:**
- `toAst()` converts specs to AST nodes
- `fromAst()` reconstructs specs from AST
- Adapters "visit" AST nodes to generate queries

### 7. Template Method (BaseSpec)

`BaseSpec` defines evaluation skeleton, subclasses fill in details.

**Implementation:**
- `isSatisfiedBy()` calls `evaluate()` (abstract)
- Handles memoization and hooks
- Subclasses only implement `evaluate()`

### 8. Strategy Pattern (Operators)

Different evaluation strategies encapsulated as operators.

**Implementation:**
- Each operator has unique predicate logic
- Swappable via registry
- Custom operators extend system

## Extension Points

### 1. Custom Operators

```typescript
import { createFieldOperator } from "@fajarnugraha37/specification";

const divisibleByOperator = createFieldOperator({
  kind: "divisibleBy",
  reason: (input) => `${input.path} must be divisible by ${input.value}`,
  predicate: ({ actual, input }) => {
    return typeof actual === "number" && actual % input.value === 0;
  }
});

spec.registry.addOperator(divisibleByOperator);
```

### 2. Plugins

```typescript
import { createPlugin } from "@fajarnugraha37/specification";

export const mathPlugin = createPlugin({
  name: "math-plugin",
  version: "1.0.0",
  register: (registry) => {
    registry.addOperator(divisibleByOperator);
    registry.addOperator(betweenOperator);
  }
});

mathPlugin.register(spec.registry);
```

### 3. Custom Adapters

```typescript
import { Adapter } from "@fajarnugraha37/specification";

export const sqlAdapter: Adapter<string> = {
  compile(spec) {
    const ast = toAst(spec);
    return compileToSQL(ast); // Your SQL generation logic
  }
};

const sql = sqlAdapter.compile(spec);
// "WHERE age >= 18 AND status = 'active'"
```

### 4. Custom Context

```typescript
interface MyContext extends SpecContext {
  userId: string;
  roles: string[];
  permissions: Set<string>;
}

const spec = spec.field<User, MyContext>("age").gte(18);

spec.isSatisfiedBy(user, { 
  userId: "123",
  roles: ["admin"],
  permissions: new Set(["read", "write"])
});
```

### 5. Custom Hashers

```typescript
const spec = new MySpec("id", {
  memoize: true,
  hasher: (user) => `${user.id}:${user.email}:${user.status}`
});
```

## Performance Considerations

### Short-Circuit Evaluation

AND/OR combinators stop evaluation early:
- **AND**: Stops on first `false`
- **OR**: Stops on first `true`

**Optimization:** Put cheapest/most-likely-to-fail specs first.

### Memoization

Cache evaluation results for repeated values:

```typescript
const spec = new MySpec("id", { 
  memoize: true,
  hasher: (value) => JSON.stringify(value)
});

// First call: evaluates and caches
spec.isSatisfiedBy(user); // 1ms

// Subsequent calls: instant
spec.isSatisfiedBy(user); // 0.01ms (from cache)
```

### Nesting Depth

Each nesting level adds ~20-30% overhead. Keep specs shallow (< 3 levels).

**Good:**
```typescript
all(spec1, spec2, spec3)
```

**Avoid:**
```typescript
all(
  any(spec1, all(spec2, any(spec3, spec4))),
  all(spec5, any(spec6, spec7))
)
```

## Testing Strategy

### Unit Tests

Test individual specifications in isolation:

```typescript
describe("age specification", () => {
  const spec = spec.field<User>("age").gte(18);

  test("passes for adults", () => {
    expect(spec.isSatisfiedBy({ age: 25 })).toBe(true);
  });

  test("fails for minors", () => {
    expect(spec.isSatisfiedBy({ age: 15 })).toBe(false);
  });
});
```

### Property-Based Tests

Use `fast-check` to verify laws and invariants:

```typescript
import * as fc from "fast-check";

test("AND is commutative", () => {
  fc.assert(
    fc.property(specArbitrary, specArbitrary, valueArbitrary, (a, b, value) => {
      const ab = all(a, b).isSatisfiedBy(value);
      const ba = all(b, a).isSatisfiedBy(value);
      return ab === ba;
    })
  );
});
```

### Integration Tests

Test adapter compilation end-to-end:

```typescript
test("compiles to valid Prisma query", async () => {
  const spec = all(
    spec.field<User>("age").gte(18),
    spec.field<User>("status").eq("active")
  );

  const query = prismaAdapter.compile(spec);
  const users = await prisma.user.findMany({ where: query });
  
  expect(users.every(u => u.age >= 18 && u.status === "active")).toBe(true);
});
```

## Error Handling

### Error Types

1. **SpecificationError**: Base error class
   - `SPEC_ASYNC_REQUIRED`: Sync evaluation of async spec
   - `SPEC_REGISTRY_DUPLICATE`: Duplicate registration
   - `SPEC_REGISTRY_UNKNOWN`: Unknown operator/spec
   - `SPEC_AST_INVALID`: Invalid AST structure
   - `SPEC_VALIDATION`: Validation failure

### Error Messages

Provide clear, actionable messages:

```typescript
throw new SpecificationError(
  "SPEC_ASYNC_REQUIRED",
  `Specification "${this.id}" requires async evaluation. Use isSatisfiedByAsync().`
);
```

## Security Considerations

### Safe Serialization

- No `eval()` or `Function()` constructor
- JSON Schema validation for AST
- Registry prevents code injection

### Input Validation

- Validate operator inputs
- Sanitize field paths
- Check value types

### Context Isolation

- Context is read-only during evaluation
- No side effects in predicates
- Pure functions only

## Migration Guide

### From Manual Validation

**Before:**
```typescript
function isValid(user: User): boolean {
  return user.age >= 18 && user.email && user.status === "active";
}
```

**After:**
```typescript
const isValid = all(
  spec.field<User>("age").gte(18),
  spec.field<User>("email").exists(),
  spec.field<User>("status").eq("active")
);
```

**Benefits:**
- Composable and reusable
- Testable in isolation
- Can serialize to database queries
- Rich explain output for debugging

## Best Practices

1. **Use Type-Safe Builder**: Prefer `spec.field<T>()` over `spec.op.*`
2. **Keep Specs Simple**: Single responsibility per spec
3. **Name Your Specs**: Use metadata for debugging
4. **Leverage Combinators**: Reuse specs via `all()`, `any()`, `not()`
5. **Enable Memoization**: For expensive predicates with repeated values
6. **Order Matters**: Put fast/likely-to-fail specs first in AND
7. **Test With Property-Based Tests**: Verify laws and invariants
8. **Use Explain Trees**: Debug complex specifications
9. **Profile Performance**: Use `explainAsync()` for accurate timing
10. **Document Custom Operators**: Include examples and edge cases

## Troubleshooting

### Issue: "Specification requires async evaluation"

**Cause:** Calling `isSatisfiedBy()` on async spec.

**Solution:** Use `isSatisfiedByAsync()` instead.

### Issue: "Operator not registered"

**Cause:** Using operator before registering plugin.

**Solution:** Register plugin before using operators:
```typescript
geoPlugin.register(spec.registry);
```

### Issue: Slow evaluation

**Causes:**
- Deep nesting (> 3 levels)
- Missing memoization on expensive predicates
- Poor spec ordering in AND/OR

**Solutions:**
- Flatten nested specs
- Enable memoization with custom hasher
- Profile with `explain()` to find bottlenecks

### Issue: AST deserialization fails

**Cause:** AST references unknown operator or spec.

**Solution:** Ensure all operators/specs are registered in the registry passed to `fromAst()`.

## Roadmap

See [ROADMAP.md](../ROADMAP.md) for detailed implementation status and future plans.

## Contributing

Contributions welcome! See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

## License

MIT - see [LICENSE](../LICENSE) for details.
