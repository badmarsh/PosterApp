/**
 * Strip markdown code fences from AI response text.
 * Handles: ```json ... ```, ``` ... ```, trailing backticks, or no fences at all.
 */
export function stripMarkdownFences(text: string): string {
  let cleaned = text.trim()
  cleaned = cleaned
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?\s*```\s*$/i, "")
    .trim()
  return cleaned.replace(/```+$/g, "").trim()
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
    // Try matching array first or object depending on whichever appears first
    const objIdx = cleaned.indexOf("{")
    const arrIdx = cleaned.indexOf("[")

    if (arrIdx !== -1 && (objIdx === -1 || arrIdx < objIdx)) {
      const matchArr = cleaned.match(/\[[\s\S]*\]/)
      if (matchArr) {
        try {
          return { data: JSON.parse(matchArr[0]) as T, error: null }
        } catch {}
      }
    }

    const matchObj = cleaned.match(/\{[\s\S]*\}/)
    if (matchObj) {
      try {
        return { data: JSON.parse(matchObj[0]) as T, error: null }
      } catch {}
    }

    const matchArr = cleaned.match(/\[[\s\S]*\]/)
    if (matchArr) {
      try {
        return { data: JSON.parse(matchArr[0]) as T, error: null }
      } catch {}
    }

    return { data: null, error: `AI returned invalid JSON: ${cleaned.slice(0, 200)}` }
  }
}

