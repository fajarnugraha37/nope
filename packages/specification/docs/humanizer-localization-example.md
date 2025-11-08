# Humanizer Localization Example

This example demonstrates how to use the `HumanizerRegistry` with localization support to generate human-readable error messages in multiple languages.

## Basic Usage

```typescript
import { spec, createHumanizer, type HumanizerContext } from "@fajarnugraha37/specification";

// Create translation database
const translations = {
  en: {
    "field.eq": "{field} must equal {value}",
    "field.gte": "{field} must be at least {value}",
    "field.lt": "{field} must be less than {value}",
    "field.in": "{field} must be one of: {values}",
    "field.missing": "{field} must not exist or be null",
    "got": "but got {actual}",
  },
  es: {
    "field.eq": "{field} debe ser igual a {value}",
    "field.gte": "{field} debe ser al menos {value}",
    "field.lt": "{field} debe ser menor que {value}",
    "field.in": "{field} debe ser uno de: {values}",
    "field.missing": "{field} no debe existir o ser nulo",
    "got": "pero obtuve {actual}",
  },
  fr: {
    "field.eq": "{field} doit être égal à {value}",
    "field.gte": "{field} doit être au moins {value}",
    "field.lt": "{field} doit être inférieur à {value}",
    "field.in": "{field} doit être l'un de: {values}",
    "field.missing": "{field} ne doit pas exister ou être nul",
    "got": "mais obtenu {actual}",
  },
};

// Create localization function
function localize(key: string, params?: Record<string, unknown>): string {
  const locale = (params?.locale as string) ?? "en";
  let template = translations[locale as keyof typeof translations]?.[key] ?? key;
  
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      const value = Array.isArray(v) ? v.map(String).join(", ") : String(v);
      template = template.replace(`{${k}}`, value);
    });
  }
  
  return template;
}

// Create humanizer with localization
const humanizer = createHumanizer({ 
  locale: "en",
  localize 
});

// Register custom templates that use localization
humanizer.register("eq", (ctx: HumanizerContext) => {
  const t = (key: string, params?: Record<string, unknown>) => 
    localize(key, { ...params, locale: ctx.locale });
  
  const field = ctx.path ?? "value";
  const msg = t("field.eq", { field, value: ctx.expectedValue });
  const got = t("got", { actual: ctx.actualValue });
  
  return `${msg}, ${got}`;
});

humanizer.register("gte", (ctx: HumanizerContext) => {
  const t = (key: string, params?: Record<string, unknown>) => 
    localize(key, { ...params, locale: ctx.locale });
  
  const field = ctx.path ?? "value";
  const msg = t("field.gte", { field, value: ctx.expectedValue });
  const got = t("got", { actual: ctx.actualValue });
  
  return `${msg}, ${got}`;
});

// Define user type and specification
interface User {
  age: number;
  role: string;
  email?: string;
}

const userSpec = spec.field<User>("age").gte(18);
const user = { age: 16, role: "user" };

// English
humanizer.setLocale("en");
const nodeEn = userSpec.explain(user);
console.log(humanizer.humanize(nodeEn));
// Output: "age must be at least 18, but got 16"

// Spanish
humanizer.setLocale("es");
const nodeEs = userSpec.explain(user);
console.log(humanizer.humanize(nodeEs));
// Output: "age debe ser al menos 18, pero obtuve 16"

// French
humanizer.setLocale("fr");
const nodeFr = userSpec.explain(user);
console.log(humanizer.humanize(nodeFr));
// Output: "age doit être au moins 18, mais obtenu 16"
```

## Tree Rendering with Localization

