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

Get detailed evaluation results:

```ts
const rule = all<User>(
  spec.field<User>("age").gte(18),
  spec.field<User>("role").eq("admin"),
);

const explanation = rule.explain({ age: 16, role: "admin" });
console.log(explanation);
// {
//   id: "spec_123",
//   pass: false,
//   children: [
//     { id: "spec_124", pass: false, path: "age" },
//     { id: "spec_125", pass: true, path: "role" }
//   ]
// }
```

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

- `isSatisfiedBy(candidate)` - Evaluate synchronously
- `isSatisfiedByAsync(candidate)` - Evaluate asynchronously
- `and(other)` - Logical AND
- `or(other)` - Logical OR
- `not()` - Logical NOT
- `explain(candidate)` - Get detailed evaluation result

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

Use the `explain` method:

```ts
const explanation = spec.explain(candidate);
console.log(JSON.stringify(explanation, null, 2));
```

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
