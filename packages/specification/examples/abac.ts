/**
 * @fileoverview Attribute-Based Access Control (ABAC) Example
 * 
 * This example demonstrates how to implement a production-ready ABAC system using
 * the specification pattern. ABAC provides fine-grained access control based on
 * attributes of users, resources, and environmental context.
 * 
 * Key Concepts:
 * - User attributes (department, clearance, certifications, location)
 * - Resource attributes (classification, department, sensitivity, tags)
 * - Environmental attributes (time, IP, device type)
 * - Dynamic policy evaluation
 * - Context-aware access decisions
 * 
 * @example
 * ```typescript
 * const user = { department: "engineering", clearanceLevel: 3 };
 * const resource = { classification: "confidential", department: "engineering" };
 * const allowed = await canAccess(user, resource, "read");
 * ```
 */

import { spec, all, any } from "../src/index.js";
import { BaseSpec } from "../src/core/base-spec.js";
import type { Specification } from "../src/core/types.js";

// ============================================================================
// Domain Types
// ============================================================================

type ClearanceLevel = 1 | 2 | 3 | 4 | 5; // 1=Public, 2=Internal, 3=Confidential, 4=Secret, 5=Top Secret
type Classification = "public" | "internal" | "confidential" | "secret" | "top-secret";
type Department = "engineering" | "finance" | "hr" | "legal" | "sales" | "operations";
type Action = "read" | "write" | "delete" | "export" | "share";

/**
 * User with attributes for access control
 */
interface User {
  id: string;
  email: string;
  department: Department;
  clearanceLevel: ClearanceLevel;
  certifications: string[]; // e.g., ["ISO27001", "HIPAA"]
  location: {
    country: string;
    office: string;
    ipAddress: string;
  };
  employmentType: "full-time" | "contractor" | "intern";
  isActive: boolean;
  joinDate: Date;
}

/**
 * Resource with attributes for access control
 */
interface Resource {
  id: string;
  type: "document" | "database" | "api" | "system";
  classification: Classification;
  department: Department;
  owner: string; // User ID
  sensitivity: "low" | "medium" | "high" | "critical";
  tags: string[];
  metadata: {
    createdAt: Date;
    lastModified: Date;
    expiresAt?: Date;
  };
  allowedLocations?: string[]; // Country codes
  requiredCertifications?: string[];
}

/**
 * Environmental context for access decisions
 */
interface Environment {
  timestamp: Date;
  ipAddress: string;
  deviceType: "desktop" | "mobile" | "tablet";
  isVPN: boolean;
  location: {
    country: string;
    office?: string;
  };
}

/**
 * Complete access context
 */
interface AccessContext {
  user: User;
  resource: Resource;
  action: Action;
  environment: Environment;
}

// ============================================================================
// User Attribute Specifications
// ============================================================================

/**
 * User has sufficient clearance level
 */
const hasClearanceLevel = (level: ClearanceLevel): Specification<AccessContext> =>
  spec.field<AccessContext>("user.clearanceLevel" as any).gte(level);

/**
 * User belongs to specific department
 */
const isInDepartment = (dept: Department): Specification<AccessContext> =>
  spec.field<AccessContext>("user.department" as any).eq(dept);

/**
 * User has required certification
 */
const hasCertification = (cert: string): Specification<AccessContext> =>
  spec.field<AccessContext>("user.certifications" as any).contains(cert);

/**
 * User is full-time employee
 */
const isFullTimeEmployee: Specification<AccessContext> = spec
  .field<AccessContext>("user.employmentType" as any)
  .eq("full-time");

/**
 * User is contractor
 */
const isContractor: Specification<AccessContext> = spec
  .field<AccessContext>("user.employmentType" as any)
  .eq("contractor");

/**
 * User account is active
 */
const isActiveUser: Specification<AccessContext> = spec
  .field<AccessContext>("user.isActive" as any)
  .eq(true);

// ============================================================================
// Resource Attribute Specifications
// ============================================================================

/**
 * Map classification to required clearance level
 */
const classificationToClearance: Record<Classification, ClearanceLevel> = {
  public: 1,
  internal: 2,
  confidential: 3,
  secret: 4,
  "top-secret": 5,
};

/**
 * User clearance meets resource classification requirement
 */
class ClearanceRequirementSpec extends BaseSpec<AccessContext> {
  constructor() {
    super("clearance_requirement", {
      meta: { name: "Clearance Requirement Met" },
    });
  }

  protected evaluate(ctx: AccessContext): boolean {
    const requiredLevel = classificationToClearance[ctx.resource.classification];
    return ctx.user.clearanceLevel >= requiredLevel;
  }
}