```typescript
import { all, any } from "@fajarnugraha37/specification";

// Complex specification
const complexSpec = all(
  spec.field<User>("age").gte(18),
  any(
    spec.field<User>("role").eq("admin"),
    spec.field<User>("role").eq("moderator")
  ),
  spec.field<User>("email").exists()
);

const user = {
  age: 16,
  role: "user",
  // email is missing
};

// Register composite operator templates
humanizer.register("and", (ctx: HumanizerContext) => {
  const t = (key: string) => localize(key, { locale: ctx.locale });
  return ctx.locale === "es" 
    ? "Todas las condiciones deben cumplirse"
    : ctx.locale === "fr"
    ? "Toutes les conditions doivent être remplies"
    : "All conditions must be met";
});

humanizer.register("or", (ctx: HumanizerContext) => {
  const t = (key: string) => localize(key, { locale: ctx.locale });
  return ctx.locale === "es"
    ? "Al menos una condición debe cumplirse"
    : ctx.locale === "fr"
    ? "Au moins une condition doit être remplie"
    : "At least one condition must be met";
});

// English tree
humanizer.setLocale("en");
const treeEn = humanizer.humanizeTree(complexSpec.explain(user));
console.log(treeEn);
/*
✗ All conditions must be met (0.12ms)
  ✗ age must be at least 18, but got 16
  ✗ At least one condition must be met
    ✗ role must equal "admin", but got "user"
    ✗ role must equal "moderator", but got "user"
  ✗ email must exist and not be null, but got undefined
*/

// Spanish tree
humanizer.setLocale("es");
const treeEs = humanizer.humanizeTree(complexSpec.explain(user));
console.log(treeEs);
/*
✗ Todas las condiciones deben cumplirse (0.12ms)
  ✗ age debe ser al menos 18, pero obtuve 16
  ✗ Al menos una condición debe cumplirse
    ✗ role debe ser igual a "admin", pero obtuve "user"
    ✗ role debe ser igual a "moderator", pero obtuve "user"
  ✗ email no debe existir o ser nulo, pero obtuve undefined
*/
```

## Field Name Translation

You can also translate field names for better UX:

```typescript
const fieldNames = {
  en: { age: "Age", role: "Role", email: "Email Address" },
  es: { age: "Edad", role: "Rol", email: "Correo Electrónico" },
  fr: { age: "Âge", role: "Rôle", email: "Adresse Email" },
};

humanizer.register("gte", (ctx: HumanizerContext) => {
  const locale = ctx.locale ?? "en";
  const fields = fieldNames[locale as keyof typeof fieldNames];
  const fieldName = fields[ctx.path as keyof typeof fields] ?? ctx.path;
  
  const t = (key: string, params?: Record<string, unknown>) => 
    localize(key, { ...params, locale });
  
  const msg = t("field.gte", { field: fieldName, value: ctx.expectedValue });
  const got = t("got", { actual: ctx.actualValue });
  
  return `${msg}, ${got}`;
});

// English
humanizer.setLocale("en");
console.log(humanizer.humanize(userSpec.explain(user)));
// Output: "Age must be at least 18, but got 16"

// Spanish
humanizer.setLocale("es");
console.log(humanizer.humanize(userSpec.explain(user)));
// Output: "Edad debe ser al menos 18, pero obtuve 16"
```

## Dynamic Template Selection

Choose templates based on context:

```typescript
humanizer.register("gte", (ctx: HumanizerContext) => {
  const locale = ctx.locale ?? "en";
  const field = ctx.path ?? "value";
  const value = ctx.expectedValue;
  
  // Special messages for specific fields
  if (field === "age" && value === 18) {
    if (locale === "es") return "Debes ser mayor de edad (18 años)";
    if (locale === "fr") return "Vous devez être majeur (18 ans)";
    return "You must be an adult (18 years old)";
  }
  
  if (field === "age" && value === 21) {
    if (locale === "es") return "Debes tener al menos 21 años para esta acción";
    if (locale === "fr") return "Vous devez avoir au moins 21 ans pour cette action";
    return "You must be at least 21 years old for this action";
  }
  
  // Fallback to default template
  const t = (key: string, params?: Record<string, unknown>) => 
    localize(key, { ...params, locale });
  
  const msg = t("field.gte", { field, value });
  const got = t("got", { actual: ctx.actualValue });
  
  return `${msg}, ${got}`;
});
```

## Best Practices

1. **Centralized translations**: Keep all translations in a single file or database
2. **Fallback handling**: Always provide English as fallback locale
3. **Parameter interpolation**: Use placeholders like `{field}`, `{value}` for dynamic values
4. **Context-aware messages**: Tailor messages based on field names or values
5. **Pluralization**: Handle singular/plural forms correctly (e.g., "1 error" vs "2 errors")
6. **Date/number formatting**: Use locale-specific formatters for dates and numbers
7. **RTL support**: Consider right-to-left languages if needed
8. **Testing**: Test all locales to ensure translations are accurate and complete

## Integration with i18n Libraries

You can integrate with popular i18n libraries:

```typescript
import i18next from "i18next";

// Initialize i18next
await i18next.init({
  lng: "en",
  resources: {
    en: { translation: { /* ... */ } },
    es: { translation: { /* ... */ } },
    fr: { translation: { /* ... */ } },
  },
});

// Use i18next in humanizer
const humanizer = createHumanizer({
  locale: i18next.language,
  localize: (key, params) => i18next.t(key, params),
});

// Change language
i18next.changeLanguage("es");
humanizer.setLocale("es");
```
