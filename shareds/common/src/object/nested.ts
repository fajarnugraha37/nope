export function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((current, key) => current?.[key], obj);
}

export function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split(".");
  const lastKey = keys.pop()!;
  const target = keys.reduce((current, key) => {
    if (!(key in current) || typeof current[key] !== "object") {
      current[key] = {};
    }
    return current[key];
  }, obj);
  target[lastKey] = value;
}

export function hasNestedProperty(obj: any, path: string): boolean {
  return path.split(".").every((_, index, keys) => {
    const currentPath = keys.slice(0, index + 1).join(".");
    const value = getNestedValue(obj, currentPath);
    return value !== undefined;
  });
}

export function deleteNestedProperty(obj: any, path: string): boolean {
  const keys = path.split(".");
  const lastKey = keys.pop()!;
  const parent = keys.reduce((current, key) => current?.[key], obj);

  if (parent && typeof parent === "object" && lastKey in parent) {
    delete parent[lastKey];
    return true;
  }
  return false;
}
