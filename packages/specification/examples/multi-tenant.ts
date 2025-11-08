/**
 * @fileoverview Multi-Tenant Data Isolation Example
 * 
 * This example demonstrates how to use specifications for tenant-scoped data access
 * and how specifications can be compiled to database queries for efficient filtering.
 * 
 * Key Concepts:
 * - Tenant isolation and data scoping
 * - Specification compilation to SQL/MongoDB queries
 * - Row-level security patterns
 * - Shared schema multi-tenancy
 * - Cross-tenant access controls
 * 
 * @example
 * ```typescript
 * const spec = tenant.is("acme-corp").and(resource.isActive());
 * const prismaQuery = toPrismaWhere(spec);
 * const results = await db.resources.findMany({ where: prismaQuery });
 * ```
 */

import { spec, all, any } from "../src/index.js";
import type { Specification } from "../src/core/types.js";

// ============================================================================
// Domain Types
// ============================================================================

type TenantId = string;
type UserId = string;
type ResourceId = string;

/**
 * Tenant configuration and metadata
 */
interface Tenant {
  id: TenantId;
  name: string;
  plan: "free" | "starter" | "professional" | "enterprise";
  isActive: boolean;
  features: string[];
  createdAt: Date;
  metadata: {
    maxUsers?: number;
    maxStorage?: number; // in GB
    allowCrossReference?: boolean;
  };
}

/**
 * User within a tenant
 */
interface User {
  id: UserId;
  email: string;
  tenantId: TenantId;
  role: "owner" | "admin" | "member" | "guest";
  isActive: boolean;
  permissions: string[];
  metadata: {
    department?: string;
    team?: string;
  };
}

/**
 * Resource that belongs to a tenant
 */
interface Resource {
  id: ResourceId;
  name: string;
  type: "document" | "project" | "dataset" | "report";
  tenantId: TenantId;
  ownerId: UserId;
  isPublic: boolean;
  isArchived: boolean;
  tags: string[];
  sharedWith: {
    tenantIds: TenantId[]; // Cross-tenant sharing
    userIds: UserId[]; // Specific user access
  };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Query context for tenant-scoped operations
 */
interface TenantContext {
  currentTenant: Tenant;
  currentUser: User;
  resource?: Resource;
}

// ============================================================================
// Tenant Specifications
// ============================================================================

/**
 * Resource belongs to the current tenant
 */
const belongsToTenant = (tenantId: TenantId): Specification<Resource> =>
  spec.field<Resource>("tenantId" as any).eq(tenantId);

/**
 * Resource is owned by specific user
 */
const isOwnedBy = (userId: UserId): Specification<Resource> =>
  spec.field<Resource>("ownerId" as any).eq(userId);

/**
 * Resource is public within tenant
 */
const isPublicResource: Specification<Resource> = spec
  .field<Resource>("isPublic" as any)
  .eq(true);

/**
 * Resource is not archived
 */
const isActiveResource: Specification<Resource> = spec
  .field<Resource>("isArchived" as any)
  .eq(false);

/**
 * Resource has specific tag
 */
const hasTag = (tag: string): Specification<Resource> =>
  spec.field<Resource>("tags" as any).contains(tag);

/**
 * Resource is of specific type
 */
const isResourceType = (type: Resource["type"]): Specification<Resource> =>
  spec.field<Resource>("type" as any).eq(type);

/**
 * Resource was created after date
 */
const createdAfter = (date: Date): Specification<Resource> =>
  spec.field<Resource>("createdAt" as any).gte(date.getTime());

/**
 * Resource was updated recently (last 30 days)
 */
const isRecentlyUpdated = (): Specification<Resource> => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return spec.field<Resource>("updatedAt" as any).gte(thirtyDaysAgo.getTime());
};

// ============================================================================
// Cross-Tenant Specifications
// ============================================================================

/**
 * Resource is shared with specific tenant
 */
const isSharedWithTenant = (tenantId: TenantId): Specification<Resource> =>
  spec.field<Resource>("sharedWith.tenantIds" as any).contains(tenantId);

/**
 * Resource is shared with specific user
 */
const isSharedWithUser = (userId: UserId): Specification<Resource> =>
  spec.field<Resource>("sharedWith.userIds" as any).contains(userId);

