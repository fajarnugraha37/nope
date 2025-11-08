# Specification Pattern Examples

This directory contains production-ready examples demonstrating how to use the specification pattern for real-world access control, policy enforcement, and business rule scenarios.

## Available Examples

### 1. **RBAC (Role-Based Access Control)** - `rbac.ts`

A complete RBAC system implementing role hierarchy, permission management, and resource ownership patterns.

**Key Features:**
- Role hierarchy: Admin → Moderator → Editor → Viewer → Guest
- Permission-based access control (read, write, delete, share, manage)
- Resource ownership verification
- Visibility rules (public, private, organization)
- Nested policy composition with `all()` and `any()`

**Use Cases:**
- API authorization middleware
- Document management systems
- Multi-user application security
- Admin panel feature gating

**Run Example:**
```bash
bun run examples/rbac.ts
```

**Example Output:**
```
[Test 1] Admin viewing public document
Result: ✓ ALLOWED

[Test 3] Viewer (different org) editing public document
Result: ✗ DENIED
```

---

### 2. **ABAC (Attribute-Based Access Control)** - `abac.ts`

Fine-grained access control based on user attributes, resource attributes, and environmental context.

**Key Features:**
- Clearance levels (1-5: Public → Top Secret)
- Multi-dimensional attributes (department, certifications, location)
- Time-based restrictions (business hours)
- Location-based access control (office, VPN, country restrictions)
- Employment type considerations (full-time vs contractor)
- Resource expiration checks

**Use Cases:**
- Government/military systems with clearance levels
- Healthcare systems with HIPAA compliance
- Financial services with PCI-DSS requirements
- Enterprise systems with complex security policies

**Run Example:**
```bash
bun run examples/abac.ts
```

**Example Policies:**
- Public documents: Anyone with read permission
- Confidential documents: Same department + certifications
- Top Secret databases: Clearance level 5 + owner/same dept + business hours + office/VPN

---

### 3. **Multi-Tenant Data Isolation** - `multi-tenant.ts`

Tenant-scoped data access patterns with query compilation for database filtering.

**Key Features:**
- Tenant isolation and data scoping
- Cross-tenant resource sharing
- Plan-based feature restrictions (free, pro, enterprise)
- Query compilation to Prisma/MongoDB WHERE clauses
- Row-level security patterns
- User ownership and public/private resources

**Use Cases:**
- SaaS applications with multiple tenants
- B2B platforms with organization boundaries
- Database query optimization with specification compilation
- Shared schema multi-tenancy

**Run Example:**
```bash
bun run examples/multi-tenant.ts
```

**Example Scenarios:**
- Tenant resources: Only visible to tenant members
- Shared resources: Cross-tenant sharing with explicit permissions
- Plan restrictions: Free plans limited to documents only
- Query compilation: Convert specifications to database WHERE clauses

---

### 4. **Feature Flags & A/B Testing** - `feature-flags.ts`

Feature flag system with user targeting, gradual rollouts, and variant assignment.

**Key Features:**
- Percentage-based rollouts with consistent hashing
- User targeting (IDs, email domains, roles, attributes)
- Environment gating (dev, staging, production)
- A/B test variant assignment with weights
- Feature dependencies
- Sticky variant assignments for consistency

**Use Cases:**
- Gradual feature rollouts
- A/B testing and experimentation
- Beta program management
- Environment-specific features
- Premium feature gating

**Run Example:**
```bash
bun run examples/feature-flags.ts
```

**Example Features:**
- 50% rollout: Half of users get new UI
- Role-based: Beta testers get early access
- Plan-based: Premium features for paying users
- Environment: Experimental features in staging only
- Dependencies: Features that require other features enabled

---

## Running Examples

All examples can be run directly with Bun:

```bash
# From the specification package directory
cd packages/specification

# Run any example
bun run examples/rbac.ts
bun run examples/abac.ts
bun run examples/multi-tenant.ts
bun run examples/feature-flags.ts
```

## Example Structure

Each example follows this structure:

1. **Domain Types**: Interfaces for users, resources, and context
2. **Atomic Specifications**: Reusable building blocks (role checks, permission checks)
3. **Composite Policies**: Complex rules built from atomic specs using `all()` and `any()`
4. **Policy Registry**: Map actions to their enforcement policies
5. **Helper Functions**: `canPerformAction()` and `explainAccess()`
6. **Usage Demonstrations**: Real-world test scenarios

## Key Patterns Demonstrated

### 1. **Field Access with Dotted Paths**
```typescript
spec.field<Context>("user.roles" as any).contains("admin")
spec.field<Context>("resource.visibility" as any).eq("public")
```

### 2. **Custom Specifications with BaseSpec**
```typescript
class ResourceOwnerSpec extends BaseSpec<AccessContext> {
  protected evaluate(ctx: AccessContext): boolean {
    return ctx.user.id === ctx.resource.owner;
  }
}
```

### 3. **Policy Composition**
```typescript
const policy = all(
  isActiveUser,
  hasRequiredClearance,
  any(
    isResourceOwner,
    all(isInSameDepartment, hasPermission)
  )
);
```

### 4. **Async Evaluation**
```typescript
const allowed = await policy.isSatisfiedByAsync(context);
```

### 5. **Explain Trees**
```typescript
const explanation = policy.explain(context);
// Provides hierarchical tree of which rules passed/failed
```

## Learning Path

1. **Start with RBAC** (`rbac.ts`)
   - Simple role and permission concepts
   - Basic policy composition
   - Resource ownership patterns

2. **Progress to ABAC** (`abac.ts`)
   - Multi-dimensional attributes
   - Environmental context
   - Complex policy combinations

## Integration Examples

### Express Middleware (RBAC)
```typescript
app.get('/documents/:id', async (req, res) => {
  const user = req.user;
  const document = await db.documents.findById(req.params.id);
  
  if (!await canPerformAction(user, document, 'view')) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  res.json(document);
});
```

### Policy Explanation for Audit Logs
```typescript
const explanation = explainAccess(user, resource, 'delete');
await auditLog.create({
  userId: user.id,
  action: 'delete',
  resourceId: resource.id,
  decision: allowed ? 'GRANTED' : 'DENIED',
  reason: explanation
});
```

## Tips for Production Use

1. **Cache Specifications**: Create specs once, reuse across requests
2. **Use Async Evaluation**: Always use `isSatisfiedByAsync` when working with field specs
3. **Extend BaseSpec**: For custom logic that can't be expressed with DSL
4. **Compose Policies**: Build complex policies from simple, tested building blocks
5. **Explain Decisions**: Use `explain()` for debugging and audit trails

## Next Steps

After mastering these examples:
- Explore multi-tenant filtering with database adapters
- Build feature flag systems with percentage rollouts
- Create custom specifications for your domain
- Integrate with your authentication/authorization system

## Support

- **Documentation**: See main package README and architecture guide
- **API Reference**: Full TSDoc comments in source code
- **Issues**: Report bugs or request examples via GitHub issues