const hasRequiredClearance = new ClearanceRequirementSpec();

/**
 * Resource belongs to user's department
 */
class SameDepartmentSpec extends BaseSpec<AccessContext> {
  constructor() {
    super("same_department", {
      meta: { name: "Same Department" },
    });
  }

  protected evaluate(ctx: AccessContext): boolean {
    return ctx.user.department === ctx.resource.department;
  }
}

const isInResourceDepartment = new SameDepartmentSpec();

/**
 * User owns the resource
 */
class ResourceOwnerSpec extends BaseSpec<AccessContext> {
  constructor() {
    super("resource_owner", {
      meta: { name: "Resource Owner" },
    });
  }

  protected evaluate(ctx: AccessContext): boolean {
    return ctx.user.id === ctx.resource.owner;
  }
}

const isResourceOwner = new ResourceOwnerSpec();

/**
 * Resource sensitivity check
 */
const isSensitivityLevel = (level: "low" | "medium" | "high" | "critical"): Specification<AccessContext> =>
  spec.field<AccessContext>("resource.sensitivity" as any).eq(level);

const isLowSensitivity = isSensitivityLevel("low");
const isMediumSensitivity = isSensitivityLevel("medium");
const isHighSensitivity = isSensitivityLevel("high");
const isCriticalSensitivity = isSensitivityLevel("critical");

// ============================================================================
// Environmental Context Specifications
// ============================================================================

/**
 * Access during business hours (8 AM - 6 PM)
 */
class BusinessHoursSpec extends BaseSpec<AccessContext> {
  constructor() {
    super("business_hours", {
      meta: { name: "Business Hours" },
    });
  }

  protected evaluate(ctx: AccessContext): boolean {
    const hour = ctx.environment.timestamp.getHours();
    return hour >= 8 && hour < 18;
  }
}

const isDuringBusinessHours = new BusinessHoursSpec();

/**
 * Access from office location
 */
class OfficeLocationSpec extends BaseSpec<AccessContext> {
  constructor() {
    super("office_location", {
      meta: { name: "Office Location" },
    });
  }

  protected evaluate(ctx: AccessContext): boolean {
    return ctx.environment.location.office !== undefined;
  }
}

const isFromOffice = new OfficeLocationSpec();

/**
 * Access via VPN
 */
const isViaVPN: Specification<AccessContext> = spec
  .field<AccessContext>("environment.isVPN" as any)
  .eq(true);

/**
 * Resource has not expired
 */
class ResourceNotExpiredSpec extends BaseSpec<AccessContext> {
  constructor() {
    super("not_expired", {
      meta: { name: "Resource Not Expired" },
    });
  }

  protected evaluate(ctx: AccessContext): boolean {
    if (!ctx.resource.metadata.expiresAt) {
      return true; // No expiration set
    }
    return ctx.environment.timestamp < ctx.resource.metadata.expiresAt;
  }
}

const isNotExpired = new ResourceNotExpiredSpec();

/**
 * User has required certifications for resource
 */
class RequiredCertificationsSpec extends BaseSpec<AccessContext> {
  constructor() {
    super("required_certifications", {
      meta: { name: "Required Certifications" },
    });
  }

  protected evaluate(ctx: AccessContext): boolean {
    if (!ctx.resource.requiredCertifications || ctx.resource.requiredCertifications.length === 0) {
      return true; // No certifications required
    }
    
    return ctx.resource.requiredCertifications.every(cert =>
      ctx.user.certifications.includes(cert)
    );
  }
}

const hasRequiredCertifications = new RequiredCertificationsSpec();

/**
 * User location matches resource allowed locations
 */
class LocationRestrictionSpec extends BaseSpec<AccessContext> {
  constructor() {
    super("location_restriction", {
      meta: { name: "Location Restriction" },
    });
  }

  protected evaluate(ctx: AccessContext): boolean {
    if (!ctx.resource.allowedLocations || ctx.resource.allowedLocations.length === 0) {
      return true; // No location restrictions
    }
    
    return ctx.resource.allowedLocations.includes(ctx.user.location.country);
  }
}

const isInAllowedLocation = new LocationRestrictionSpec();

// ============================================================================
// Access Control Policies
// ============================================================================

/**
 * Base policy: All access requires active user, valid clearance, and non-expired resource
 */
const baseAccessPolicy: Specification<AccessContext> = all(
  isActiveUser,
  hasRequiredClearance,
  isNotExpired
);

/**
 * Policy: Read access to resources
 * 
 * Rules:
 * 1. Base policy must be satisfied
 * 2. User has required certifications
 * 3. User is in allowed location
 * 4. For high/critical sensitivity:
 *    - Must be in same department OR owner
 *    - For contractors: Must also be from office or VPN
 */
