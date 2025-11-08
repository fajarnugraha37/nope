# Specification Pattern Playground

An interactive web-based playground for exploring the specification pattern. This demo showcases all key features including evaluation, AST serialization, explain trees, and database adapter compilation.

## Features

### 🎯 Interactive Specification Builder
- Write specifications using the fluent DSL
- Pre-loaded examples (Simple, Composite, RBAC, ABAC)
- Real-time syntax highlighting
- Format JSON test data

### 🔄 AST Serialization
- Convert specifications to JSON AST
- Load specifications from AST
- Download/copy AST for sharing
- Full round-trip support

### 💡 Explain Trees
- Visual tree showing evaluation steps
- Pass/fail status for each node
- Detailed reasons for each check
- Performance timing information

### 🗄️ Database Adapters
- Preview Prisma WHERE clauses
- Preview MongoDB query objects
- See how specifications compile to queries
- Compare different adapter outputs

### 🧪 Live Evaluation
- Test specifications with custom data
- Immediate feedback on results
- JSON validation and formatting
- Multiple test scenarios

## Usage

### Running Locally

Since this is a static HTML application, you can run it in several ways:

#### Option 1: Simple HTTP Server (Recommended)

```bash
# Using Python
cd examples/playground
python -m http.server 8080

# Using Node.js
npx serve .

# Using Bun
bun --hot playground.js
```

Then open http://localhost:8080 in your browser.

#### Option 2: Direct File Opening

Simply open `index.html` in your browser. Note: Some features may be limited due to CORS restrictions.

#### Option 3: Bun Dev Server

```bash
# From the specification package directory
cd packages/specification
bun run playground
```

### Using the Playground

1. **Select an Example**: Click one of the example buttons to load pre-configured specifications
2. **Edit the Code**: Modify the specification code in the left panel
3. **Provide Test Data**: Enter JSON test data in the right panel
4. **Evaluate**: Click "Evaluate" to test if the data satisfies the specification
5. **Explore AST**: Switch to the AST tab to see the JSON representation
6. **View Explain**: Check the Explain tab for detailed evaluation steps
7. **Check Adapters**: See how the spec compiles to Prisma/MongoDB queries

## Examples

### Simple Field Check
```typescript
const spec = spec.field("user.age").gte(18);
```

### Composite Specification
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
    spec.field("user.id").eq(spec.field("resource.ownerId")),
    spec.field("resource.visibility").eq("public")
);
```

### ABAC Pattern
```typescript
const canAccess = all(
    spec.field("user.clearanceLevel").gte(3),
    spec.field("user.department").eq(spec.field("resource.department")),
    spec.field("context.hour").gte(8).and(spec.field("context.hour").lt(18))
);
```

## Architecture

### Current Implementation

This playground is a **demonstration/mock** showing the UI and UX. It simulates:
- Specification evaluation
- AST generation
- Explain tree rendering
- Adapter compilation

### Production Implementation

For a full production implementation, you would:

1. **Bundle the Package**: Use webpack/vite to create a browser bundle
   ```javascript
   import { spec, all, any } from '@fajarnugraha37/specification';
   import { toPrismaWhere } from '@fajarnugraha37/specification/adapters/prisma';
   import { toMongoQuery } from '@fajarnugraha37/specification/adapters/mongo';
   ```

2. **Add Code Editor**: Integrate Monaco Editor or CodeMirror for syntax highlighting
   ```html
   <script src="https://cdn.jsdelivr.net/npm/monaco-editor"></script>
   ```

3. **Implement Real Evaluation**: Replace mock functions with actual evaluation
   ```javascript
   async function evaluateSpec() {
       const specInstance = eval(specCode); // Or use safer evaluation
       const result = await specInstance.isSatisfiedByAsync(testData);
       const explanation = specInstance.explain(testData);
       // ...
   }
   ```

4. **Add Safety**: Sandbox code execution using Web Workers or iframe
   ```javascript
   const worker = new Worker('evaluation-worker.js');
   worker.postMessage({ code: specCode, data: testData });
   ```

5. **Deploy**: Host on GitHub Pages, Netlify, or Vercel
   ```bash
   # Example with Vercel
   vercel deploy
   ```

## File Structure

```
playground/
├── index.html          # Main HTML with layout and styles
├── playground.js       # JavaScript for interactivity (mock implementation)
└── README.md          # This file
```

## Extending the Playground

### Adding New Examples

Edit `playground.js` and add to the `examples` object:

```javascript
const examples = {
    // ... existing examples
    myExample: {
        code: `// Your specification code here`,
        data: {
            // Your test data here
        }
    }
};
```

Then add a button in `index.html`:
```html
<button class="example-btn" onclick="loadExample('myExample')">My Example</button>
```

### Adding New Features

1. **Add Tab**: Add a new tab in the HTML and implement the switch logic
2. **Add Output Panel**: Create a new output div with appropriate styling
3. **Add Handlers**: Implement the feature in `playground.js`
4. **Connect UI**: Wire up buttons and event listeners

### Styling Customization

Edit the `<style>` section in `index.html` to customize:
- Colors (change gradient values)
- Layout (modify grid template)
- Fonts (change font-family)
- Spacing (adjust padding/margin)

## Browser Compatibility

- **Chrome/Edge**: Full support
- **Firefox**: Full support
- **Safari**: Full support (iOS 12+)
- **IE11**: Not supported (requires modern ES6+ features)

## Performance

The playground is lightweight:
- **HTML**: ~10 KB
- **JS**: ~6 KB
- **Total**: ~16 KB (uncompressed)
- **Load Time**: < 100ms on 3G

## Security Considerations

⚠️ **Important**: The current implementation uses `eval()` for demonstration purposes. For production:

1. **Never eval user input directly** - Use a safer evaluation method
2. **Sanitize inputs** - Validate all JSON and code inputs
3. **Use Content Security Policy** - Restrict script execution
4. **Implement rate limiting** - Prevent abuse
5. **Add authentication** - If needed for your use case

## Future Enhancements

Potential improvements for a production version:

- [ ] Monaco Editor integration for better code editing
- [ ] Syntax highlighting for specifications
- [ ] Autocomplete for DSL methods
- [ ] Share functionality (save specs to URL)
- [ ] Import/export specification libraries
- [ ] Performance profiling tools
- [ ] Visual query builder (drag-and-drop)
- [ ] Test suite generator
- [ ] Code generation for different languages
- [ ] Integration with CI/CD pipelines

## Contributing

This playground is part of the `@fajarnugraha37/specification` package. To contribute:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see the main package LICENSE file for details.

## Related Resources

- [Main Package README](../../README.md)
- [Architecture Guide](../../docs/architecture.md)
- [Performance Guide](../../docs/performance.md)
- [RBAC Example](../rbac.ts)
- [ABAC Example](../abac.ts)
- [Multi-Tenant Example](../multi-tenant.ts)
- [Feature Flags Example](../feature-flags.ts)
