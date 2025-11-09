/**
 * Redaction utilities for sensitive data
 */

const MAX_DEPTH = 10;
const MAX_SIZE = 1000;

const DEFAULT_SENSITIVE_PATTERNS = [
  /pass(word)?/i,
  /token/i,
  /secret/i,
  /authorization/i,
  /api[_-]?key/i,
  /private[_-]?key/i,
];

export type RedactionPredicate = (keyPath: string[]) => boolean;

/**
 * Default redaction predicate
 */
export function defaultRedactionPredicate(keyPath: string[]): boolean {
  const key = keyPath[keyPath.length - 1];
  if (!key) return false;
  return DEFAULT_SENSITIVE_PATTERNS.some((pattern) =>
    pattern.test(String(key))
  );
}

/**
 * Redact sensitive values in an object
 */
export function redact(
  data: unknown,
  predicate: RedactionPredicate = defaultRedactionPredicate
): unknown {
  const seen = new WeakSet();
  return redactRecursive(data, predicate, [], seen, 0);
}

function redactRecursive(
  value: unknown,
  predicate: RedactionPredicate,
  keyPath: string[],
  seen: WeakSet<object>,
  depth: number
): unknown {
  // Protect against max depth
  if (depth > MAX_DEPTH) {
    return "[MAX_DEPTH_EXCEEDED]";
  }

  // Handle primitives
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== "object") {
    // Check if this key should be redacted
    if (predicate(keyPath)) {
      return "[REDACTED]";
    }
    return value;
  }

  // Protect against cycles
  if (seen.has(value)) {
    return "[CIRCULAR]";
  }
  seen.add(value);

  // Handle arrays
  if (Array.isArray(value)) {
    if (value.length > MAX_SIZE) {
      return value
        .slice(0, MAX_SIZE)
        .map((item, index) =>
          redactRecursive(
            item,
            predicate,
            [...keyPath, String(index)],
            seen,
            depth + 1
          )
        )
        .concat("[TRUNCATED]");
    }
    return value.map((item, index) =>
      redactRecursive(
        item,
        predicate,
        [...keyPath, String(index)],
        seen,
        depth + 1
      )
    );
  }

  // Handle dates
  if (value instanceof Date) {
    return value.toISOString();
  }

  // Handle errors
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  // Handle plain objects
  const result: Record<string, unknown> = {};
  const entries = Object.entries(value as Record<string, unknown>);

  if (entries.length > MAX_SIZE) {
    const truncated = entries.slice(0, MAX_SIZE);
    for (const [key, val] of truncated) {
      result[key] = redactRecursive(
        val,
        predicate,
        [...keyPath, key],
        seen,
        depth + 1
      );
    }
    result["__truncated__"] = true;
    return result;
  }

  for (const [key, val] of entries) {
    result[key] = redactRecursive(
      val,
      predicate,
      [...keyPath, key],
      seen,
      depth + 1
    );
  }

  return result;
}

/**
 * Cycle-safe JSON stringify with redaction
 */
export function safeStringify(
  value: unknown,
  predicate?: RedactionPredicate,
  space?: number
): string {
  try {
    const redacted = predicate ? redact(value, predicate) : redact(value);
    return JSON.stringify(redacted, null, space);
  } catch (err) {
    return `[STRINGIFY_ERROR: ${
      err instanceof Error ? err.message : String(err)
    }]`;
  }
}
