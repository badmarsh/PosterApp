/**
 * Strip markdown code fences from AI response text.
 * Handles: ```json ... ```, ``` ... ```, trailing backticks, or no fences at all.
 */
function stripMarkdownFences(text: string): string {
  let cleaned = text.trim()
  // Remove ```json or ``` fences
  cleaned = cleaned
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?\s*```\s*$/i, "")
    .trim()
  // Remove any remaining trailing backticks
  cleaned = cleaned.replace(/```+$/g, "").trim()
  return cleaned
}

/**
 * Fix common JSON issues that make it invalid.
 */
function fixJsonIssues(jsonStr: string): string {
  let fixed = jsonStr.trim()
  
  // Remove trailing commas before } or ] (common AI mistake)
  fixed = fixed.replace(/,\s*([}\]])/g, "$1")
  
  // Fix unescaped control characters in strings (newlines, tabs)
  // This is a simplified fix - in production you'd want proper parsing
  fixed = fixed.replace(/\n/g, "\\n").replace(/\t/g, "\\t")
  
  return fixed
}

/**
 * Parse an AI JSON response with error handling.
 * Returns { data, error }. Never throws.
 */
export function parseAiJson<T>(raw: string): { data: T | null; error: string | null } {
  const cleaned = stripMarkdownFences(raw)
  
  // First attempt: try parsing as-is
  try {
    return { data: JSON.parse(cleaned) as T, error: null }
  } catch {
    // Try to fix common JSON issues and parse again
    const fixed = fixJsonIssues(cleaned)
    if (fixed !== cleaned) {
      try {
        return { data: JSON.parse(fixed) as T, error: null }
      } catch {
        // Continue to fallback extraction methods
      }
    }
  }
  
  // Try matching array first or object depending on whichever appears first
  const objIdx = cleaned.indexOf("{")
  const arrIdx = cleaned.indexOf("[")

  if (arrIdx !== -1 && (objIdx === -1 || arrIdx < objIdx)) {
    const matchArr = cleaned.match(/\[[\s\S]*\]/)
    if (matchArr) {
      try {
        const fixed = fixJsonIssues(matchArr[0])
        return { data: JSON.parse(fixed) as T, error: null }
      } catch {}
    }
  }

  const matchObj = cleaned.match(/\{[\s\S]*\}/)
  if (matchObj) {
    try {
      const fixed = fixJsonIssues(matchObj[0])
      return { data: JSON.parse(fixed) as T, error: null }
    } catch {}
  }

  const matchArr = cleaned.match(/\[[\s\S]*\]/)
  if (matchArr) {
    try {
      const fixed = fixJsonIssues(matchArr[0])
      return { data: JSON.parse(fixed) as T, error: null }
    } catch {}
  }

  return { data: null, error: `AI returned invalid JSON: ${cleaned.slice(0, 200)}` }
}

