/**
 * Database Persistence Example
 * 
 * This example demonstrates how to:
 * 1. Convert specifications to JSON AST
 * 2. Store AST in a database
 * 3. Load AST from database
 * 4. Reconstruct specifications from AST
 * 5. Use reconstructed specs for evaluation
 * 
 * Perfect for:
 * - Dynamic policy systems
 * - User-defined rules
 * - Configuration-driven access control
 * - Policy versioning and audit
 */

import { spec } from '../src/dsl/spec-builder.js';
import { toAst, fromAst } from '../src/ast/serializer.js';
import { createRegistry } from '../src/core/registry.js';
import { builtInOperators } from '../src/ops/builtins.js';
import { all, any } from '../src/core/combinators.js';

// ============================================================================
// Domain Types
// ============================================================================

interface User {
    id: string;
    email: string;
    age: number;
    roles: string[];
    department: string;
    plan: 'free' | 'pro' | 'enterprise';
}

interface Policy {
    id: string;
    name: string;
    description: string;
    astJson: string;  // Stored as JSON string in database
    createdAt: Date;
    updatedAt: Date;
    version: number;
}

// ============================================================================
// Mock Database (in real app, this would be PostgreSQL/MongoDB/etc)
// ============================================================================

class PolicyDatabase {
    private policies: Map<string, Policy> = new Map();

    async save(policy: Policy): Promise<void> {
        this.policies.set(policy.id, { ...policy, updatedAt: new Date() });
        console.log(`[DB] Saved policy: ${policy.id}`);
    }

    async findById(id: string): Promise<Policy | null> {
        const policy = this.policies.get(id);
        console.log(`[DB] Loaded policy: ${id}${policy ? '' : ' (not found)'}`);
        return policy || null;
    }

    async findAll(): Promise<Policy[]> {
        return Array.from(this.policies.values());
    }

    async delete(id: string): Promise<boolean> {
        const deleted = this.policies.delete(id);
        console.log(`[DB] Deleted policy: ${id}${deleted ? '' : ' (not found)'}`);
        return deleted;
    }
}

// ============================================================================
// Policy Service - Business Logic Layer
// ============================================================================

class PolicyService {
    private db: PolicyDatabase;
    private registry;

    constructor() {
        this.db = new PolicyDatabase();
        this.registry = createRegistry({ operators: builtInOperators });
    }

    /**
     * Create and persist a policy from a specification
     */
    async createPolicy(
        id: string,
        name: string,
        description: string,
        specFactory: () => any
    ): Promise<Policy> {
        const specification = specFactory();
        const ast = toAst(specification);
        
        const policy: Policy = {
            id,
            name,
            description,
            astJson: JSON.stringify(ast, null, 2),
            createdAt: new Date(),
            updatedAt: new Date(),
            version: 1
        };

        await this.db.save(policy);
        return policy;
    }

    /**
     * Load a policy and reconstruct the specification
     */
    async loadPolicy(id: string): Promise<{ policy: Policy; spec: any } | null> {
        const policy = await this.db.findById(id);
        if (!policy) return null;

        const ast = JSON.parse(policy.astJson);
        const specification = fromAst<User, {}>(ast, this.registry);

        return { policy, spec: specification };
    }

    /**
     * Update an existing policy with a new specification
     */
    async updatePolicy(
        id: string,
        specFactory: () => any
    ): Promise<Policy | null> {
        const existing = await this.db.findById(id);
        if (!existing) return null;

        const specification = specFactory();
        const ast = toAst(specification);

        existing.astJson = JSON.stringify(ast, null, 2);
        existing.version += 1;
        await this.db.save(existing);

        return existing;
    }

    /**
     * Evaluate a user against a stored policy
     */
    async evaluateUser(policyId: string, user: User): Promise<boolean> {
        const result = await this.loadPolicy(policyId);
        if (!result) {
            throw new Error(`Policy not found: ${policyId}`);
        }

        return await result.spec.isSatisfiedByAsync(user);
    }

    /**
     * List all policies
     */
    async listPolicies(): Promise<Policy[]> {
        return await this.db.findAll();
    }
}

// ============================================================================
// Example Usage
// ============================================================================