const readAccessPolicy: Specification<AccessContext> = all(
  baseAccessPolicy,
  hasRequiredCertifications,
  isInAllowedLocation,
  any(
    // Low/medium sensitivity: only base requirements
    isLowSensitivity,
    isMediumSensitivity,
    // High sensitivity: same department or owner
    all(
      isHighSensitivity,
      any(isInResourceDepartment, isResourceOwner),
      any(isFullTimeEmployee, all(isContractor, any(isFromOffice, isViaVPN)))
    ),
    // Critical sensitivity: stricter requirements
    all(
      isCriticalSensitivity,
      any(isInResourceDepartment, isResourceOwner),
      isFullTimeEmployee,
      any(isFromOffice, isViaVPN),
      isDuringBusinessHours
    )
  )
);

/**
 * Policy: Write access to resources
 * 
 * Rules:
 * 1. Must have read access
 * 2. Must be owner OR (same department AND full-time employee)
 * 3. For critical resources: Must be from office during business hours
 */
const writeAccessPolicy: Specification<AccessContext> = all(
  readAccessPolicy,
  any(
    isResourceOwner,
    all(isInResourceDepartment, isFullTimeEmployee)
  ),
  any(
    isCriticalSensitivity.not(),
    all(isFromOffice, isDuringBusinessHours)
  )
);

/**
 * Policy: Delete access to resources
 * 
 * Rules:
 * 1. Must be resource owner
 * 2. Must be full-time employee
 * 3. Must be from office during business hours
 */
const deleteAccessPolicy: Specification<AccessContext> = all(
  baseAccessPolicy,
  isResourceOwner,
  isFullTimeEmployee,
  isFromOffice,
  isDuringBusinessHours
);

/**
 * Policy: Export access to resources
 * 
 * Rules:
 * 1. Must have read access
 * 2. Must be full-time employee
 * 3. High/critical sensitivity requires specific certifications
 * 4. Must be from office or VPN
 */
const exportAccessPolicy: Specification<AccessContext> = all(
  readAccessPolicy,
  isFullTimeEmployee,
  any(isFromOffice, isViaVPN),
  any(
    all(isHighSensitivity.not(), isCriticalSensitivity.not()),
    hasRequiredCertifications
  )
);

/**
 * Policy: Share access to resources
 * 
 * Rules:
 * 1. Must have write access
 * 2. Must not be critical sensitivity (cannot share critical resources)
 */
const shareAccessPolicy: Specification<AccessContext> = all(
  writeAccessPolicy,
  isCriticalSensitivity.not()
);

// ============================================================================
// Policy Registry
// ============================================================================

const policyRegistry = new Map<Action, Specification<AccessContext>>([
  ["read", readAccessPolicy],
  ["write", writeAccessPolicy],
  ["delete", deleteAccessPolicy],
  ["export", exportAccessPolicy],
  ["share", shareAccessPolicy],
]);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if user can perform action on resource
 */
export async function canAccess(
  user: User,
  resource: Resource,
  action: Action,
  environment: Environment
): Promise<boolean> {
  const policy = policyRegistry.get(action);
  if (!policy) {
    throw new Error(`Unknown action: ${action}`);
  }

  const context: AccessContext = { user, resource, action, environment };
  return await policy.isSatisfiedByAsync!(context);
}

/**
 * Explain access decision
 */
