## @fajarnugraha37/specification

An extensible specification-pattern toolkit for TypeScript with strong typing, fluent builders, JSON AST, adapters, and plugin hooks.

### Install

```bash
pnpm add @fajarnugraha37/specification
```

### Quickstart

```ts
import { spec, all } from "@fajarnugraha37/specification";

interface User {
  age: number;
  role: string;
}

const isAdultAdmin = all<User>(
  spec.field<User>("age").gte(18),
  spec.field<User>("role").eq("admin"),
);

isAdultAdmin.isSatisfiedBy({ age: 21, role: "admin" }); // true
```

### JSON AST

```ts
import { toAst, fromAst, spec, createRegistry, builtInOperators } from "@fajarnugraha37/specification";

const rule = spec.field<User>("age").gte(18);
const ast = toAst(rule);
const registry = createRegistry({ operators: builtInOperators });
const rebuilt = fromAst<User>(ast, registry);
```

### Plugins

```ts
import { geoPlugin, timePlugin, stringPlugin, createRegistry, builtInOperators } from "@fajarnugraha37/specification";

const registry = createRegistry({ operators: builtInOperators });
geoPlugin.register(registry);
timePlugin.register(registry);
stringPlugin.register(registry);
```

### Adapters

```ts
import { prismaAdapter } from "@fajarnugraha37/specification";

const query = prismaAdapter.compile(isAdultAdmin);
await prisma.user.findMany({ where: query });
```

### Scripts

```
pnpm build
pnpm test
pnpm lint
```