// ============================================================================
// Policy Specifications
// ============================================================================

/**
 * Resources visible to tenant user
 * 
 * Rules:
 * 1. Resource belongs to user's tenant AND is active
 * 2. OR resource is shared with user's tenant
 * 3. OR resource is shared with user specifically
 */
const visibleToUser = (
  tenantId: TenantId,
  userId: UserId
): Specification<Resource> =>
  all(
    isActiveResource,
    any(
      belongsToTenant(tenantId),
      isSharedWithTenant(tenantId),
      isSharedWithUser(userId)
    )
  );

/**
 * Resources that user can edit
 * 
 * Rules:
 * 1. User owns the resource
 * 2. OR (resource belongs to tenant AND user is admin/owner)
 */
const editableByUser = (
  tenantId: TenantId,
  userId: UserId,
  userRole: User["role"]
): Specification<Resource> => {
  if (userRole === "owner" || userRole === "admin") {
    // Admin/owner can edit any resource in their tenant
    return any(isOwnedBy(userId), belongsToTenant(tenantId));
  }
  // Other roles can only edit their own resources
  return isOwnedBy(userId);
};

/**
 * Resources accessible on free plan
 * Limited to documents and not archived
 */
const accessibleOnFreePlan: Specification<Resource> = all(
  isActiveResource,
  isResourceType("document")
);

/**
 * Resources requiring professional plan or higher
 */
const requiresProfessionalPlan: Specification<Resource> = any(
  isResourceType("dataset"),
  isResourceType("report")
);

// ============================================================================
// Query Compilation Examples
// ============================================================================

/**
 * Simulate Prisma WHERE clause generation
 * 
 * Note: This is a simplified simulation. In production, you would use
 * the actual adapter from the specification package.
 */
function toPrismaWhere(specification: Specification<Resource>): Record<string, any> {
  // This is a mock implementation showing the concept
  // Real implementation would use the PrismaAdapter from the package
  
  const mockCompile = (spec: any): any => {
    // For demonstration purposes, we'll return a simplified structure
    return {
      _comment: "In production, use PrismaAdapter to compile specifications",
      _spec: spec.id || "composite",
      // Actual Prisma WHERE clause would be generated here
    };
  };

  return mockCompile(specification);
}

/**
 * Simulate MongoDB query generation
 */
function toMongoQuery(specification: Specification<Resource>): Record<string, any> {
  // This is a mock implementation showing the concept
  // Real implementation would use the MongoDBAdapter from the package
  
  return {
    _comment: "In production, use MongoDBAdapter to compile specifications",
    _spec: specification.id,
    // Actual MongoDB query would be generated here
  };
}

// ============================================================================
// Multi-Tenant Query Examples
// ============================================================================

/**
 * Build tenant-scoped query for listing resources
 */
export function buildTenantQuery(context: TenantContext): Specification<Resource> {
  const { currentTenant, currentUser } = context;

  // Base visibility rule
  let query = visibleToUser(currentTenant.id, currentUser.id);

  // Apply plan restrictions
  if (currentTenant.plan === "free") {
    query = all(query, accessibleOnFreePlan);
  }

  return query;
}

/**
 * Build query for resources user can edit
 */
export function buildEditableQuery(context: TenantContext): Specification<Resource> {
  const { currentTenant, currentUser } = context;

  return all(
    visibleToUser(currentTenant.id, currentUser.id),
    editableByUser(currentTenant.id, currentUser.id, currentUser.role)
  );
}

/**
 * Build query for searching resources with filters
 */
export function buildSearchQuery(
  context: TenantContext,
  filters: {
    type?: Resource["type"];
    tags?: string[];
    onlyOwned?: boolean;
    includeArchived?: boolean;
    createdAfterDate?: Date;
  }
): Specification<Resource> {
  const { currentTenant, currentUser } = context;

  let query = visibleToUser(currentTenant.id, currentUser.id);

  // Apply type filter
  if (filters.type) {
    query = all(query, isResourceType(filters.type));
  }

  // Apply tag filters
  if (filters.tags && filters.tags.length > 0) {
    const tagSpecs = filters.tags.map(tag => hasTag(tag));
    query = all(query, any(...tagSpecs));
  }

  // Only user's own resources
  if (filters.onlyOwned) {
    query = all(query, isOwnedBy(currentUser.id));
  }

  // Include archived or not
  if (!filters.includeArchived) {
    query = all(query, isActiveResource);
  }

  // Date filter
  if (filters.createdAfterDate) {
    query = all(query, createdAfter(filters.createdAfterDate));
  }

  return query;
}