export function explainAccess(
  user: User,
  resource: Resource,
  action: Action,
  environment: Environment
): string {
  const policy = policyRegistry.get(action);
  if (!policy) {
    return `Unknown action: ${action}`;
  }

  const context: AccessContext = { user, resource, action, environment };
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
  // Current environment
  const environment: Environment = {
    timestamp: new Date("2024-12-16T10:30:00Z"), // Monday 10:30 AM UTC (business hours)
    ipAddress: "192.168.1.100",
    deviceType: "desktop",
    isVPN: false,
    location: {
      country: "US",
      office: "San Francisco HQ",
    },
  };

  // Sample users
  const engineer: User = {
    id: "user-001",
    email: "alice@example.com",
    department: "engineering",
    clearanceLevel: 4,
    certifications: ["ISO27001", "SOC2"],
    location: {
      country: "US",
      office: "San Francisco HQ",
      ipAddress: "192.168.1.100",
    },
    employmentType: "full-time",
    isActive: true,
    joinDate: new Date("2022-01-15"),
  };

  const contractor: User = {
    id: "user-002",
    email: "bob@contractor.com",
    department: "engineering",
    clearanceLevel: 3,
    certifications: ["ISO27001"],
    location: {
      country: "US",
      office: "San Francisco HQ",
      ipAddress: "192.168.1.101",
    },
    employmentType: "contractor",
    isActive: true,
    joinDate: new Date("2024-06-01"),
  };

  const financeManager: User = {
    id: "user-003",
    email: "carol@example.com",
    department: "finance",
    clearanceLevel: 5, // Top-secret clearance
    certifications: ["ISO27001", "SOC2", "HIPAA"],
    location: {
      country: "US",
      office: "San Francisco HQ",
      ipAddress: "192.168.1.102",
    },
    employmentType: "full-time",
    isActive: true,
    joinDate: new Date("2020-03-10"),
  };

  // Sample resources
  const publicDoc: Resource = {
    id: "doc-001",
    type: "document",
    classification: "public",
    department: "engineering",
    owner: "user-001",
    sensitivity: "low",
    tags: ["handbook", "onboarding"],
    metadata: {
      createdAt: new Date("2024-01-01"),
      lastModified: new Date("2024-11-01"),
    },
  };

  const confidentialDoc: Resource = {
    id: "doc-002",
    type: "document",
    classification: "confidential",
    department: "engineering",
    owner: "user-001",
    sensitivity: "high",
    tags: ["architecture", "internal"],
    metadata: {
      createdAt: new Date("2024-06-01"),
      lastModified: new Date("2024-12-01"),
    },
    requiredCertifications: ["ISO27001"],
  };

  const topSecretDB: Resource = {
    id: "db-001",
    type: "database",
    classification: "top-secret",
    department: "finance",
    owner: "user-003",
    sensitivity: "critical",
    tags: ["financial", "pii", "regulated"],
    metadata: {
      createdAt: new Date("2023-01-01"),
      lastModified: new Date("2024-12-10"),
    },
    allowedLocations: ["US"],
    requiredCertifications: ["ISO27001", "SOC2", "HIPAA"],
  };

  console.log("=".repeat(70));
  console.log("ABAC Example - Attribute-Based Access Control");
  console.log("=".repeat(70));

  // Test 1: Engineer reads public document
  console.log("\n[Test 1] Engineer reading public document");
  console.log(
    "Result:",
    (await canAccess(engineer, publicDoc, "read", environment)) ? "✓ ALLOWED" : "✗ DENIED"
  );

  // Test 2: Contractor reads confidential document (same dept, has cert)
  console.log("\n[Test 2] Contractor reading confidential document (same dept)");
  console.log(
    "Result:",
    (await canAccess(contractor, confidentialDoc, "read", environment)) ? "✓ ALLOWED" : "✗ DENIED"
  );

  // Test 3: Engineer writes to confidential document (owner)
  console.log("\n[Test 3] Engineer writing to confidential document (owner)");
  console.log(
    "Result:",
    (await canAccess(engineer, confidentialDoc, "write", environment)) ? "✓ ALLOWED" : "✗ DENIED"
  );

  // Test 4: Contractor attempts to write (not owner)
  console.log("\n[Test 4] Contractor writing to confidential document (not owner)");
  console.log(
    "Result:",
    (await canAccess(contractor, confidentialDoc, "write", environment)) ? "✓ ALLOWED" : "✗ DENIED"
  );
  console.log("\nExplanation:");
  console.log(explainAccess(contractor, confidentialDoc, "write", environment));

  // Test 5: Finance manager reads top-secret database
  console.log("\n[Test 5] Finance manager reading top-secret database (owner)");
  console.log(
    "Result:",
    (await canAccess(financeManager, topSecretDB, "read", environment)) ? "✓ ALLOWED" : "✗ DENIED"
  );

  // Test 6: Engineer attempts to read top-secret database (wrong dept, lacks clearance)
  console.log("\n[Test 6] Engineer reading top-secret database (wrong dept)");
  console.log(
    "Result:",
    (await canAccess(engineer, topSecretDB, "read", environment)) ? "✓ ALLOWED" : "✗ DENIED"
  );
  console.log("\nExplanation:");
  console.log(explainAccess(engineer, topSecretDB, "read", environment));

  // Test 7: Engineer exports confidential document
  console.log("\n[Test 7] Engineer exporting confidential document");
  console.log(
    "Result:",
    (await canAccess(engineer, confidentialDoc, "export", environment)) ? "✓ ALLOWED" : "✗ DENIED"
  );

  console.log("\n" + "=".repeat(70));
  console.log("Summary: ABAC policies enforced with fine-grained attribute checks!");
  console.log("=".repeat(70));
}
