# Performance Best Practices

This guide covers performance optimization strategies for `@fajarnugraha37/specification`, including when to use memoization, hasher optimization, nesting considerations, and bundle size optimization.

## Table of Contents

1. [Evaluation Performance](#evaluation-performance)
2. [Bundle Size Optimization](#bundle-size-optimization)
3. [Tree-Shaking](#tree-shaking)
4. [Memoization](#memoization)
5. [Optimization Checklist](#optimization-checklist)

---

## Evaluation Performance

### Benchmark Results

Based on our performance benchmarks (`bun run bench`):

```
Simple field specs:     1-2M ops/sec    (~0.5-1µs per operation)
AND/OR combinators:     300K-1M ops/sec (~1-3µs per operation)
Nested combinators:     200K-600K ops/sec (~2-5µs per operation)
String operations:      1.5-2M ops/sec  (~0.5-0.7µs per operation)
Explain overhead:       +10-30%         (minimal impact)
```

### General Recommendations

#### 1. **Ordering Matters: Short-Circuit Optimization**

```typescript
// ✅ GOOD: Most likely to fail first (in AND)
const spec = all(
  field("isPremium").eq(true),          // Fails 90% of the time
  field("age").gte(18),                 // Fails 5% of the time
  field("email").regex(/^[a-z]+@/)      // Rarely fails
);

// ❌ BAD: Expensive checks first
const spec = all(
  field("email").regex(/^[a-z]+@/),     // Complex regex
  field("isPremium").eq(true)           // Simple check should be first
);
```

**For OR combinators, reverse the logic:**
```typescript
// ✅ GOOD: Most likely to pass first (in OR)
const spec = any(
  field("role").eq("admin"),            // Passes 80% of the time
  field("permissions").contains("*"),   // Passes 15% of the time
  field("isOwner").eq(true)             // Rarely passes
);
```

**Impact**: Short-circuit can provide 2-10x speedup depending on data distribution.

#### 2. **Limit Nesting Depth**

Each nesting level adds ~20-30% overhead:

```typescript
// ✅ GOOD: Flat structure (fastest)
const spec = all(
  field("age").gte(18),
  field("verified").eq(true),
  field("role").in(["admin", "mod"])
);

// ⚠️  ACCEPTABLE: 2-3 levels (still fast)
const spec = all(
  field("age").gte(18),
  any(
    field("role").eq("admin"),
    field("permissions").contains("moderate")
  )
);

// ❌ AVOID: 4+ levels (significant overhead)
const spec = all(
  field("age").gte(18),
  any(
    field("role").eq("admin"),
    all(
      field("verified").eq(true),
      any(
        field("email").contains("@company"),
        field("email").contains("@partner")
      )
    )
  )
);
```

**Recommendation**: Keep nesting depth < 3 levels for optimal performance.

#### 3. **Batch Similar Checks**

```typescript
// ✅ GOOD: Group related checks
const spec = all(
  // Age checks together
  field("age").gte(18),
  field("age").lt(65),
  
  // Role checks together
  any(
    field("role").eq("admin"),
    field("role").eq("moderator")
  )
);

// ❌ BAD: Interleaved checks
const spec = all(
  field("age").gte(18),
  field("role").eq("admin"),
  field("age").lt(65),
  field("role").eq("moderator")
);
```

#### 4. **Use Sync Evaluation When Possible**

```typescript
// ✅ GOOD: Sync specs (10x faster)
const spec = field("age").gte(18);
const result = spec.isSatisfiedBy(user);

// ❌ SLOWER: Async evaluation adds ~100-200µs overhead
const result = await spec.isSatisfiedByAsync?.(user);
```

**Only use async when:**
- Specs involve I/O operations
- Using custom async operators
- Need to ensure async-safe evaluation

#### 5. **Minimize explain() in Hot Paths**

```typescript
// ✅ GOOD: Only explain on failure
if (!spec.isSatisfiedBy(user)) {
  const explanation = spec.explain(user);
  logger.warn("Validation failed", explanation);
}

// ❌ BAD: Always calling explain (adds 10-30% overhead)
const explanation = spec.explain(user);
if (!explanation.pass) {
  logger.warn("Validation failed", explanation);
}
```

---

## Bundle Size Optimization

### Current Bundle Sizes

Run `bun run size` to see current sizes:

```
Core (full import):     7.15 KB gzipped  (target: 15 KB)
DSL Builder:            3.57 KB gzipped
Humanizer:              1.17 KB gzipped
Prisma Adapter:         2.87 KB gzipped
MongoDB Adapter:        2.75 KB gzipped
```

### Import Strategy

#### ✅ **Import Only What You Need**

```typescript
// BEST: Specific imports (tree-shakeable)
import { spec } from "@fajarnugraha37/specification";
import { prismaAdapter } from "@fajarnugraha37/specification/adapters/prisma";

// OKAY: Named imports from index
import { spec, all, any } from "@fajarnugraha37/specification";

// ❌ AVOID: Barrel imports pull everything
import * as Spec from "@fajarnugraha37/specification";
```

#### **Adapter Strategy**

```typescript
// ✅ GOOD: Import adapters separately
import { spec } from "@fajarnugraha37/specification";
import { prismaAdapter } from "@fajarnugraha37/specification/adapters/prisma";

// ❌ BAD: Importing from index pulls both adapters
import { spec, prismaAdapter, mongoAdapter } from "@fajarnugraha37/specification";
```

#### **Plugin Strategy**

```typescript
// ✅ GOOD: Load plugins on-demand
const loadGeoPlugin = async () => {
  const { geoPlugin } = await import("@fajarnugraha37/specification/plugins/geo");
  registry.addOperator(geoPlugin);
};

// ❌ BAD: Always loading all plugins
import { geoPlugin, timePlugin, stringPlugin } from "@fajarnugraha37/specification";
```

---

## Tree-Shaking

### What Can Be Tree-Shaken?

✅ **Fully tree-shakeable:**
- Individual operators (when imported from `ops/builtins`)
- Adapters (Prisma, MongoDB)
- Plugins (geo, time, string)
- Utility functions

⚠️ **Partially tree-shakeable:**
- Core combinators (all, any, none) - lightweight
- DSL builder - if you use `spec.field()`, you get the whole DSL

❌ **Not tree-shakeable:**
- Base classes (needed by all specs)
- Type definitions (zero runtime cost)

### Optimization Examples

#### Minimal Core Bundle

```typescript
// Smallest possible bundle: ~3-4 KB gzipped
import { BaseSpec } from "@fajarnugraha37/specification/core/base-spec";
import { createOperator } from "@fajarnugraha37/specification/ops/factory";
import { eq } from "@fajarnugraha37/specification/ops/builtins";

const ageSpec = new BaseSpec((user) => user.age === 18);
```

#### Standard Bundle

```typescript
// Typical usage: ~7 KB gzipped
import { spec, all, any } from "@fajarnugraha37/specification";

const userSpec = all(
  spec.field("age").gte(18),
  spec.field("verified").eq(true)
);
```

#### Full-Featured Bundle

```typescript
// Everything included: ~23 KB gzipped
import {
  spec,
  all,
  any,
  toAst,
  fromAst,
  prismaAdapter,
  mongoAdapter,
  defaultHumanizer,
} from "@fajarnugraha37/specification";
```

---

## Memoization

### When to Use Memoization

Memoization caches evaluation results for identical input values, providing 10-100x speedup for repeated evaluations.

#### ✅ **Good Use Cases**

1. **Hot paths with repeated values:**
```typescript
// Checking the same user multiple times
const premiumSpec = spec.field("tier", { memoize: true }).eq("premium");

for (const action of actions) {
  if (premiumSpec.isSatisfiedBy(currentUser)) {
    // Cached after first check
    performPremiumAction(action);
  }
}
```

2. **Batch processing with duplicates:**
```typescript
const ageSpec = spec.field("age", { memoize: true }).gte(18);

// Many users with the same age
users.forEach(user => {
  if (ageSpec.isSatisfiedBy(user)) {
    processAdult(user);
  }
});
```

3. **Real-time validation:**
```typescript
// Form validation as user types
const emailSpec = spec.field("email", { memoize: true }).regex(/^[a-z]+@/);

input.addEventListener("input", () => {
  // Cached if user types same value again
  const isValid = emailSpec.isSatisfiedBy({ email: input.value });
  updateUI(isValid);
});
```

#### ❌ **Poor Use Cases**

1. **Unique values every time:**
```typescript
// ❌ No benefit - timestamp always unique
const recentSpec = spec.field("createdAt", { memoize: true }).gte(Date.now());
```

2. **Memory-constrained environments:**
```typescript
// ❌ Memoization adds memory overhead
const spec = spec.field("data", { memoize: true }).eq(largeObject);
```

3. **Single-use checks:**
```typescript
// ❌ No benefit - only evaluated once
const oneTimeCheck = spec.field("id", { memoize: true }).eq(123);
if (oneTimeCheck.isSatisfiedBy(user)) { /* ... */ }
```

### Custom Hash Functions

For complex objects, provide a custom hasher:

```typescript
import { createSpecDSL } from "@fajarnugraha37/specification";

const spec = createSpecDSL({
  hasher: (user) => `${user.id}:${user.role}`, // Only hash relevant fields
});

const premiumSpec = spec.field("tier", { memoize: true }).eq("premium");
```

### Hasher Optimization

```typescript
// ✅ GOOD: Hash only relevant fields
const hasher = (user: User) => `${user.id}:${user.age}`;

// ❌ BAD: Hashing entire object (slow for large objects)
const hasher = (user: User) => JSON.stringify(user);

// ✅ BETTER: Use identity for objects with unique IDs
const hasher = (user: User) => user.id.toString();
```

---

## Optimization Checklist

### Development Phase

- [ ] Profile your actual usage patterns before optimizing
- [ ] Measure performance with `bun run bench` for your specific use cases
- [ ] Use explain() during development, remove in production hot paths
- [ ] Add bundle size checks to CI (`bun run size`)

### Specification Design

- [ ] Order AND conditions by failure probability (most likely first)
- [ ] Order OR conditions by success probability (most likely first)
- [ ] Keep nesting depth < 3 levels
- [ ] Batch similar checks together
- [ ] Avoid regex when simple string operations suffice

### Code Implementation

- [ ] Import only what you need (avoid barrel imports)
- [ ] Load adapters/plugins on-demand
- [ ] Use sync evaluation unless async is required
- [ ] Enable memoization for hot paths with repeated values
- [ ] Provide custom hashers for complex objects
- [ ] Cache compiled adapters (Prisma/MongoDB queries)

### Production Deployment

- [ ] Minimize explain() calls in hot paths
- [ ] Monitor bundle sizes with `size-limit`
- [ ] Use compression (gzip/brotli) on served bundles
- [ ] Consider code splitting for large applications
- [ ] Profile real-world performance with production data

---

## Advanced Techniques

### Precompiled Specifications

For ultra-high performance, precompile specifications:

```typescript
// Compile once
const spec = all(
  field("age").gte(18),
  field("role").in(["admin", "mod"])
);

// Use isSatisfiedBy directly (avoids explain overhead)
users.filter(user => spec.isSatisfiedBy(user));
```

### Lazy Evaluation

```typescript
// Only evaluate when needed
const expensiveSpec = field("data").regex(/complex-pattern/);

const lazyCheck = (user: User) => {
  if (!user.needsValidation) return true;
  return expensiveSpec.isSatisfiedBy(user);
};
```

### Batch Compilation

For adapters, compile multiple specs together:

```typescript
// Compile all specs at once
const specs = [spec1, spec2, spec3];
const queries = specs.map(s => prismaAdapter.compile(toAst(s)));

// Execute batch query
const results = await prisma.$transaction(
  queries.map(q => prisma.user.findMany(q))
);
```

---

## Summary

**Key Takeaways:**

1. **Bundle size**: Core is only 7.15 KB gzipped (well under 15 KB target)
2. **Performance**: 500K-2M ops/sec for typical use cases
3. **Short-circuit**: Order matters - put likely failures/successes first
4. **Nesting**: Keep depth < 3 levels for optimal performance
5. **Memoization**: Use for hot paths with repeated values
6. **Tree-shaking**: Import specifically to minimize bundle size
7. **Explain**: Use judiciously - adds 10-30% overhead

**Run our tools:**
- `bun run size` - Check bundle sizes
- `bun run bench` - Run performance benchmarks

For questions or performance issues, please open an issue on GitHub!
