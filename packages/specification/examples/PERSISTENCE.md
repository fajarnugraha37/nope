# Database Persistence API Reference

Quick reference for storing and loading specifications from databases.

## Core Functions

### `toAst(spec, options?)`

Converts a specification to its Abstract Syntax Tree (AST) representation.

```typescript
import { spec, toAst } from '@fajarnugraha37/specification';

const mySpec = spec.field("age").gte(18);
const ast = toAst(mySpec);

// Result:
// {
//   type: "op",
//   kind: "gte",
//   input: { path: "age", value: 18 }
// }
```

**Returns**: `AstNode` - JSON-serializable object

### `fromAst<T, Ctx>(ast, registry)`

Reconstructs a specification from its AST representation.

```typescript
import { fromAst, createRegistry, builtInOperators } from '@fajarnugraha37/specification';

const ast = {
  type: "op",
  kind: "gte",
  input: { path: "age", value: 18 }
};

const registry = createRegistry({ operators: builtInOperators });
const spec = fromAst<User, {}>(ast, registry);

// Use the reconstructed spec
const allowed = await spec.isSatisfiedByAsync({ age: 25 }); // true
```

**Parameters**:
- `ast` - The AST node to deserialize
- `registry` - Registry containing operators and registered specs

**Returns**: `Specification<T, Ctx>`

## Storage Patterns

### Pattern 1: Simple JSON String

Store AST as JSON string in any database.

```typescript
// Serialize
const astJson = JSON.stringify(toAst(spec));
await db.query('INSERT INTO policies (id, ast) VALUES (?, ?)', [id, astJson]);

// Deserialize
const row = await db.query('SELECT ast FROM policies WHERE id = ?', [id]);
const ast = JSON.parse(row.ast);
const spec = fromAst(ast, registry);
```

### Pattern 2: PostgreSQL JSONB

Use PostgreSQL's JSONB for efficient querying.

```sql
CREATE TABLE policies (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255),
    ast JSONB NOT NULL
);

-- Query by operator type
SELECT * FROM policies WHERE ast->>'kind' = 'gte';

-- Query by field path
SELECT * FROM policies WHERE ast->'input'->>'path' = 'age';
```

```typescript
import { Pool } from 'pg';

const pool = new Pool();

// Save
await pool.query(
    'INSERT INTO policies (id, name, ast) VALUES ($1, $2, $3)',
    [id, name, toAst(spec)]
);

// Load
const result = await pool.query(
    'SELECT ast FROM policies WHERE id = $1',
    [id]
);
const spec = fromAst(result.rows[0].ast, registry);
```

### Pattern 3: MongoDB Document

Store AST as nested object in MongoDB.

```typescript
import { MongoClient } from 'mongodb';

const client = new MongoClient(url);
const db = client.db('myapp');
const policies = db.collection('policies');

// Save
await policies.insertOne({
    id: 'policy-1',
    name: 'Adult Policy',
    ast: toAst(spec),  // Store as object, not string
    createdAt: new Date()
});

// Load
const doc = await policies.findOne({ id: 'policy-1' });
const spec = fromAst(doc.ast, registry);

// Query by operator
await policies.find({ 'ast.kind': 'gte' });
```

### Pattern 4: Redis Cache

Cache compiled specifications in Redis.

```typescript
import { createClient } from 'redis';

const redis = createClient();

// Cache
const astJson = JSON.stringify(toAst(spec));
await redis.setEx(`policy:${id}`, 3600, astJson);

// Load from cache
const cached = await redis.get(`policy:${id}`);
if (cached) {
    const ast = JSON.parse(cached);
    const spec = fromAst(ast, registry);
}
```

## AST Structure Reference

### Operator Node (Field Specs)

```typescript
{
  type: "op",
  kind: "gte" | "eq" | "in" | "contains" | ...,
  input: {
    path: string,
    value?: any,
    values?: any[],
    pattern?: string,
    flags?: string
  }
}
```

### AND Combinator

```typescript
{
  type: "and",
  nodes: [AstNode, AstNode, ...]
}
```

### OR Combinator

```typescript
{
  type: "or",
  nodes: [AstNode, AstNode, ...]
}
```

### NOT Combinator

```typescript
{
  type: "not",
  node: AstNode
}
```

### Reference Node (Registered Specs)

```typescript
{
  type: "ref",
  id: string  // ID of registered spec
}
```

## Complete Example

```typescript
import { 
    spec, 
    toAst, 
    fromAst, 
    createRegistry, 
    builtInOperators,
    all, 
    any 
} from '@fajarnugraha37/specification';

// 1. Create a specification
const mySpec = all(
    spec.field("age").gte(18),
    any(
        spec.field("role").eq("admin"),
        spec.field("plan").in(["pro", "enterprise"])
    )
);

// 2. Convert to AST
const ast = toAst(mySpec);

// 3. Store in database (example: JSON string)
const astJson = JSON.stringify(ast);
await db.save('policy-1', astJson);

// 4. Load from database
const loadedJson = await db.load('policy-1');
const loadedAst = JSON.parse(loadedJson);

// 5. Reconstruct specification
const registry = createRegistry({ operators: builtInOperators });
const reconstructedSpec = fromAst(loadedAst, registry);

// 6. Use reconstructed spec
const user = { age: 25, role: "user", plan: "pro" };
const allowed = await reconstructedSpec.isSatisfiedByAsync(user); // true
```