(async () => {
    console.log('='.repeat(70));
    console.log('Specification Pattern - Database Persistence Example');
    console.log('='.repeat(70));

    const service = new PolicyService();

    // ========================================================================
    // Step 1: Create and store policies
    // ========================================================================

    console.log('\n[Step 1] Creating and storing policies...\n');

    // Policy 1: Adult users only
    await service.createPolicy(
        'policy-adult',
        'Adult Users Policy',
        'Users must be 18 or older',
        () => spec.field<User>('age' as any).gte(18)
    );

    // Policy 2: Premium users (pro or enterprise)
    await service.createPolicy(
        'policy-premium',
        'Premium Users Policy',
        'Users on pro or enterprise plans',
        () => spec.field<User>('plan' as any).in(['pro', 'enterprise'])
    );

    // Policy 3: Admin access (complex composite)
    await service.createPolicy(
        'policy-admin-access',
        'Admin Access Policy',
        'Admin role OR (age >= 21 AND pro plan)',
        () => any(
            spec.field<User>('roles' as any).contains('admin'),
            all(
                spec.field<User>('age' as any).gte(21),
                spec.field<User>('plan' as any).eq('pro')
            )
        )
    );

    // Policy 4: Engineering department with senior level
    await service.createPolicy(
        'policy-engineering-senior',
        'Senior Engineering Policy',
        'Engineering department members who are senior',
        () => all(
            spec.field<User>('department' as any).eq('engineering'),
            spec.field<User>('roles' as any).contains('senior')
        )
    );

    // ========================================================================
    // Step 2: View stored AST JSON
    // ========================================================================

    console.log('\n[Step 2] Viewing stored AST JSON...\n');

    const policies = await service.listPolicies();
    console.log(`Total policies in database: ${policies.length}\n`);

    for (const policy of policies.slice(0, 2)) {
        console.log(`Policy: ${policy.name}`);
        console.log(`Description: ${policy.description}`);
        console.log('AST JSON:');
        console.log(policy.astJson);
        console.log('');
    }

    // ========================================================================
    // Step 3: Load policies and evaluate users
    // ========================================================================

    console.log('\n[Step 3] Loading policies and evaluating users...\n');

    const testUsers: User[] = [
        {
            id: 'user-1',
            email: 'alice@example.com',
            age: 25,
            roles: ['admin', 'user'],
            department: 'engineering',
            plan: 'enterprise'
        },
        {
            id: 'user-2',
            email: 'bob@example.com',
            age: 17,
            roles: ['user'],
            department: 'marketing',
            plan: 'free'
        },
        {
            id: 'user-3',
            email: 'charlie@example.com',
            age: 22,
            roles: ['user'],
            department: 'engineering',
            plan: 'pro'
        },
        {
            id: 'user-4',
            email: 'diana@example.com',
            age: 30,
            roles: ['senior', 'user'],
            department: 'engineering',
            plan: 'enterprise'
        }
    ];

    for (const user of testUsers) {
        console.log(`User: ${user.email} (age: ${user.age}, plan: ${user.plan}, roles: ${user.roles.join(', ')})`);
        
        for (const policy of policies) {
            const allowed = await service.evaluateUser(policy.id, user);
            const emoji = allowed ? '✓' : '✗';
            console.log(`  ${emoji} ${policy.name}: ${allowed ? 'PASS' : 'FAIL'}`);
        }
        
        console.log('');
    }

    // ========================================================================
    // Step 4: Update a policy
    // ========================================================================

    console.log('\n[Step 4] Updating a policy...\n');

    console.log('Before update: Adult policy requires age >= 18');
    
    await service.updatePolicy(
        'policy-adult',
        () => spec.field<User>('age' as any).gte(21)  // Change to 21
    );

    const updated = await service.loadPolicy('policy-adult');
    console.log('After update: Adult policy requires age >= 21');
    console.log(`Version: ${updated?.policy.version}\n`);

    // Re-evaluate users with updated policy
    console.log('Re-evaluating users with updated policy:');
    for (const user of testUsers.slice(0, 2)) {
        const allowed = await service.evaluateUser('policy-adult', user);
        const emoji = allowed ? '✓' : '✗';
        console.log(`  ${emoji} ${user.email} (age: ${user.age}): ${allowed ? 'PASS' : 'FAIL'}`);
    }

    // ========================================================================
    // Step 5: Complex policy with nested conditions
    // ========================================================================

    console.log('\n[Step 5] Creating complex nested policy...\n');

    await service.createPolicy(
        'policy-feature-access',
        'Advanced Feature Access',
        'Complex multi-condition access control',
        () => all(
            spec.field<User>('age' as any).gte(18),
            any(
                spec.field<User>('plan' as any).eq('enterprise'),
                all(
                    spec.field<User>('plan' as any).eq('pro'),
                    spec.field<User>('roles' as any).contains('beta-tester')
                )
            )
        )
    );

    const complexPolicy = await service.loadPolicy('policy-feature-access');
    console.log('Complex Policy AST:');
    console.log(complexPolicy?.policy.astJson);

    // ========================================================================
    // Step 6: JSON round-trip demonstration
    // ========================================================================

    console.log('\n[Step 6] JSON round-trip demonstration...\n');

    // Create a specification
    const originalSpec = all(
        spec.field<User>('age' as any).gte(18),
        spec.field<User>('roles' as any).contains('verified')
    );

    // Convert to AST
    const ast = toAst(originalSpec);
    console.log('Original AST:');
    console.log(JSON.stringify(ast, null, 2));

    // Simulate database storage (JSON string)
    const jsonString = JSON.stringify(ast);
    console.log(`\nJSON string length: ${jsonString.length} bytes`);

    // Simulate loading from database
    const loadedAst = JSON.parse(jsonString);
    
    // Reconstruct specification
    const registry = createRegistry({ operators: builtInOperators });
    const reconstructedSpec = fromAst<User, {}>(loadedAst, registry);

    // Verify behavior is preserved
    const testUser: User = {
        id: 'test-1',
        email: 'test@example.com',
        age: 25,
        roles: ['verified', 'user'],
        department: 'engineering',
        plan: 'pro'
    };

    const originalResult = await originalSpec.isSatisfiedByAsync!(testUser);
    const reconstructedResult = await reconstructedSpec.isSatisfiedByAsync!(testUser);

    console.log(`\nOriginal spec result: ${originalResult}`);
    console.log(`Reconstructed spec result: ${reconstructedResult}`);
    console.log(`Behavior preserved: ${originalResult === reconstructedResult ? '✓ YES' : '✗ NO'}`);

    // ========================================================================
    // Summary
    // ========================================================================

    console.log('\n' + '='.repeat(70));
    console.log('Summary');
    console.log('='.repeat(70));
    console.log(`
✓ Specifications can be converted to JSON AST using toAst()
✓ AST can be stored as JSON string in any database (SQL, NoSQL, etc)
✓ Specifications can be reconstructed from AST using fromAst()
✓ Reconstructed specs behave identically to original specs
✓ Policies can be versioned, updated, and audited
✓ Complex nested specifications are fully supported
✓ Perfect for dynamic policy systems and user-defined rules

Use Cases:
- User-defined business rules
- Dynamic access control policies
- Feature flag configurations
- Multi-tenant policy isolation
- Policy versioning and rollback
- Audit trails and compliance
- A/B testing configurations
- Workflow automation rules
    `);
})();

