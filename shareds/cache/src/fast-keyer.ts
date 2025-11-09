/**
 * Optimized key generation for memoization
 * Provides fast-paths for common argument patterns
 */

// Fast hash function for primitives (inline, no prefixes for speed)
function hashPrimitive(value: any): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  
  const type = typeof value;
  switch (type) {
    case "number":
    case "boolean":
    case "bigint":
      return String(value);
    case "string":
      return value;
    case "symbol":
      return value.toString();
    default:
      return String(value);
  }
}

// Fast hash for arrays (avoid JSON.stringify)
function hashArray(arr: any[]): string {
  if (arr.length === 0) return "[]";
  if (arr.length === 1) return `[${hashValue(arr[0])}]`;
  
  // For small arrays (< 10), hash each element
  if (arr.length < 10) {
    let result = "[";
    for (let i = 0; i < arr.length; i++) {
      if (i > 0) result += ",";
      result += hashValue(arr[i]);
    }
    result += "]";
    return result;
  }
  
  // For larger arrays, use length + first/last + sample
  // This is fast but may have collisions - acceptable for cache keys
  const first = hashValue(arr[0]);
  const last = hashValue(arr[arr.length - 1]);
  const mid = hashValue(arr[Math.floor(arr.length / 2)]);
  return `[${arr.length}:${first}|${mid}|${last}]`;
}

// Fast hash for objects
function hashObject(obj: any): string {
  // Use JSON.stringify for objects (no faster alternative without sorting keys)
  try {
    return `{${JSON.stringify(obj)}}`;
  } catch {
    return `{${String(obj)}}`;
  }
}

// Main value hasher
function hashValue(value: any): string {
  const type = typeof value;
  
  if (type === "object") {
    if (value === null) return "n:null";
    if (Array.isArray(value)) return hashArray(value);
    return hashObject(value);
  }
  
  return hashPrimitive(value);
}

/**
 * Optimized keyer with fast-paths for common patterns
 */
export function fastKeyer(args: any[]): string {
  const len = args.length;
  
  // Fast-path: No arguments
  if (len === 0) return "()";
  
  // Fast-path: Single primitive argument
  if (len === 1) {
    const arg = args[0];
    const type = typeof arg;
    
    // Single primitive
    if (type !== "object" && type !== "function") {
      return hashPrimitive(arg);
    }
    
    // Single null
    if (arg === null) return "n:null";
    
    // Single array
    if (Array.isArray(arg)) {
      return hashArray(arg);
    }
    
    // Single object - use JSON.stringify
    return hashObject(arg);
  }
  
  // Fast-path: Two primitives (very common: (id, userId) or (key, value))
  if (len === 2) {
    const [a, b] = args;
    const typeA = typeof a;
    const typeB = typeof b;
    
    if (typeA !== "object" && typeA !== "function" && 
        typeB !== "object" && typeB !== "function") {
      // Use JSON.stringify for two primitives - it's actually faster!
      try {
        return JSON.stringify(args);
      } catch {
        return `${hashPrimitive(a)}:${hashPrimitive(b)}`;
      }
    }
  }
  
  // Fast-path: All primitives (< 5 args) - use JSON.stringify (it's optimized!)
  if (len < 5) {
    let allPrimitives = true;
    for (let i = 0; i < len; i++) {
      const type = typeof args[i];
      if (type === "object" && args[i] !== null || type === "function") {
        allPrimitives = false;
        break;
      }
    }
    
    if (allPrimitives) {
      try {
        return JSON.stringify(args);
      } catch {
        // Fallback
      }
    }
  }
  
  // Slow-path: Mixed types - use JSON.stringify fallback
  try {
    return JSON.stringify(args);
  } catch {
    return String(args[0]);
  }
}

/**
 * Original keyer for comparison
 */
export function originalKeyer(args: any[]): string {
  try {
    return JSON.stringify(args);
  } catch {
    return String(args[0]);
  }
}

/**
 * WeakMap-based keyer for object arguments (experimental)
 * Uses object identity instead of serialization
 */
const objectKeyMap = new WeakMap<object, number>();
let nextObjectId = 1;

export function weakMapKeyer(args: any[]): string {
  if (args.length === 0) return "()";
  
  let result = "";
  for (let i = 0; i < args.length; i++) {
    if (i > 0) result += ":";
    
    const arg = args[i];
    const type = typeof arg;
    
    if (type === "object" && arg !== null && !Array.isArray(arg)) {
      // Use object identity
      let id = objectKeyMap.get(arg);
      if (id === undefined) {
        id = nextObjectId++;
        objectKeyMap.set(arg, id);
      }
      result += `o:${id}`;
    } else {
      result += hashValue(arg);
    }
  }
  
  return result;
}
