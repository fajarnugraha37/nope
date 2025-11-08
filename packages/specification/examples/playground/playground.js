/**
 * Specification Pattern Playground
 * 
 * This is a mock implementation for demonstration purposes.
 * In a real deployment, this would:
 * 1. Import the actual specification package
 * 2. Use a bundler (webpack/vite) to create browser bundle
 * 3. Run actual evaluation and compilation
 * 
 * For now, it simulates the behavior to show the UI/UX.
 */

// Example specifications
const examples = {
    simple: {
        code: `// Simple field comparison
const spec = spec.field("user.age").gte(18);

// Evaluate
const result = spec.isSatisfiedBy(testData);`,
        data: {
            user: {
                age: 25,
                name: "Alice",
                role: "user"
            }
        }
    },
    composite: {
        code: `// Composite specification with AND/OR
const isAdult = spec.field("user.age").gte(18);
const isActive = spec.field("user.isActive").eq(true);
const hasPermission = spec.field("user.permissions")
    .contains("read");

const canAccess = all(
    isAdult,
    any(isActive, hasPermission)
);

const result = canAccess.isSatisfiedBy(testData);`,
        data: {
            user: {
                age: 25,
                isActive: true,
                permissions: ["read", "write"]
            }
        }
    },
    rbac: {
        code: `// Role-Based Access Control
const isAdmin = spec.field("user.roles")
    .contains("admin");
const isOwner = spec.field("user.id")
    .eq(spec.field("resource.ownerId"));
const isPublic = spec.field("resource.visibility")
    .eq("public");

const canView = any(
    isAdmin,
    isOwner,
    isPublic
);

const result = canView.isSatisfiedBy(testData);`,
        data: {
            user: {
                id: "user-123",
                roles: ["user"],
                name: "Bob"
            },
            resource: {
                id: "doc-456",
                ownerId: "user-123",
                visibility: "private"
            }
        }
    },
    abac: {
        code: `// Attribute-Based Access Control
const hasClearance = spec.field("user.clearanceLevel")
    .gte(3);
const inDepartment = spec.field("user.department")
    .eq(spec.field("resource.department"));
const duringBusinessHours = spec.field("context.hour")
    .gte(8).and(spec.field("context.hour").lt(18));

const canAccess = all(
    hasClearance,
    inDepartment,
    duringBusinessHours
);

const result = canAccess.isSatisfiedBy(testData);`,
        data: {
            user: {
                clearanceLevel: 4,
                department: "engineering"
            },
            resource: {
                department: "engineering",
                classification: "confidential"
            },
            context: {
                hour: 14,
                location: "office"
            }
        }
    }
};

// Load example
function loadExample(name) {
    const example = examples[name];
    if (example) {
        document.getElementById('specCode').value = example.code;
        document.getElementById('testData').value = JSON.stringify(example.data, null, 2);
        output('info', `Loaded ${name} example`);
    }
}

// Switch tabs
function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(`${tabName}-tab`).classList.add('active');
    event.target.classList.add('active');
}

// Output helper
function output(type, message) {
    const outputDiv = document.getElementById('output');
    const className = type === 'success' ? 'success' : type === 'error' ? 'error' : 'info';
    outputDiv.innerHTML = `<span class="${className}">${message}</span>`;
}

// Evaluate specification
function evaluateSpec() {
    const code = document.getElementById('specCode').value;
    const dataStr = document.getElementById('testData').value;
    
    if (!code) {
        output('error', '❌ Please enter specification code');
        return;
    }
    
    if (!dataStr) {
        output('error', '❌ Please enter test data');
        return;
    }
    
    try {
        const data = JSON.parse(dataStr);
        
        // Simulate evaluation (in real app, would actually evaluate)
        // For demo, we'll parse the code to guess the result
        const likelyPass = code.includes('any') || code.includes('isPublic') || 
                           code.includes('isActive') || data.user?.age >= 18;
        
        const result = likelyPass;
        
        if (result) {
            output('success', `✅ Specification SATISFIED\n\nThe test data matches all specified conditions.`);
        } else {
            output('error', `❌ Specification NOT SATISFIED\n\nThe test data does not match the specified conditions.`);
        }
    } catch (e) {
        output('error', `❌ Error: ${e.message}`);
    }
}

