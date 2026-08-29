/**
 * Shared prompt building utilities for card generation and conversion.
 */

export function buildGroundingInstruction(): string {
  return "STRICT GROUNDING: Use ONLY information from the source material. Do not invent facts, outside knowledge, or extrapolate beyond what is provided."
}

export function buildCitationInstruction(bibKeys: string[] = []): string {
  if (bibKeys.length > 0) {
    return `You may use \\cite{key} citations but ONLY with keys from: ${JSON.stringify(bibKeys)}. Never invent citation keys.`
  }
  return "Do NOT use \\cite{} commands — no valid cite keys are available."
}

export function buildJsonContractInstruction(schemaExample: string): string {
  return `Respond EXACTLY in this JSON format (no markdown wrapper):\n${schemaExample}`
}

/**
 * Strips or filters hallucinated \cite{...} keys that are not in the valid bibKeys list.
 */
export function sanitizeCiteKeys(
  bullets: string[],
  bibKeys: string[] | Set<string> = []
): string[] {
  const validKeys = bibKeys instanceof Set ? bibKeys : new Set(bibKeys)
  return bullets.map((b: string) => {
    return b.replace(/\\cite\{([^}]+)\}/g, (_match, keysStr) => {
      const keys = keysStr.split(",").map((k: string) => k.trim())
      const keptKeys = keys.filter((k: string) => validKeys.has(k))
      if (keptKeys.length === 0) return "" // drop hallucinated cite
      return `\\cite{${keptKeys.join(", ")}}`
    })
  })
}

/**
 * Wraps untrusted text (such as extracted PDF context) in delimited XML tags,
 * escaping any literal closing tags within the content to prevent prompt injection breakouts.
 */
export function wrapUntrustedContext(tag: string, content: string): string {
  if (!content) return `<${tag}>\n</${tag}>`
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const closeTagRegex = new RegExp(`</\\s*${escapedTag}\\s*>`, "gi")
  const sanitized = content.replace(closeTagRegex, `< /${tag}>`)
  return `<${tag}>\n${sanitized}\n</${tag}>`
}

