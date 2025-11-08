# 🎯 Specification Pattern Playground - Quick Start

## What is this?

An **interactive web application** that lets you:
- ✍️ Write specifications using the fluent DSL
- 🧪 Test them with JSON data in real-time
- 🔄 Export/import specifications as JSON AST
- 💡 Visualize evaluation logic with explain trees
- 🗄️ Preview database queries (Prisma/MongoDB)

## How to run it?

### Option 1: Python HTTP Server (Easiest)
```bash
cd examples/playground
python -m http.server 8080
```
Then open: http://localhost:8080

### Option 2: Node.js Server
```bash
cd examples/playground
npx serve .
```

### Option 3: Direct File
Just double-click `index.html` or drag it into your browser!

## What can I do?

1. **Try Examples**: Click pre-loaded examples (Simple, Composite, RBAC, ABAC)
2. **Edit Code**: Modify the specification in the left panel
3. **Add Test Data**: Enter JSON test data in the right panel
4. **Evaluate**: Click "Evaluate" to see if data satisfies the spec
5. **View AST**: Switch to AST tab to see JSON representation
6. **Explain**: Check explain tab for detailed evaluation tree
7. **Adapters**: See how specs compile to Prisma/MongoDB queries

## Quick Examples

### Simple Field Check
```typescript
const spec = spec.field("user.age").gte(18);
```

### Composite Logic
```typescript
const canAccess = all(
    spec.field("user.age").gte(18),
    any(
        spec.field("user.isActive").eq(true),
        spec.field("user.permissions").contains("read")
    )
);
```

### RBAC Pattern
```typescript
const canView = any(
    spec.field("user.roles").contains("admin"),
    spec.field("user.id").eq(spec.field("resource.ownerId"))
);
```

## Features Demonstrated

✅ **Live Evaluation** - Test specs with custom data
✅ **AST Serialization** - Load/save as JSON
✅ **Explain Trees** - Visual debugging of logic
✅ **Adapter Preview** - See database queries
✅ **Examples Library** - Pre-loaded patterns
✅ **JSON Formatting** - Auto-format test data

## Current Status

⚠️ **Note**: This is a **demonstration/mock** showing the UI/UX.

For production use, you would:
1. Bundle the actual specification package
2. Add Monaco Editor for better code editing
3. Implement real evaluation (currently simulated)
4. Add Web Worker for safe code execution
5. Deploy to GitHub Pages/Netlify/Vercel

See `examples/playground/README.md` for full implementation guide.

## Files

- `index.html` - Main application (HTML + CSS)
- `playground.js` - Interactive functionality (mock implementation)
- `README.md` - Detailed documentation

## Next Steps

Want to make it production-ready?
1. Import actual specification package
2. Replace mock functions with real evaluation
3. Add syntax highlighting (Monaco Editor)
4. Sandbox execution (Web Workers)
5. Deploy online

## Questions?

See the full README: `examples/playground/README.md`