// Convert to AST
function toAst() {
    const code = document.getElementById('specCode').value;
    
    if (!code) {
        document.getElementById('astOutput').textContent = 'Please enter specification code first';
        return;
    }
    
    // Simulate AST generation
    const mockAst = {
        kind: "composite",
        operator: "and",
        specs: [
            {
                kind: "field",
                path: "user.age",
                operator: "gte",
                value: 18
            },
            {
                kind: "composite",
                operator: "or",
                specs: [
                    {
                        kind: "field",
                        path: "user.isActive",
                        operator: "eq",
                        value: true
                    },
                    {
                        kind: "field",
                        path: "user.permissions",
                        operator: "contains",
                        value: "read"
                    }
                ]
            }
        ]
    };
    
    document.getElementById('astOutput').textContent = JSON.stringify(mockAst, null, 2);
    switchTab('ast');
    output('success', '✅ AST generated successfully');
}

// Load from AST
function fromAst() {
    const astStr = document.getElementById('astOutput').textContent;
    
    try {
        const ast = JSON.parse(astStr);
        output('success', `✅ Specification loaded from AST\n\nOperator: ${ast.operator}\nSpecs: ${ast.specs?.length || 1}`);
    } catch (e) {
        output('error', `❌ Invalid AST JSON: ${e.message}`);
    }
}

// Explain specification
function explainSpec() {
    const code = document.getElementById('specCode').value;
    const dataStr = document.getElementById('testData').value;
    
    if (!code || !dataStr) {
        output('error', '❌ Please enter both specification code and test data');
        return;
    }
    
    try {
        const data = JSON.parse(dataStr);
        
        // Simulate explain tree
        const explainTree = `
<span class="tree-pass">✓ spec_1 (AND composite)</span>
  <span class="tree-pass">✓ spec_2 (field: user.age >= 18)</span>
    Reason: 25 >= 18
  <span class="tree-pass">✓ spec_3 (OR composite)</span>
    <span class="tree-pass">✓ spec_4 (field: user.isActive == true)</span>
      Reason: true == true
    <span class="tree-pass">✓ spec_5 (field: user.permissions contains "read")</span>
      Reason: ["read", "write"] contains "read"

<span class="success">Result: SATISFIED</span>
Duration: 1.23ms
`;
        
        document.getElementById('explainOutput').innerHTML = explainTree;
        switchTab('explain');
        output('success', '✅ Explain tree generated');
    } catch (e) {
        output('error', `❌ Error: ${e.message}`);
    }
}

// Generate adapter queries
window.addEventListener('DOMContentLoaded', () => {
    // Simulate adapter output
    const prismaExample = {
        AND: [
            { age: { gte: 18 } },
            {
                OR: [
                    { isActive: { equals: true } },
                    { permissions: { has: "read" } }
                ]
            }
        ]
    };
    
    const mongoExample = {
        $and: [
            { "user.age": { $gte: 18 } },
            {
                $or: [
                    { "user.isActive": { $eq: true } },
                    { "user.permissions": { $in: ["read"] } }
                ]
            }
        ]
    };
    
    document.getElementById('prismaOutput').textContent = JSON.stringify(prismaExample, null, 2);
    document.getElementById('mongoOutput').textContent = JSON.stringify(mongoExample, null, 2);
});

// Format JSON
function formatJson() {
    const dataStr = document.getElementById('testData').value;
    try {
        const data = JSON.parse(dataStr);
        document.getElementById('testData').value = JSON.stringify(data, null, 2);
        output('success', '✅ JSON formatted');
    } catch (e) {
        output('error', `❌ Invalid JSON: ${e.message}`);
    }
}

// Clear data
function clearData() {
    document.getElementById('testData').value = '';
    output('info', 'Test data cleared');
}

// Copy AST
function copyAst() {
    const ast = document.getElementById('astOutput').textContent;
    navigator.clipboard.writeText(ast).then(() => {
        output('success', '✅ AST copied to clipboard');
    });
}

// Download AST
function downloadAst() {
    const ast = document.getElementById('astOutput').textContent;
    const blob = new Blob([ast], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'specification-ast.json';
    a.click();
    output('success', '✅ AST downloaded');
}

// Load initial example
window.addEventListener('DOMContentLoaded', () => {
    loadExample('simple');
});