// ============================================================================
// Integration Examples
// ============================================================================

/**
 * Example 1: PostgreSQL Integration
 */
/*
CREATE TABLE policies (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    ast_json JSONB NOT NULL,  -- PostgreSQL JSONB for efficient querying
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    version INTEGER DEFAULT 1
);

-- Query policies with specific operators
SELECT * FROM policies 
WHERE ast_json->'type' = '"op"' 
AND ast_json->'kind' = '"gte"';

// TypeScript with pg
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function savePolicy(policy: Policy): Promise<void> {
    await pool.query(
        'INSERT INTO policies (id, name, description, ast_json, version) VALUES ($1, $2, $3, $4, $5)',
        [policy.id, policy.name, policy.description, policy.astJson, policy.version]
    );
}

async function loadPolicy(id: string): Promise<Policy | null> {
    const result = await pool.query(
        'SELECT * FROM policies WHERE id = $1',
        [id]
    );
    return result.rows[0] || null;
}
*/

/**
 * Example 2: MongoDB Integration
 */
/*
// MongoDB Schema
{
    _id: ObjectId,
    id: String,
    name: String,
    description: String,
    ast: {  // Store as nested object, not string
        type: String,
        kind: String,
        input: Object
    },
    createdAt: Date,
    updatedAt: Date,
    version: Number
}

// TypeScript with mongoose
import mongoose from 'mongoose';

const PolicySchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: String,
    ast: { type: Object, required: true },  // Store as object
    version: { type: Number, default: 1 }
}, { timestamps: true });

const PolicyModel = mongoose.model('Policy', PolicySchema);

async function savePolicy(policy: Policy): Promise<void> {
    const ast = JSON.parse(policy.astJson);
    await PolicyModel.create({
        id: policy.id,
        name: policy.name,
        description: policy.description,
        ast: ast,  // Store as object
        version: policy.version
    });
}

async function loadPolicy(id: string): Promise<Policy | null> {
    const doc = await PolicyModel.findOne({ id });
    if (!doc) return null;
    
    return {
        id: doc.id,
        name: doc.name,
        description: doc.description,
        astJson: JSON.stringify(doc.ast),  // Convert back to string
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        version: doc.version
    };
}

// Query policies by operator kind
await PolicyModel.find({ 'ast.kind': 'gte' });
*/

/**
 * Example 3: Redis Caching Layer
 */
/*
import { createClient } from 'redis';

const redis = createClient({ url: process.env.REDIS_URL });

async function getCachedPolicy(id: string): Promise<string | null> {
    return await redis.get(`policy:${id}`);
}

async function cachePolicy(id: string, astJson: string, ttl: number = 3600): Promise<void> {
    await redis.setEx(`policy:${id}`, ttl, astJson);
}

async function loadPolicyWithCache(id: string): Promise<Policy | null> {
    // Try cache first
    const cached = await getCachedPolicy(id);
    if (cached) {
        console.log('[Cache Hit]');
        return { id, astJson: cached } as Policy;
    }
    
    // Load from database
    const policy = await loadPolicyFromDB(id);
    if (policy) {
        await cachePolicy(id, policy.astJson);
    }
    
    return policy;
}
*/
