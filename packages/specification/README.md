# @fajarnugraha37/specification

[![npm version](https://img.shields.io/npm/v/@fajarnugraha37/specification.svg)](https://www.npmjs.com/package/@fajarnugraha37/specification)

> An extensible specification-pattern toolkit for TypeScript with strong typing, fluent builders, JSON AST, adapters, and plugin hooks.

## Table of Contents

1. [Installation](#installation)
2. [Why specification?](#why-specification)
3. [Quick start](#quick-start)
4. [Core concepts](#core-concepts)
5. [Usage catalog](#usage-catalog)
6. [Advanced features](#advanced-features)
7. [Cookbook](#cookbook)
8. [API reference](#api-reference)
9. [FAQ & troubleshooting](#faq--troubleshooting)

## Installation

```bash
# Node.js with npm
npm install @fajarnugraha37/specification

# Node.js with pnpm
pnpm add @fajarnugraha37/specification

# Node.js with yarn
yarn add @fajarnugraha37/specification

# Bun
bun add @fajarnugraha37/specification

# Deno
deno add npm:@fajarnugraha37/specification
```

## Why specification?

The **Specification Pattern** is a domain-driven design pattern that encapsulates business rules as composable, reusable objects. This library provides:

### Key Benefits

- **Type Safety**: Full TypeScript support with generic types for your domain models
- **Composability**: Build complex rules from simple specifications using logical operators (`and`, `or`, `not`)
- **Portability**: Serialize specifications to JSON AST and deserialize them across different contexts
- **Extensibility**: Plugin system for custom operators and domain-specific rules
- **Database Integration**: Compile specifications to Prisma/MongoDB queries
- **Testability**: Isolated, testable business logic separate from infrastructure
- **Maintainability**: Clear separation between rule definition and rule execution

### Real-World Use Cases

1. **Access Control**: Define who can access what resources
2. **Business Rules**: Encode discount eligibility, approval workflows, etc.
3. **Query Building**: Generate database queries from user-defined filters
4. **Validation**: Complex domain validation rules
5. **Feature Flags**: Dynamic feature enablement based on user attributes
6. **Content Filtering**: Filter lists based on complex criteria

## Quick start

```ts
import { spec, all, any } from "@fajarnugraha37/specification";

interface User {
  age: number;
  role: string;
  isActive: boolean;
}

// Simple specification
const isAdult = spec.field<User>("age").gte(18);

// Composite specification
const isAdultAdmin = all<User>(
  spec.field<User>("age").gte(18),
  spec.field<User>("role").eq("admin"),
  spec.field<User>("isActive").eq(true),
);

// Evaluate
const user = { age: 21, role: "admin", isActive: true };
console.log(isAdultAdmin.isSatisfiedBy(user)); // true

// Fluent chaining
const eligibleUser = spec
  .field<User>("age").gte(18)
  .and(spec.field<User>("isActive").eq(true))
  .or(spec.field<User>("role").eq("vip"));

// Async evaluation
const result = await eligibleUser.isSatisfiedByAsync(user);
```

## Core concepts

### 1. Specifications

A `Specification<T>` represents a business rule that can be evaluated against a candidate of type `T`:

```ts
interface Specification<T> {
  isSatisfiedBy(candidate: T): boolean;
  isSatisfiedByAsync(candidate: T): Promise<boolean>;
  and(other: Specification<T>): Specification<T>;
  or(other: Specification<T>): Specification<T>;
  not(): Specification<T>;
  explain(candidate: T): ExplainNode;
}
```

### 2. Field Specifications

Use `spec.field()` to create specifications for object properties:

```ts
interface Product {
  name: string;
  price: number;
  stock: number;
  tags: string[];
}

// Comparison operators
spec.field<Product>("price").eq(100);       // equals
spec.field<Product>("price").ne(100);       // not equals
spec.field<Product>("price").lt(100);       // less than
spec.field<Product>("price").lte(100);      // less than or equal
spec.field<Product>("price").gt(50);        // greater than
spec.field<Product>("price").gte(50);       // greater than or equal

// Collection operators
spec.field<Product>("tags").in(["sale", "new"]);
spec.field<Product>("tags").notIn(["discontinued"]);
spec.field<Product>("tags").contains("featured");

// Existence operators
spec.field<Product>("name").exists();
spec.field<Product>("description").missing();

// String operators
spec.field<Product>("name").regex("^Pro");
spec.field<Product>("name").startsWith("Product");
spec.field<Product>("name").endsWith("A");
```

### 3. Logical Combinators

Combine specifications using logical operators:

```ts
// AND - all must be true
const affordableInStock = all<Product>(
  spec.field<Product>("price").lte(100),
  spec.field<Product>("stock").gt(0),
);

// OR - at least one must be true
const eligibleForDiscount = any<Product>(
  spec.field<Product>("price").gt(500),
  spec.field<Product>("tags").contains("vip"),
);

// NOT - invert the result
const notExpensive = spec.field<Product>("price").gte(1000).not();

// Fluent chaining
const featured = spec
  .field<Product>("tags").contains("featured")
  .and(spec.field<Product>("stock").gt(0))
  .or(spec.field<Product>("price").lt(50));
```

### 4. Operators

Operators are reusable specification factories registered in a registry:

```ts
import { createRegistry, builtInOperators } from "@fajarnugraha37/specification";

const registry = createRegistry({ operators: builtInOperators });

// Built-in operators: eq, ne, lt, lte, gt, gte, in, notIn, 
// regex, startsWith, endsWith, contains, exists, missing
```

### 5. AST Serialization

Convert specifications to/from JSON for storage or transmission:

```ts
import { toAst, fromAst } from "@fajarnugraha37/specification";

// Serialize to JSON
const rule = spec.field<User>("age").gte(18);
const ast = toAst(rule);
console.log(JSON.stringify(ast, null, 2));
// {
//   "type": "op",
//   "kind": "gte",
//   "input": { "path": "age", "value": 18 }
// }

// Deserialize from JSON
const registry = createRegistry({ operators: builtInOperators });
const rebuilt = fromAst<User>(ast, registry);
rebuilt.isSatisfiedBy({ age: 21 }); // true
```

## Usage catalog

### Basic Field Operations

```ts
interface Order {
  total: number;
  status: string;
  items: string[];
  createdAt: Date;
}

// Numeric comparisons
const largeOrder = spec.field<Order>("total").gte(1000);
const smallOrder = spec.field<Order>("total").lt(100);

// String matching
const pendingOrder = spec.field<Order>("status").eq("pending");
const notCancelled = spec.field<Order>("status").ne("cancelled");

// Collection operations
const hasGadgets = spec.field<Order>("items").contains("gadget");
const specificItems = spec.field<Order>("items").in(["laptop", "phone"]);
```

### Complex Compositions

```ts
// Premium order: high value AND fast shipping
const premiumOrder = all<Order>(
  spec.field<Order>("total").gte(500),
  spec.field<Order>("status").eq("expedited"),
);

// Urgent order: high priority OR expiring soon
const urgentOrder = any<Order>(
  spec.field<Order>("priority").eq("high"),
  spec.field<Order>("expiresAt").lte(new Date()),
);

// Nested logic
const eligibleForRefund = spec
  .field<Order>("status").eq("delivered")
  .and(spec.field<Order>("total").gte(50))
  .and(
    any<Order>(
      spec.field<Order>("hasDefect").eq(true),
      spec.field<Order>("customerRequest").eq("refund"),
    )
  );
```

### Using Registries

```ts
import { createRegistry, builtInOperators, createOperator } from "@fajarnugraha37/specification";

const registry = createRegistry({ operators: builtInOperators });

// Add custom operator
const customOp = createOperator({
  kind: "divisibleBy",
  create: (input: { path: string; divisor: number }) => {
    return spec.field<any>(input.path).custom((value) => value % input.divisor === 0);
  },
});

registry.addOperator(customOp);

// Use in AST
const ast = {
  type: "op",
  kind: "divisibleBy",
  input: { path: "quantity", divisor: 5 },
};
const rule = fromAst(ast, registry);
```

### Memoization

```ts
import { BaseSpec } from "@fajarnugraha37/specification";

class ExpensiveSpec extends BaseSpec<User> {
  constructor() {
    super(undefined, {
      memoize: true, // Enable caching
      hasher: (user) => user.id, // Custom hash function
    });
  }

  protected evaluate(user: User): boolean {
    // Expensive computation
    return performComplexCheck(user);
  }
}

const spec = new ExpensiveSpec();
spec.isSatisfiedBy(user1); // Computed
spec.isSatisfiedBy(user1); // Cached!
```

## Advanced features

### 1. Plugin System

Extend the library with custom operators:

```ts
import { createPlugin } from "@fajarnugraha37/specification";

// Built-in plugins
import { geoPlugin, stringPlugin } from "@fajarnugraha37/specification";

const registry = createRegistry({ operators: builtInOperators });
geoPlugin.register(registry);
stringPlugin.register(registry);

// Custom plugin
const myPlugin = createPlugin({
  name: "my-plugin",
  version: "1.0.0",
  register: (registry) => {
    registry.addOperator(myCustomOperator);
  },
});
```

### 2. Database Adapters

Compile specifications to database queries:

```ts
import { prismaAdapter, mongoAdapter } from "@fajarnugraha37/specification";

// Prisma
const prismaWhere = prismaAdapter.compile(eligibleUser);
await prisma.user.findMany({ where: prismaWhere });
// Result: { age: { gte: 18 }, isActive: { equals: true } }

// MongoDB
const mongoQuery = mongoAdapter.compile(eligibleUser);
await collection.find(mongoQuery);
// Result: { $and: [{ age: { $gte: 18 } }, { isActive: { $eq: true } }] }
```

### 3. Explanation & Debugging

Get detailed evaluation results with rich failure context:

```ts
import { all, spec, enhanceExplainTree, formatExplainTree } from "@fajarnugraha37/specification";

const rule = all<User>(
  spec.field<User>("age").gte(18),
  spec.field<User>("email").contains("@"),
);

// Sync explain
const explanation = rule.explain({ age: 16, email: "user@test.com" });
console.log(explanation);
// {
//   id: "spec_123",
//   pass: false,
//   operator: "and",
//   children: [
//     {
//       id: "spec_124",
//       pass: false,
//       path: "age",
//       operator: "gte",
//       actualValue: 16,
//       expectedValue: 18,
//       reason: "{age} must be greater than or equal to 18"
//     },
//     {
//       id: "spec_125",
//       pass: true,
//       path: "email",
//       operator: "contains",
//       actualValue: "user@test.com",
//       expectedValue: "@"
//     }
//   ]
// }

// Async explain for precise timing
const asyncExplanation = await rule.explainAsync!({ age: 16, email: "user@test.com" });
console.log(`Took ${asyncExplanation.durationMs}ms`);

// Enhanced explanation with generated failure reasons
const enhanced = enhanceExplainTree(explanation);
console.log(enhanced.children![0]!.reason);
// "Field 'age': Expected >= 18, but got 16"

// Pretty-printed tree view
const formatted = formatExplainTree(enhanced);
console.log(formatted);
// ✗ spec_123
//   → Value: Not all conditions met
//   ✗ spec_124 (0.05ms)
//     → {age} must be greater than or equal to 18
//   ✓ spec_125 (0.03ms)
```

**Explain Features:**
- **actualValue/expectedValue**: See what was compared
- **operator**: Operation type (eq, gte, contains, and, or, not)
- **path**: Field path in objects
- **reason**: Human-readable failure message
- **durationMs**: Execution timing
- **children**: Nested specs in combinators

### 4. Hooks & Lifecycle

Monitor specification evaluation:

```ts
import { BaseSpec } from "@fajarnugraha37/specification";

class MonitoredSpec extends BaseSpec<User> {
  constructor() {
    super(undefined, {
      hooks: {
        onEvaluateStart: (node, value, ctx) => {
          console.log(`Starting evaluation of ${node.name}`);
        },
        onEvaluateEnd: (node, value, ctx, result) => {
          console.log(`Result: ${result}`);
        },
      },
    });
  }

  protected evaluate(user: User): boolean {
    return user.age >= 18;
  }
}
```

### 5. Metadata & Tagging

Add metadata to specifications:

```ts
import { withMeta } from "@fajarnugraha37/specification";

const spec = spec.field<User>("age").gte(18);
const tagged = withMeta(spec, {
  id: "age-check",
  name: "Adult Verification",
  tags: ["security", "age-gate"],
  version: "1.0.0",
  owner: "compliance-team",
});

console.log(tagged.name); // "Adult Verification"
console.log(tagged.meta.tags); // ["security", "age-gate"]
```

## Cookbook

### Recipe 1: Dynamic Filter Builder

Build filters from user input:

```ts
interface FilterInput {
  field: string;
  operator: "eq" | "gt" | "lt" | "contains";
  value: any;
}

function buildFilter<T>(filters: FilterInput[]): Specification<T> {
  const specs = filters.map((f) => {
    switch (f.operator) {
      case "eq":
        return spec.field<T>(f.field as any).eq(f.value);
      case "gt":
        return spec.field<T>(f.field as any).gt(f.value);
      case "lt":
        return spec.field<T>(f.field as any).lt(f.value);
      case "contains":
        return spec.field<T>(f.field as any).contains(f.value);
    }
  });

  return specs.length === 1 ? specs[0] : all(...specs);
}

// Usage
const userFilters: FilterInput[] = [
  { field: "age", operator: "gt", value: 18 },
  { field: "city", operator: "eq", value: "NYC" },
];

const filter = buildFilter<User>(userFilters);
```

### Recipe 2: Rule Engine

Store and execute rules from a database:

```ts
interface Rule {
  id: string;
  name: string;
  ast: any;
  active: boolean;
}

class RuleEngine<T> {
  constructor(
    private rules: Rule[],
    private registry: Registry,
  ) {}

  async evaluate(candidate: T): Promise<Rule[]> {
    const results: Rule[] = [];

    for (const rule of this.rules) {
      if (!rule.active) continue;

      const spec = fromAst<T>(rule.ast, this.registry);
      const satisfied = await spec.isSatisfiedByAsync(candidate);

      if (satisfied) {
        results.push(rule);
      }
    }

    return results;
  }
}

// Usage
const engine = new RuleEngine(rulesFromDB, registry);
const matchingRules = await engine.evaluate(user);
```

### Recipe 3: Permission System

```ts
interface Permission {
  resource: string;
  action: string;
  conditions?: Specification<User>;
}

class PermissionChecker {
  constructor(private permissions: Permission[]) {}

  canAccess(user: User, resource: string, action: string): boolean {
    const permission = this.permissions.find(
      (p) => p.resource === resource && p.action === action
    );

    if (!permission) return false;
    if (!permission.conditions) return true;

    return permission.conditions.isSatisfiedBy(user);
  }
}

// Define permissions
const permissions: Permission[] = [
  {
    resource: "users",
    action: "delete",
    conditions: all<User>(
      spec.field<User>("role").eq("admin"),
      spec.field<User>("department").eq("security"),
    ),
  },
  {
    resource: "posts",
    action: "create",
    conditions: spec.field<User>("isActive").eq(true),
  },
];

const checker = new PermissionChecker(permissions);
const canDelete = checker.canAccess(currentUser, "users", "delete");
```

### Recipe 4: A/B Testing

```ts
interface Experiment {
  id: string;
  targetSpec: Specification<User>;
  variant: "A" | "B";
}

function getExperimentVariant(user: User, experiments: Experiment[]): string {
  for (const exp of experiments) {
    if (exp.targetSpec.isSatisfiedBy(user)) {
      return exp.variant;
    }
  }
  return "default";
}

// Define experiments
const experiments: Experiment[] = [
  {
    id: "new-checkout",
    targetSpec: any<User>(
      spec.field<User>("country").in(["US", "CA"]),
      spec.field<User>("isPremium").eq(true),
    ),
    variant: "B",
  },
];

const variant = getExperimentVariant(user, experiments);
```

## Test Coverage & Quality

### Test Suite Status

The package has **comprehensive test coverage** with **284 tests** across all modules:

| Module | Tests | Function Coverage | Line Coverage | Status |
|--------|-------|-------------------|---------------|--------|
| **Overall** | 284 | **90.97%** | **94.53%** | ✅ Excellent |
| Core (base-spec) | 18 | 94.87% | 97.44% | ✅ |
| Combinators | 4 | 82.61% | 86.96% | ✅ |
| Registry | 13 | 100% | 100% | ✅ |
| Memoization | 10 | 100% | 100% | ✅ |
| DSL Builder | 20 | 94.12% | 96.15% | ✅ |
| Operators | 18 | 90.54% | 93.24% | ✅ |
| AST Serialization | 15 | 96.88% | 98.44% | ✅ |
| Adapters (Prisma/Mongo) | 54 | 96-97% | 96-97% | ✅ |
| Humanizer | 38 | 96.77% | 98.77% | ✅ |
| Explain Trees | 46 | 100% | 94.38% | ✅ |
| Plugins | 3 | 100% | 95.83% | ✅ |
| Property-Based Tests | 20 | - | - | ✅ |
| Short-Circuit Tests | 25 | - | - | ✅ |

### Test Categories

1. **Unit Tests** (173 tests): Core functionality and edge cases
2. **Integration Tests** (54 tests): Adapter compilation end-to-end
3. **Property-Based Tests** (20 tests × 100 runs = 2000 test cases): Laws and invariants using `fast-check`
4. **Performance Tests** (25 tests): Short-circuit behavior and optimization
5. **Snapshot Tests** (12 tests): Humanizer templates and explain trees

### Running Tests

```bash
# Run all tests
bun test

# Run with coverage
bun test --coverage

# Watch mode
bun test --watch

# Filter by name
bun test adapter
```

### Coverage Goals

✅ **90%+ function coverage** (achieved: 90.97%)  
✅ **90%+ line coverage** (achieved: 94.53%)  
✅ **All critical paths tested**  
✅ **Property-based tests for core laws**

## Performance & Bundle Size

### Bundle Size Analysis

The package is highly **tree-shakeable** and optimized for minimal bundle size:

| Module | Gzipped Size | Target | Status |
|--------|--------------|--------|--------|
| **Core Runtime** | **7.15 KB** | < 15 KB | ✅ **47.7% of target** |
| DSL Builder | 3.56 KB | - | ✅ |
| Humanizer | 1.17 KB | - | ✅ |
| All Operators | 2.74 KB | - | ✅ |
| Prisma Adapter | 2.87 KB | - | ✅ |
| MongoDB Adapter | 2.75 KB | - | ✅ |
| **Total (all modules)** | ~31 KB | - | ✅ |

**Tree-Shaking**: Import only what you need. Core runtime + 1 operator = ~8 KB gzipped.

```typescript
// Minimal import (core + eq operator only)
import { spec } from "@fajarnugraha37/specification";
const check = spec.field("status").eq("active");
// Bundle: ~8 KB gzipped

// Full import (all operators)
import { spec, all, any, builtInOperators } from "@fajarnugraha37/specification";
// Bundle: ~31 KB gzipped (all features)
```

### Performance Benchmarks

Performance tested with 10,000 iterations per benchmark:

| Operation | Ops/Second | Latency (P50) | Latency (P99) |
|-----------|-----------|---------------|---------------|
| Simple field check (eq) | 2.0M | 0.5 µs | 1.2 µs |
| Numeric comparison (gte) | 1.8M | 0.55 µs | 1.3 µs |
| String operations (startsWith) | 1.5M | 0.67 µs | 1.5 µs |
| AND combinator (2 specs) | 1.0M | 1.0 µs | 2.5 µs |
| OR combinator (2 specs) | 950K | 1.05 µs | 2.6 µs |
| Nested combinators (3 levels) | 300K | 3.3 µs | 8.0 µs |
| With explain tree | 1.5M | 0.67 µs | 1.8 µs |
| Memoized (cache hit) | 10M+ | 0.1 µs | 0.2 µs |

**Key Findings:**
- **Sub-microsecond latency** for simple specs
- **Short-circuit optimization**: 2x speedup with proper spec ordering
- **Nesting penalty**: ~20-30% overhead per nesting level (keep < 3 levels)
- **Explain overhead**: Only ~15% slower than direct evaluation
- **Memoization**: 10-100x speedup for repeated values

### Running Benchmarks

```bash
# Analyze bundle sizes
bun run size

# Run performance benchmarks
bun run bench

# Test tree-shaking effectiveness
bun run tree-shake
```

### Performance Best Practices

1. **Order Matters**: Place fast/likely-to-fail specs first in `all()`
   ```typescript
   // Good: cheap check first
   all(isActive, expensiveDbCheck)
   
   // Bad: expensive first
   all(expensiveDbCheck, isActive)
   ```

2. **Enable Memoization**: For expensive predicates with repeated values
   ```typescript
   const spec = new MySpec("id", { 
     memoize: true,
     hasher: (value) => value.id
   });
   ```

3. **Limit Nesting**: Keep combinator depth < 3 levels
   ```typescript
   // Good: flat structure
   all(spec1, spec2, spec3)
   
   // Avoid: deep nesting
   all(any(spec1, all(spec2, any(spec3))))
   ```

4. **Use Sync When Possible**: Async evaluation is 2-3x slower
   ```typescript
   // Prefer sync predicates
   ({ actual }) => actual >= 18
   
   // Use async only when necessary
   async ({ actual }) => await db.exists(actual)
   ```

See [docs/performance.md](./docs/performance.md) for detailed optimization guide.

## Architecture & Design

### Code Flow

```
User Code → DSL Builder → Operator Factory → Specification → Evaluation
                                   ↓
                            Registry (plugins)
                                   ↓
                         AST Serialization
                                   ↓
                         Database Adapters
```

### File Structure

```
src/
├── core/         # BaseSpec, CompositeSpec, Registry, types
├── dsl/          # Fluent API builders (spec.field())
├── ops/          # 14 built-in operators
├── ast/          # toAst/fromAst serialization
├── adapters/     # Prisma/MongoDB query compilers
├── plugins/      # Geo/time/string plugins
└── utils/        # Errors, hashing, timing, explain
```

See [docs/architecture.md](./docs/architecture.md) for comprehensive design documentation including:
- Design patterns (Specification, Composite, Builder, Factory, Registry)
- Extension points (custom operators, plugins, adapters, contexts)
- Internal code flow with step-by-step examples
- Performance optimization strategies
- Testing approaches
- Migration guides

## API reference

### Core Functions

#### `spec.field<T>(path)`
Create a field specification builder.

```ts
spec.field<User>("age").gte(18)
```

#### `all<T>(...specs)`
Create an AND combinator - all specs must pass.

```ts
all<User>(spec1, spec2, spec3)
```

#### `any<T>(...specs)`
Create an OR combinator - at least one spec must pass.

```ts
any<User>(spec1, spec2)
```

#### `none<T>(...specs)`
Create a NOR combinator - all specs must fail.

```ts
none<User>(spec1, spec2)
```

### Field Operators

- `eq(value)` - Equals
- `ne(value)` - Not equals
- `lt(value)` - Less than
- `lte(value)` - Less than or equal
- `gt(value)` - Greater than
- `gte(value)` - Greater than or equal
- `in(values)` - In array
- `notIn(values)` - Not in array
- `exists()` - Field exists (not null/undefined)
- `missing()` - Field is null/undefined
- `regex(pattern, flags?)` - Regex match
- `startsWith(prefix)` - String starts with
- `endsWith(suffix)` - String ends with
- `contains(substring)` - Array/string contains

### Specification Methods

- `isSatisfiedBy(candidate)` - Evaluate synchronously (returns boolean)
- `isSatisfiedByAsync(candidate)` - Evaluate asynchronously (returns Promise<boolean>)
- `and(other)` - Logical AND combinator
- `or(other)` - Logical OR combinator
- `not()` - Logical NOT combinator
- `explain(candidate)` - Get detailed evaluation tree (sync)
- `explainAsync(candidate)` - Get detailed evaluation tree with accurate timing (async)

### Explain Utilities

#### `enhanceExplainTree(node: ExplainNode): ExplainNode`
Enhances explain tree with auto-generated failure reasons.

#### `formatExplainTree(node: ExplainNode, indent?: number): string`
Formats explain tree as readable text report with status icons (✓/✗).

#### `generateFailureReason(node: ExplainNode): string | undefined`
Generates human-readable failure reason for a single node.

**ExplainNode Structure:**
- `pass`: true/false/"unknown" - evaluation status
- `operator`: Operation type (eq, gte, contains, and, or, not)
- `actualValue`: The value that was tested
- `expectedValue`: The value it was compared against
- `path`: Field path for nested objects
- `reason`: Human-readable failure message
- `durationMs`: Execution time in milliseconds
- `children`: Nested specifications (for combinators)

### AST Functions

#### `toAst(spec)`
Convert specification to JSON AST.

```ts
const ast = toAst(spec);
```

#### `fromAst<T>(ast, registry)`
Deserialize AST to specification.

```ts
const spec = fromAst<User>(ast, registry);
```

### Registry Functions

#### `createRegistry(options?)`
Create a new operator registry.

```ts
const registry = createRegistry({ 
  operators: builtInOperators 
});
```

#### `registry.addOperator(operator)`
Register a custom operator.

#### `registry.addSpec(factory, meta?)`
Register a reusable specification.

#### `registry.getOperator(kind)`
Retrieve an operator by kind.

### Adapters

#### `prismaAdapter.compile(spec)`
Compile to Prisma where clause.

```ts
const where = prismaAdapter.compile(spec);
await prisma.user.findMany({ where });
```

#### `mongoAdapter.compile(spec)`
Compile to MongoDB query.

```ts
const query = mongoAdapter.compile(spec);
await collection.find(query);
```

## FAQ & troubleshooting

### Q: How do I create custom operators?

Use `createOperator`:

```ts
import { createOperator } from "@fajarnugraha37/specification";

const myOperator = createOperator({
  kind: "between",
  create: (input: { path: string; min: number; max: number }) => {
    return all(
      spec.field<any>(input.path).gte(input.min),
      spec.field<any>(input.path).lte(input.max),
    );
  },
});

registry.addOperator(myOperator);
```

### Q: Can I nest field paths?

Yes, use dot notation:

```ts
spec.field<any>("user.profile.age").gte(18)
```

### Q: How do I handle async evaluation?

Always use `isSatisfiedByAsync` when dealing with async specs:

```ts
const result = await spec.isSatisfiedByAsync(candidate);
```

### Q: Can I serialize custom operators?

Yes, as long as they're registered in your registry:

```ts
const ast = toAst(customSpec);
const rebuilt = fromAst(ast, registryWithCustomOps);
```

### Q: How do I debug failing specifications?

Use the enhanced `explain` methods with rich failure context:

```ts
import { spec, enhanceExplainTree, formatExplainTree } from "@fajarnugraha37/specification";

// Basic explain shows structure
const explanation = spec.explain(candidate);
console.log(JSON.stringify(explanation, null, 2));

// Enhanced explain adds failure reasons
const enhanced = enhanceExplainTree(explanation);
console.log(enhanced.children![0]!.reason);
// "Field 'age': Expected >= 18, but got 16"

// Pretty-print for readable debugging
const formatted = formatExplainTree(enhanced);
console.log(formatted);
// ✗ age-check (0.12ms)
//   → Value: Not all conditions met
//   ✗ age-spec (0.05ms)
//     → Field 'age': Expected >= 18, but got 16

// Use explainAsync for accurate timing
const asyncExplanation = await spec.explainAsync!(candidate);
console.log(`Took ${asyncExplanation.durationMs}ms`);
```

**Explain output includes:**
- `pass`: true/false/"unknown"
- `operator`: Which operation was performed (eq, gte, contains, etc.)
- `actualValue`: The value that was tested
- `expectedValue`: The value it was compared against
- `path`: Field path for nested objects
- `reason`: Human-readable failure message
- `durationMs`: Execution time in milliseconds
- `children`: Nested specifications for combinators

### Q: What's the performance impact of memoization?

Memoization trades memory for speed. Use it for expensive computations:

```ts
new MySpec({ memoize: true, hasher: (v) => v.id })
```

### Q: Can I use this with other ORMs?

Yes! Create a custom adapter:

```ts
const myAdapter = {
  compile: (spec: Specification<T>) => {
    // Convert to your ORM's query format
    return myOrmQuery;
  },
};
```

### Q: How do I version my specifications?

Use metadata:

```ts
withMeta(spec, { version: "2.0.0", name: "Updated Rule" })
```

### Q: Are there TypeScript type guards?

Yes, the library is fully typed. Use generics:

```ts
const spec: Specification<User> = spec.field<User>("age").gte(18);
```

### Common Errors

**Error: "Asynchronous evaluation required"**
- Solution: Use `isSatisfiedByAsync` instead of `isSatisfiedBy`

**Error: "Operator kind not found"**
- Solution: Ensure the operator is registered in your registry

**Error: "Cannot convert specification to AST"**
- Solution: Spec must use registered operators or be a composite spec

### Development Scripts

```bash
# Build
bun run build

# Test
bun test

# Test with coverage
bun test --coverage

# Watch mode
bun test --watch

# Lint
bun run lint
```

## License

MIT