## Best Practices

### ✅ Do

1. **Always validate AST** - The library validates AST structure automatically
2. **Version your policies** - Store version numbers with ASTs
3. **Cache reconstructed specs** - Avoid reconstructing on every request
4. **Use JSONB in PostgreSQL** - Enables efficient querying
5. **Index frequently queried fields** - Add indexes on ast.kind, ast.input.path, etc.

```typescript
// Good: Cache reconstructed specs
const specCache = new Map<string, Specification>();

async function getSpec(id: string) {
    if (!specCache.has(id)) {
        const policy = await db.load(id);
        const ast = JSON.parse(policy.astJson);
        const spec = fromAst(ast, registry);
        specCache.set(id, spec);
    }
    return specCache.get(id);
}
```

### ❌ Don't

1. **Don't reconstruct specs on every evaluation** - Cache them
2. **Don't forget the registry** - fromAst requires a registry with operators
3. **Don't modify AST manually** - Always use toAst() to generate AST
4. **Don't store specs without validation** - Test round-trip before saving

```typescript
// Bad: Reconstructing on every evaluation
async function checkAccess(userId: string, policyId: string) {
    const policy = await db.load(policyId);
    const spec = fromAst(JSON.parse(policy.ast), registry); // ❌ Slow!
    return spec.isSatisfiedBy(user);
}

// Good: Cache reconstructed specs
const specs = new Map();
async function checkAccess(userId: string, policyId: string) {
    if (!specs.has(policyId)) {
        const policy = await db.load(policyId);
        specs.set(policyId, fromAst(JSON.parse(policy.ast), registry));
    }
    return specs.get(policyId).isSatisfiedBy(user);
}
```

## Database Schema Examples

### PostgreSQL

```sql
CREATE TABLE policies (
    id VARCHAR(255) PRIMARY KEY,
    tenant_id VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    ast JSONB NOT NULL,
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE
);

-- Indexes for efficient querying
CREATE INDEX idx_policies_tenant ON policies(tenant_id);
CREATE INDEX idx_policies_kind ON policies USING GIN ((ast->'kind'));
CREATE INDEX idx_policies_active ON policies(is_active) WHERE is_active = TRUE;
```

### MongoDB

```javascript
{
    _id: ObjectId,
    id: String,
    tenantId: String,
    name: String,
    description: String,
    ast: {
        type: String,
        kind: String,
        input: Object,
        nodes: Array
    },
    createdBy: String,
    createdAt: Date,
    updatedAt: Date,
    version: Number,
    isActive: Boolean
}

// Indexes
db.policies.createIndex({ tenantId: 1, isActive: 1 });
db.policies.createIndex({ "ast.kind": 1 });
db.policies.createIndex({ "ast.input.path": 1 });
```

## Error Handling

```typescript
try {
    const ast = toAst(spec);
} catch (error) {
    if (error.code === 'SPEC_AST_INVALID') {
        console.error('Cannot convert specification to AST');
    }
}

try {
    const spec = fromAst(ast, registry);
} catch (error) {
    if (error.code === 'SPEC_AST_INVALID') {
        console.error('Invalid AST structure');
    } else if (error.code === 'SPEC_REGISTRY_UNKNOWN') {
        console.error('Unknown operator or spec reference');
    }
}
```

## Performance Tips

1. **Batch load policies** - Load multiple policies at once
2. **Lazy reconstruction** - Only reconstruct when needed
3. **Memory cache** - Keep hot policies in memory
4. **Redis cache** - Use Redis for distributed caching
5. **Compression** - Compress AST JSON for storage (gzip)

```typescript
// Good: Batch loading with caching
class PolicyService {
    private cache = new Map<string, Specification>();

    async loadMany(ids: string[]): Promise<Map<string, Specification>> {
        const uncached = ids.filter(id => !this.cache.has(id));
        
        if (uncached.length > 0) {
            const policies = await db.query(
                'SELECT id, ast FROM policies WHERE id = ANY($1)',
                [uncached]
            );
            
            for (const policy of policies) {
                const spec = fromAst(JSON.parse(policy.ast), this.registry);
                this.cache.set(policy.id, spec);
            }
        }
        
        return new Map(ids.map(id => [id, this.cache.get(id)!]));
    }
}
```

## See Also

- [Main README](../README.md) - Package overview
- [Examples](../examples/) - Production examples
- [Architecture Guide](../docs/architecture.md) - Design patterns
- [persistence.ts](./persistence.ts) - Complete working example
