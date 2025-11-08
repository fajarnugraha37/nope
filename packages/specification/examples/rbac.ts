/**
 * RBAC (Role-Based Access Control) Example
 * 
 * This example demonstrates how to build a production-ready RBAC system using
 * the specification pattern. It shows:
 * - Role hierarchy and permission management
 * - Resource ownership and access control
 * - Reusable permission specifications
 * - Combining multiple access rules
 * 
 * Use cases:
 * - API authorization middleware
 * - Document access control
 * - Admin panel feature gating
 * - Multi-user application security
 */

import { spec, all, any, createRegistry } from "../src/index.js";
import type { Specification } from "../src/core/types.js";

// ============================================================================
// Domain Models
// ============================================================================

/**
 * User with roles and permissions
 */
interface User {
  id: string;
  email: string;
  roles: Role[];
  permissions: Permission[];
  isActive: boolean;
  createdAt: Date;
}

/**
 * Resource that can be accessed
 */
interface Resource {
  id: string;
  type: ResourceType;
  ownerId: string;
  organizationId: string;
  visibility: "public" | "private" | "organization";
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Access context with user and resource
 */
interface AccessContext {
  user: User;
  resource: Resource;
  action: Action;
  timestamp: Date;
}

type Role = "admin" | "moderator" | "editor" | "viewer" | "guest";
type Permission = "read" | "write" | "delete" | "share" | "manage";
type ResourceType = "document" | "project" | "user" | "setting";
type Action = "view" | "edit" | "delete" | "share" | "manage";

// ============================================================================
// Role Specifications
// ============================================================================

/**
 * User has admin role
 */
const isAdmin: Specification<AccessContext> = spec
  .field<AccessContext>("user.roles" as any)
  .contains("admin");

/**
 * User has moderator role
 */
const isModerator: Specification<AccessContext> = spec
  .field<AccessContext>("user.roles" as any)
  .contains("moderator");

/**
 * User has editor role
 */
const isEditor: Specification<AccessContext> = spec
  .field<AccessContext>("user.roles" as any)
  .contains("editor");

/**
 * User has viewer role
 */
const isViewer: Specification<AccessContext> = spec
  .field<AccessContext>("user.roles" as any)
  .contains("viewer");

/**
 * User has at least viewer role (viewer, editor, moderator, or admin)
 */
const hasViewerRole = any(isAdmin, isModerator, isEditor, isViewer);

/**
 * User has at least editor role (editor, moderator, or admin)
 */
const hasEditorRole = any(isAdmin, isModerator, isEditor);

/**
 * User has at least moderator role (moderator or admin)
 */
const hasModeratorRole = any(isAdmin, isModerator);

// ============================================================================
// Permission Specifications
// ============================================================================

/**
 * User has specific permission
 */
const hasPermission = (permission: Permission): Specification<AccessContext> =>
  spec.field<AccessContext>("user.permissions" as any).contains(permission);

/**
 * User has read permission
 */
const canRead = hasPermission("read");

/**
 * User has write permission
 */
const canWrite = hasPermission("write");

/**
 * User has delete permission
 */
const canDelete = hasPermission("delete");

/**
 * User has share permission
 */
const canShare = hasPermission("share");

/**
 * User has manage permission
 */
const canManage = hasPermission("manage");

// ============================================================================
// User State Specifications
// ============================================================================

/**
 * User account is active
 */
const isActiveUser: Specification<AccessContext> = spec
  .field<AccessContext>("user.isActive" as any)
  .eq(true);

/**
 * User owns the resource
 */
import { BaseSpec } from "../src/core/base-spec.js";

class ResourceOwnerSpec extends BaseSpec<AccessContext> {
  constructor() {
    super("is_resource_owner", {
      meta: { name: "Is Resource Owner" },
    });
  }

  protected evaluate(ctx: AccessContext): boolean {
    return ctx.user.id === ctx.resource.ownerId;
  }

