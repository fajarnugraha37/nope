/**
 * @fileoverview Feature Flag System Example
 * 
 * This example demonstrates how to build a feature flag/feature toggle system
 * using specifications for user targeting, gradual rollouts, and A/B testing.
 * 
 * Key Concepts:
 * - User targeting rules (email, role, attributes)
 * - Percentage-based rollouts
 * - Environment-based flags
 * - A/B test variant assignment
 * - Feature dependencies
 * 
 * @example
 * ```typescript
 * const canSeeFeature = isFeatureEnabled("new-ui", user, context);
 * const variant = getFeatureVariant("pricing-experiment", user);
 * ```
 */

import { spec, all, any } from "../src/index.js";
import { BaseSpec } from "../src/core/base-spec.js";
import type { Specification } from "../src/core/types.js";

// ============================================================================
// Domain Types
// ============================================================================

type FeatureFlagId = string;
type UserId = string;
type VariantId = string;

/**
 * Feature flag configuration
 */
interface FeatureFlag {
  id: FeatureFlagId;
  name: string;
  description: string;
  enabled: boolean;
  environment: "development" | "staging" | "production";
  rolloutPercentage: number; // 0-100
  targeting: {
    userIds?: UserId[];
    emailDomains?: string[];
    roles?: string[];
    attributes?: Record<string, any>;
  };
  variants?: {
    id: VariantId;
    name: string;
    weight: number; // 0-100, total should be 100
  }[];
  dependencies?: FeatureFlagId[]; // Required flags
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User for feature evaluation
 */
interface User {
  id: UserId;
  email: string;
  role: "admin" | "beta-tester" | "premium" | "free" | "internal";
  plan: "free" | "starter" | "pro" | "enterprise";
  attributes: {
    country?: string;
    company?: string;
    signupDate?: Date;
    isEmployee?: boolean;
  };
  experiments?: {
    [key: string]: VariantId; // Sticky variant assignments
  };
}

/**
 * Evaluation context
 */
interface FeatureContext {
  user: User;
  flag: FeatureFlag;
  environment: string;
  timestamp: Date;
  allFlags?: Map<FeatureFlagId, FeatureFlag>;
}

// ============================================================================
// Basic Flag Specifications
// ============================================================================

/**
 * Flag is globally enabled
 */
const isFlagEnabled: Specification<FeatureContext> = spec
  .field<FeatureContext>("flag.enabled" as any)
  .eq(true);

/**
 * Flag matches current environment
 */
class EnvironmentMatchSpec extends BaseSpec<FeatureContext> {
  constructor() {
    super("environment_match", {
      meta: { name: "Environment Match" },
    });
  }

  protected evaluate(ctx: FeatureContext): boolean {
    return ctx.flag.environment === ctx.environment || ctx.flag.environment === "development";
  }
}

const isEnvironmentMatch = new EnvironmentMatchSpec();

// ============================================================================
// User Targeting Specifications
// ============================================================================

/**
 * User is in targeted user IDs
 */
class TargetedUserSpec extends BaseSpec<FeatureContext> {
  constructor() {
    super("targeted_user", {
      meta: { name: "Targeted User" },
    });
  }

  protected evaluate(ctx: FeatureContext): boolean {
    if (!ctx.flag.targeting.userIds || ctx.flag.targeting.userIds.length === 0) {
      return true; // No targeting = available to all
    }
    return ctx.flag.targeting.userIds.includes(ctx.user.id);
  }
}

const isTargetedUser = new TargetedUserSpec();

/**
 * User email domain matches
 */
class EmailDomainSpec extends BaseSpec<FeatureContext> {
  constructor() {
    super("email_domain", {
      meta: { name: "Email Domain Match" },
    });
  }

  protected evaluate(ctx: FeatureContext): boolean {
    if (!ctx.flag.targeting.emailDomains || ctx.flag.targeting.emailDomains.length === 0) {
      return true; // No domain restriction
    }
    
    const userDomain = ctx.user.email.split("@")[1];
    return ctx.flag.targeting.emailDomains.includes(userDomain);
  }
}

const matchesEmailDomain = new EmailDomainSpec();

/**
 * User role matches
 */
class RoleMatchSpec extends BaseSpec<FeatureContext> {
  constructor() {
    super("role_match", {
      meta: { name: "Role Match" },
    });
  }

