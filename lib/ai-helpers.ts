/**
 * Strip markdown code fences from AI response text.
 * Handles: ```json ... ```, ``` ... ```, or no fences at all.
 */
export function stripMarkdownFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?\s*```\s*$/i, "")
    .trim()
}

/**
 * Parse an AI JSON response with error handling.
 * Returns { data, error }. Never throws.
 */
export function parseAiJson<T>(raw: string): { data: T | null; error: string | null } {
  const cleaned = stripMarkdownFences(raw)
  try {
    return { data: JSON.parse(cleaned) as T, error: null }
  } catch {
    return { data: null, error: `AI returned invalid JSON: ${cleaned.slice(0, 200)}` }
  }
}