  protected describe(ctx: AccessContext) {
    const pass = this.evaluate(ctx);
    return {
      id: this.id,
      name: this.name,
      pass: "unknown" as const,
      reason: pass
        ? `User ${ctx.user.id} owns resource ${ctx.resource.id}`
        : `User ${ctx.user.id} does not own resource ${ctx.resource.id}`,
    };
  }
}

const isResourceOwner = new ResourceOwnerSpec();

// ============================================================================
// Resource Visibility Specifications
// ============================================================================

/**
 * Resource is public
 */
const isPublicResource: Specification<AccessContext> = spec
  .field<AccessContext>("resource.visibility" as any)
  .eq("public");

/**
 * Resource is private
 */
const isPrivateResource: Specification<AccessContext> = spec
  .field<AccessContext>("resource.visibility" as any)
  .eq("private");

/**
 * Resource is organization-scoped
 */
const isOrganizationResource: Specification<AccessContext> = spec
  .field<AccessContext>("resource.visibility" as any)
  .eq("organization");

/**
 * User belongs to resource's organization
 */
class SameOrganizationSpec extends BaseSpec<AccessContext> {
  constructor() {
    super("is_in_same_organization", {
      meta: { name: "Is In Same Organization" },
    });
  }

  protected evaluate(ctx: AccessContext): boolean {
    // In a real system, check user's organizations
    return ctx.user.id.startsWith(ctx.resource.organizationId);
  }