  protected evaluate(ctx: FeatureContext): boolean {
    if (!ctx.flag.targeting.roles || ctx.flag.targeting.roles.length === 0) {
      return true; // No role restriction
    }
    return ctx.flag.targeting.roles.includes(ctx.user.role);
  }
}

const matchesRole = new RoleMatchSpec();

/**
 * User attributes match
 */
class AttributeMatchSpec extends BaseSpec<FeatureContext> {
  constructor() {
    super("attribute_match", {
      meta: { name: "Attribute Match" },
    });
  }

  protected evaluate(ctx: FeatureContext): boolean {
    if (!ctx.flag.targeting.attributes || Object.keys(ctx.flag.targeting.attributes).length === 0) {
      return true; // No attribute restrictions
    }

    for (const [key, value] of Object.entries(ctx.flag.targeting.attributes)) {
      const userValue = (ctx.user.attributes as any)[key];
      if (userValue !== value) {
        return false;
      }
    }
    return true;
  }
}

const matchesAttributes = new AttributeMatchSpec();

// ============================================================================
// Rollout Specifications
// ============================================================================

/**
 * User is in rollout percentage
 * Uses consistent hashing to ensure same user always gets same result
 */
class RolloutPercentageSpec extends BaseSpec<FeatureContext> {
  constructor() {
    super("rollout_percentage", {
      meta: { name: "Rollout Percentage" },
    });
  }

  protected evaluate(ctx: FeatureContext): boolean {
    if (ctx.flag.rolloutPercentage >= 100) {
      return true; // 100% rollout
    }
    if (ctx.flag.rolloutPercentage <= 0) {
      return false; // 0% rollout
    }

    // Simple hash function for consistent user bucketing
    const hash = this.hashString(`${ctx.user.id}-${ctx.flag.id}`);
    const bucket = hash % 100;
    return bucket < ctx.flag.rolloutPercentage;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}

const isInRollout = new RolloutPercentageSpec();

// ============================================================================
// Dependency Specifications
// ============================================================================

/**
 * All dependent flags are enabled
 */
class DependenciesMetSpec extends BaseSpec<FeatureContext> {
  constructor() {
    super("dependencies_met", {
      meta: { name: "Dependencies Met" },
    });
  }