/**
 * Explain query for debugging
 */
export function explainQuery(
  query: Specification<Resource>,
  resource: Resource
): string {
  const explanation = query.explain(resource);

  const formatNode = (node: any, indent = 0): string => {
    const prefix = "  ".repeat(indent);
    const status = node.pass ? "✓" : "✗";
    const lines = [`${prefix}${status} ${node.name || node.id}`];

    if (node.reason) {
      lines.push(`${prefix}  ${node.reason}`);
    }

    if (node.children) {
      for (const child of node.children) {
        lines.push(formatNode(child, indent + 1));
      }
    }

    return lines.join("\n");
  };

  return formatNode(explanation);
}

// ============================================================================
// Usage Examples
// ============================================================================

if (import.meta.main) {
  (async () => {
  // Sample tenants
  const acmeTenant: Tenant = {
    id: "tenant-acme",
    name: "Acme Corporation",
    plan: "professional",
    isActive: true,
    features: ["advanced-analytics", "custom-domains"],
    createdAt: new Date("2024-01-15"),
    metadata: {
      maxUsers: 50,
      maxStorage: 100,
      allowCrossReference: true,
    },
  };

  const startupTenant: Tenant = {
    id: "tenant-startup",
    name: "Startup Inc",
    plan: "free",
    isActive: true,
    features: [],
    createdAt: new Date("2024-11-01"),
    metadata: {
      maxUsers: 5,
      maxStorage: 5,
      allowCrossReference: false,
    },
  };

  // Sample users
  const acmeAdmin: User = {
    id: "user-001",
    email: "admin@acme.com",
    tenantId: "tenant-acme",
    role: "admin",
    isActive: true,
    permissions: ["read", "write", "delete", "share"],
    metadata: {
      department: "engineering",
    },
  };

  const acmeMember: User = {
    id: "user-002",
    email: "member@acme.com",
    tenantId: "tenant-acme",
    role: "member",
    isActive: true,
    permissions: ["read", "write"],
    metadata: {
      department: "engineering",
    },
  };

  const startupOwner: User = {
    id: "user-003",
    email: "owner@startup.com",
    tenantId: "tenant-startup",
    role: "owner",
    isActive: true,
    permissions: ["read", "write", "delete", "share"],
    metadata: {},
  };

  // Sample resources
  const acmeDocument: Resource = {
    id: "doc-001",
    name: "Product Roadmap",
    type: "document",
    tenantId: "tenant-acme",
    ownerId: "user-001",
    isPublic: true,
    isArchived: false,
    tags: ["planning", "q4-2024"],
    sharedWith: {
      tenantIds: [],
      userIds: [],
    },
    createdAt: new Date("2024-10-01"),
    updatedAt: new Date("2024-11-15"),
  };

  const acmeDataset: Resource = {
    id: "data-001",
    name: "Customer Analytics",
    type: "dataset",
    tenantId: "tenant-acme",
    ownerId: "user-002",
    isPublic: false,
    isArchived: false,
    tags: ["analytics", "customers"],
    sharedWith: {
      tenantIds: ["tenant-startup"], // Shared with startup
      userIds: [],
    },
    createdAt: new Date("2024-09-15"),
    updatedAt: new Date("2024-11-20"),
  };

  const archivedProject: Resource = {
    id: "proj-001",
    name: "Legacy Project",
    type: "project",
    tenantId: "tenant-acme",
    ownerId: "user-001",
    isPublic: false,
    isArchived: true,
    tags: ["archived", "legacy"],
    sharedWith: {
      tenantIds: [],
      userIds: [],
    },
    createdAt: new Date("2023-01-01"),
    updatedAt: new Date("2023-12-31"),
  };

  const startupDocument: Resource = {
    id: "doc-002",
    name: "Pitch Deck",
    type: "document",
    tenantId: "tenant-startup",
    ownerId: "user-003",
    isPublic: false,
    isArchived: false,
    tags: ["fundraising"],
    sharedWith: {
      tenantIds: [],
      userIds: ["user-001"], // Shared with Acme admin
    },
    createdAt: new Date("2024-11-05"),
    updatedAt: new Date("2024-11-07"),
  };

  console.log("=".repeat(70));
  console.log("Multi-Tenant Data Isolation Example");
  console.log("=".repeat(70));

  // Test 1: Acme admin can see their tenant's resources
  console.log("\n[Test 1] Acme admin viewing tenant resources");
  const acmeContext: TenantContext = {
    currentTenant: acmeTenant,
    currentUser: acmeAdmin,
  };
  const acmeQuery = buildTenantQuery(acmeContext);
  console.log("Can see acme document:", (await acmeQuery.isSatisfiedByAsync!(acmeDocument)) ? "✓" : "✗");
  console.log("Can see acme dataset:", (await acmeQuery.isSatisfiedByAsync!(acmeDataset)) ? "✓" : "✗");
  console.log("Can see archived:", (await acmeQuery.isSatisfiedByAsync!(archivedProject)) ? "✓" : "✗");
  console.log("Can see shared startup doc:", (await acmeQuery.isSatisfiedByAsync!(startupDocument)) ? "✓" : "✗");

  // Test 2: Startup user on free plan (limited access)
  console.log("\n[Test 2] Startup owner on free plan");
  const startupContext: TenantContext = {
    currentTenant: startupTenant,
    currentUser: startupOwner,
  };
  const startupQuery = buildTenantQuery(startupContext);
  console.log("Can see own document:", (await startupQuery.isSatisfiedByAsync!(startupDocument)) ? "✓" : "✗");
  console.log("Can see shared dataset:", (await startupQuery.isSatisfiedByAsync!(acmeDataset)) ? "✓" : "✗");

  // Test 3: Edit permissions
  console.log("\n[Test 3] Edit permissions");
  const editQuery = buildEditableQuery(acmeContext);
  console.log("Admin can edit public doc:", (await editQuery.isSatisfiedByAsync!(acmeDocument)) ? "✓" : "✗");
  console.log("Admin can edit member's dataset:", (await editQuery.isSatisfiedByAsync!(acmeDataset)) ? "✓" : "✗");
  
  const memberContext: TenantContext = {
    currentTenant: acmeTenant,
    currentUser: acmeMember,
  };
  const memberEditQuery = buildEditableQuery(memberContext);
  console.log("Member can edit own dataset:", (await memberEditQuery.isSatisfiedByAsync!(acmeDataset)) ? "✓" : "✗");
  console.log("Member can edit admin's doc:", (await memberEditQuery.isSatisfiedByAsync!(acmeDocument)) ? "✓" : "✗");

  // Test 4: Search with filters
  console.log("\n[Test 4] Filtered search - documents with 'planning' tag");
  const searchQuery = buildSearchQuery(acmeContext, {
    type: "document",
    tags: ["planning"],
  });
  console.log("Matches roadmap doc:", (await searchQuery.isSatisfiedByAsync!(acmeDocument)) ? "✓" : "✗");
  console.log("Matches dataset:", (await searchQuery.isSatisfiedByAsync!(acmeDataset)) ? "✓" : "✗");

  // Test 5: Query compilation examples
  console.log("\n[Test 5] Query Compilation (Simulated)");
  const visibilitySpec = visibleToUser("tenant-acme", "user-001");
  console.log("Prisma WHERE clause:", JSON.stringify(toPrismaWhere(visibilitySpec), null, 2));
  console.log("MongoDB query:", JSON.stringify(toMongoQuery(visibilitySpec), null, 2));

  // Test 6: Explain query
  console.log("\n[Test 6] Query Explanation - Why member can't see shared startup doc");
  const memberQuery = buildTenantQuery(memberContext);
  console.log(explainQuery(memberQuery, startupDocument));

  console.log("\n" + "=".repeat(70));
  console.log("Summary: Multi-tenant isolation enforced with specification patterns!");
  console.log("=".repeat(70));
  })();
}