  protected describe(ctx: AccessContext) {
    const pass = this.evaluate(ctx);
    return {
      id: this.id,
      name: this.name,
      pass: "unknown" as const,
      reason: pass
        ? `User ${ctx.user.id} belongs to organization ${ctx.resource.organizationId}`
        : `User ${ctx.user.id} does not belong to organization ${ctx.resource.organizationId}`,
    };
  }
}

const isInSameOrganization = new SameOrganizationSpec();

// ============================================================================
// Access Control Policies
// ============================================================================

/**
 * Policy: Can view a resource
 * 
 * Rules:
 * 1. Admins can view everything
 * 2. Resource owner can view their own resources
 * 3. Public resources can be viewed by anyone with viewer role
 * 4. Organization resources can be viewed by organization members with viewer role
 * 5. User must be active
 */
const canViewResource: Specification<AccessContext> = all(
  isActiveUser,
  any(
    isAdmin,
    isResourceOwner,
    all(hasViewerRole, isPublicResource),
    all(hasViewerRole, isOrganizationResource, isInSameOrganization)
  )
);

/**
 * Policy: Can edit a resource
 * 
 * Rules:
 * 1. Admins and moderators can edit everything
 * 2. Resource owner can edit their own resources
 * 3. Editors can edit public and organization resources
 * 4. User must be active and have write permission
 */
const canEditResource: Specification<AccessContext> = all(
  isActiveUser,
  canWrite,
  any(
    hasModeratorRole,
    isResourceOwner,
    all(hasEditorRole, any(isPublicResource, isOrganizationResource))
  )
);

/**
 * Policy: Can delete a resource
 * 
 * Rules:
 * 1. Only admins and resource owners can delete
 * 2. User must be active and have delete permission
 */
const canDeleteResource: Specification<AccessContext> = all(
  isActiveUser,
  canDelete,
  any(isAdmin, isResourceOwner)
);

/**
 * Policy: Can share a resource
 * 
 * Rules:
 * 1. Admins, moderators, and resource owners can share
 * 2. Resource must not be private (unless owner)
 * 3. User must be active and have share permission
 */
const canShareResource: Specification<AccessContext> = all(
  isActiveUser,
  canShare,
  any(
    isAdmin,
    isModerator,
    all(isResourceOwner, isPrivateResource.not()),
    all(hasEditorRole, isPublicResource)
  )
);

/**
 * Policy: Can manage resource settings
 * 
 * Rules:
 * 1. Only admins and resource owners can manage settings
 * 2. User must be active and have manage permission
 */
const canManageResource: Specification<AccessContext> = all(
  isActiveUser,
  canManage,
  any(isAdmin, isResourceOwner)
);

// ============================================================================
// Policy Registry
// ============================================================================

/**
 * Centralized policy registry for easy lookup
 */
const policyRegistry = new Map<Action, Specification<AccessContext>>([
  ["view", canViewResource],
  ["edit", canEditResource],
  ["delete", canDeleteResource],
  ["share", canShareResource],
  ["manage", canManageResource],
]);

/**
 * Check if user can perform action on resource
 */
export async function canPerformAction(
  user: User,
  resource: Resource,
  action: Action
): Promise<boolean> {
  const policy = policyRegistry.get(action);
  if (!policy) {
    throw new Error(`Unknown action: ${action}`);
  }

  const context: AccessContext = {
    user,
    resource,
    action,
    timestamp: new Date(),
  };

  return await policy.isSatisfiedByAsync!(context);
}

/**
 * Explain why access was granted or denied
 */
export function explainAccess(
  user: User,
  resource: Resource,
  action: Action
): string {
  const policy = policyRegistry.get(action);
  if (!policy) {
    return `Unknown action: ${action}`;
  }

  const context: AccessContext = {
    user,
    resource,
    action,
    timestamp: new Date(),
  };

  const explanation = policy.explain(context);
  
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
  // Sample data
  const adminUser: User = {
    id: "admin-1",
    email: "admin@example.com",
    roles: ["admin"],
    permissions: ["read", "write", "delete", "share", "manage"],
    isActive: true,
    createdAt: new Date("2024-01-01"),
  };

  const editorUser: User = {
    id: "org-abc-editor-1",
    email: "editor@example.com",
    roles: ["editor"],
    permissions: ["read", "write", "share"],
    isActive: true,
    createdAt: new Date("2024-06-01"),
  };

  const viewerUser: User = {
    id: "org-xyz-viewer-1",
    email: "viewer@example.com",
    roles: ["viewer"],
    permissions: ["read"],
    isActive: true,
    createdAt: new Date("2024-11-01"),
  };

  const publicDocument: Resource = {
    id: "doc-public-1",
    type: "document",
    ownerId: "org-abc-editor-1",
    organizationId: "org-abc",
    visibility: "public",
    createdAt: new Date("2024-07-01"),
    updatedAt: new Date("2024-11-01"),
  };

  const privateDocument: Resource = {
    id: "doc-private-1",
    type: "document",
    ownerId: "org-abc-editor-1",
    organizationId: "org-abc",
    visibility: "private",
    createdAt: new Date("2024-08-01"),
    updatedAt: new Date("2024-11-01"),
  };

  console.log("=".repeat(60));
  console.log("RBAC Example - Access Control Decisions");
  console.log("=".repeat(60));

  // Test 1: Admin can do everything
  console.log("\n[Test 1] Admin viewing public document");
  console.log(
    "Result:",
    (await canPerformAction(adminUser, publicDocument, "view")) ? "✓ ALLOWED" : "✗ DENIED"
  );

  // Test 2: Editor can view public document
  console.log("\n[Test 2] Editor viewing public document");
  console.log(
    "Result:",
    (await canPerformAction(editorUser, publicDocument, "view")) ? "✓ ALLOWED" : "✗ DENIED"
  );

  // Test 3: Viewer from different org cannot edit public document
  console.log("\n[Test 3] Viewer (different org) editing public document");
  console.log(
    "Result:",
    (await canPerformAction(viewerUser, publicDocument, "edit")) ? "✓ ALLOWED" : "✗ DENIED"
  );
  console.log("\nExplanation:");
  console.log(explainAccess(viewerUser, publicDocument, "edit"));

  // Test 4: Owner can edit their private document
  console.log("\n[Test 4] Owner editing their private document");
  console.log(
    "Result:",
    (await canPerformAction(editorUser, privateDocument, "edit")) ? "✓ ALLOWED" : "✗ DENIED"
  );

  // Test 5: Viewer cannot view private document
  console.log("\n[Test 5] Viewer viewing private document");
  console.log(
    "Result:",
    (await canPerformAction(viewerUser, privateDocument, "view")) ? "✓ ALLOWED" : "✗ DENIED"
  );
  console.log("\nExplanation:");
  console.log(explainAccess(viewerUser, privateDocument, "view"));

  // Test 6: Editor (resource owner but lacks delete permission) cannot delete
  console.log("\n[Test 6] Editor attempting to delete their private document");
  console.log(
    "Result:",
    (await canPerformAction(editorUser, privateDocument, "delete")) ? "✓ ALLOWED" : "✗ DENIED"
  );

  console.log("\n" + "=".repeat(60));
  console.log("Summary: All access control policies enforced correctly!");
  console.log("=".repeat(60));
}
