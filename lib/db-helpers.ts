/**
 * Safe JSON parse with fallback. Use for Prisma String columns that store JSON.
 */
export function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch (err) {
    console.error('Failed to parse JSON column:', err)
    return fallback
  }
}

/**
 * Stringify a value for Prisma String column storage. Returns null for undefined/null.
 */
export function jsonStringify(value: unknown): string | null {
  if (value === undefined || value === null) return null
  return JSON.stringify(value)
}