  protected evaluate(ctx: FeatureContext): boolean {
    if (!ctx.flag.dependencies || ctx.flag.dependencies.length === 0) {
      return true; // No dependencies
    }

    if (!ctx.allFlags) {
      return false; // Can't evaluate without flag registry
    }

    for (const depId of ctx.flag.dependencies) {
      const depFlag = ctx.allFlags.get(depId);
      if (!depFlag || !depFlag.enabled) {
        return false;
      }
    }
    return true;
  }
}

const hasDependenciesMet = new DependenciesMetSpec();

// ============================================================================
// Role-Based Rules
// ============================================================================

/**
 * Internal users (employees) always get access
 */
const isInternalUser: Specification<FeatureContext> = spec
  .field<FeatureContext>("user.role" as any)
  .eq("internal");

/**
 * Admin users always get access
 */
const isAdminUser: Specification<FeatureContext> = spec
  .field<FeatureContext>("user.role" as any)
  .eq("admin");

/**
 * Beta testers get early access
 */
const isBetaTester: Specification<FeatureContext> = spec
  .field<FeatureContext>("user.role" as any)
  .eq("beta-tester");

/**
 * Premium users get features
 */
const isPremiumUser: Specification<FeatureContext> = any(
  spec.field<FeatureContext>("user.plan" as any).eq("pro"),
  spec.field<FeatureContext>("user.plan" as any).eq("enterprise")
);

// ============================================================================
// Feature Flag Evaluation Policy
// ============================================================================

/**
 * Complete feature flag evaluation policy
 * 
 * Rules:
 * 1. Flag must be enabled
 * 2. Environment must match
 * 3. Dependencies must be met
 * 4. User must pass targeting (OR)
 *    a. Is internal/admin user (always pass)
 *    b. Matches all targeting criteria AND in rollout percentage
 */
const featureFlagPolicy: Specification<FeatureContext> = all(
  isFlagEnabled,
  isEnvironmentMatch,
  hasDependenciesMet,
  any(
    isInternalUser,
    isAdminUser,
    all(
      isTargetedUser,
      matchesEmailDomain,
      matchesRole,
      matchesAttributes,
      isInRollout
    )
  )
);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if feature is enabled for user
 */
export async function isFeatureEnabled(
  flag: FeatureFlag,
  user: User,
  environment: string,
  allFlags?: Map<FeatureFlagId, FeatureFlag>
): Promise<boolean> {
  const context: FeatureContext = {
    user,
    flag,
    environment,
    timestamp: new Date(),
    allFlags,
  };

  return await featureFlagPolicy.isSatisfiedByAsync!(context);
}

/**
 * Get feature variant for A/B testing
 * Returns variant ID or null if feature not enabled
 */
export async function getFeatureVariant(
  flag: FeatureFlag,
  user: User,
  environment: string,
  allFlags?: Map<FeatureFlagId, FeatureFlag>
): Promise<VariantId | null> {
  // Check if feature is enabled first
  const enabled = await isFeatureEnabled(flag, user, environment, allFlags);
  if (!enabled) {
    return null;
  }

  // If no variants, just return "default"
  if (!flag.variants || flag.variants.length === 0) {
    return "default";
  }

  // Check for sticky assignment
  if (user.experiments && user.experiments[flag.id]) {
    return user.experiments[flag.id];
  }

  // Assign variant based on consistent hashing
  const hash = hashString(`${user.id}-${flag.id}-variant`);
  const bucket = hash % 100;

  let cumulative = 0;
  for (const variant of flag.variants) {
    cumulative += variant.weight;
    if (bucket < cumulative) {
      return variant.id;
    }
  }

  return flag.variants[flag.variants.length - 1].id; // Fallback to last variant
}

/**
 * Explain why feature is enabled/disabled
 */
export function explainFeature(
  flag: FeatureFlag,
  user: User,
  environment: string,
  allFlags?: Map<FeatureFlagId, FeatureFlag>
): string {
  const context: FeatureContext = {
    user,
    flag,
    environment,
    timestamp: new Date(),
    allFlags,
  };

  const explanation = featureFlagPolicy.explain(context);

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

// Helper hash function
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// ============================================================================
// Usage Examples
// ============================================================================

if (import.meta.main) {
  (async () => {
    // Sample users
    const internalUser: User = {
      id: "user-internal-1",
      email: "engineer@company.com",
      role: "internal",
      plan: "enterprise",
      attributes: {
        isEmployee: true,
      },
    };

    const betaTester: User = {
      id: "user-beta-1",
      email: "beta@example.com",
      role: "beta-tester",
      plan: "pro",
      attributes: {},
    };

    const premiumUser: User = {
      id: "user-premium-1",
      email: "customer@acme.com",
      role: "premium",
      plan: "pro",
      attributes: {
        company: "Acme Corp",
      },
    };

    const freeUser: User = {
      id: "user-free-1",
      email: "user@gmail.com",
      role: "free",
      plan: "free",
      attributes: {},
    };

    // Sample feature flags
    const newUiFlag: FeatureFlag = {
      id: "new-ui",
      name: "New UI Design",
      description: "Redesigned user interface",
      enabled: true,
      environment: "production",
      rolloutPercentage: 50, // 50% rollout
      targeting: {
        roles: ["beta-tester", "internal"],
      },
      createdAt: new Date("2024-11-01"),
      updatedAt: new Date("2024-11-15"),
    };

    const advancedAnalytics: FeatureFlag = {
      id: "advanced-analytics",
      name: "Advanced Analytics",
      description: "Enhanced analytics dashboard",
      enabled: true,
      environment: "production",
      rolloutPercentage: 100,
      targeting: {
        roles: ["premium", "internal", "admin"],
      },
      createdAt: new Date("2024-10-01"),
      updatedAt: new Date("2024-11-01"),
    };

    const experimentalFeature: FeatureFlag = {
      id: "experimental-api",
      name: "Experimental API",
      description: "New API endpoints",
      enabled: true,
      environment: "staging",
      rolloutPercentage: 100,
      targeting: {},
      createdAt: new Date("2024-11-10"),
      updatedAt: new Date("2024-11-20"),
    };

    const pricingExperiment: FeatureFlag = {
      id: "pricing-test",
      name: "Pricing Page A/B Test",
      description: "Testing different pricing layouts",
      enabled: true,
      environment: "production",
      rolloutPercentage: 100,
      targeting: {},
      variants: [
        { id: "control", name: "Original Pricing", weight: 50 },
        { id: "variant-a", name: "Simplified Pricing", weight: 25 },
        { id: "variant-b", name: "Feature Comparison", weight: 25 },
      ],
      createdAt: new Date("2024-11-01"),
      updatedAt: new Date("2024-11-15"),
    };

    const dependentFeature: FeatureFlag = {
      id: "premium-export",
      name: "Premium Export",
      description: "Export with advanced analytics",
      enabled: true,
      environment: "production",
      rolloutPercentage: 100,
      targeting: {},
      dependencies: ["advanced-analytics"],
      createdAt: new Date("2024-11-01"),
      updatedAt: new Date("2024-11-15"),
    };

    const flagRegistry = new Map<FeatureFlagId, FeatureFlag>([
      ["new-ui", newUiFlag],
      ["advanced-analytics", advancedAnalytics],
      ["experimental-api", experimentalFeature],
      ["pricing-test", pricingExperiment],
      ["premium-export", dependentFeature],
    ]);

    console.log("=".repeat(70));
    console.log("Feature Flag System Example");
    console.log("=".repeat(70));

    // Test 1: Internal user gets all features
    console.log("\n[Test 1] Internal user - always gets access");
    console.log("New UI:", (await isFeatureEnabled(newUiFlag, internalUser, "production")) ? "✓" : "✗");
    console.log("Advanced Analytics:", (await isFeatureEnabled(advancedAnalytics, internalUser, "production")) ? "✓" : "✗");

    // Test 2: Beta tester with role targeting
    console.log("\n[Test 2] Beta tester - role-based targeting");
    console.log("New UI:", (await isFeatureEnabled(newUiFlag, betaTester, "production")) ? "✓" : "✗");
    console.log("Advanced Analytics:", (await isFeatureEnabled(advancedAnalytics, betaTester, "production")) ? "✓" : "✗ (not premium)");

    // Test 3: Premium user gets premium features
    console.log("\n[Test 3] Premium user - plan-based access");
    console.log("Advanced Analytics:", (await isFeatureEnabled(advancedAnalytics, premiumUser, "production")) ? "✓" : "✗");

    // Test 4: Free user limited access
    console.log("\n[Test 4] Free user - limited by targeting and rollout");
    console.log("New UI (50% rollout):", (await isFeatureEnabled(newUiFlag, freeUser, "production")) ? "✓" : "✗");
    console.log("Advanced Analytics:", (await isFeatureEnabled(advancedAnalytics, freeUser, "production")) ? "✓" : "✗ (not premium)");

    // Test 5: Environment gating
    console.log("\n[Test 5] Environment gating - experimental feature");
    console.log("In production:", (await isFeatureEnabled(experimentalFeature, internalUser, "production")) ? "✓" : "✗");
    console.log("In staging:", (await isFeatureEnabled(experimentalFeature, internalUser, "staging")) ? "✓" : "✗");

    // Test 6: A/B test variants
    console.log("\n[Test 6] A/B Test variant assignment");
    const variant1 = await getFeatureVariant(pricingExperiment, premiumUser, "production");
    const variant2 = await getFeatureVariant(pricingExperiment, freeUser, "production");
    console.log(`Premium user gets: ${variant1}`);
    console.log(`Free user gets: ${variant2}`);

    // Test 7: Feature dependencies
    console.log("\n[Test 7] Feature dependencies");
    console.log("Premium export (requires analytics):", 
      (await isFeatureEnabled(dependentFeature, premiumUser, "production", flagRegistry)) ? "✓" : "✗");
    console.log("Premium export for free user:", 
      (await isFeatureEnabled(dependentFeature, freeUser, "production", flagRegistry)) ? "✓" : "✗");

    // Test 8: Explanation
    console.log("\n[Test 8] Feature explanation - why free user can't get analytics");
    console.log(explainFeature(advancedAnalytics, freeUser, "production"));

    console.log("\n" + "=".repeat(70));
    console.log("Summary: Feature flags enable controlled rollouts and experimentation!");
    console.log("=".repeat(70));
  })();
}
