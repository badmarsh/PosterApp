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
 * escaping any literal closing tags and known prompt-structural tags within
 * the content to prevent prompt injection breakouts.
 */
export function wrapUntrustedContext(tag: string, content: string): string {
  if (!content) return `<${tag}>\n</${tag}>`
  
  let sanitized = content
  
  // 1. Neutralize CDATA sections first (before tag processing)
  sanitized = sanitized.replace(/<!\[CDATA\[/gi, '<![ CDATA[')
  sanitized = sanitized.replace(/\]\]>/g, ']] >')
  
  // 2. Neutralize XML processing instructions
  sanitized = sanitized.replace(/<\?/g, '< ?')
  sanitized = sanitized.replace(/\?>/g, '? >')
  
  // 3. Neutralize DOCTYPE declarations
  sanitized = sanitized.replace(/<!DOCTYPE\b/gi, '<! DOCTYPE')
  
  // 4. Neutralize ALL opening tags (not just known ones)
  // This prevents injection of <script>, <img>, <instructions>, <=== TAG ===>, etc.
  // Match: < followed by any non-whitespace char (tag name start), then everything up to > or />
  sanitized = sanitized.replace(/<([^\s>\/][^>\/]*?)(\s[^>]*)?\/?>/g, (_match, tagName: string, attrs: string) => {
    return `<${tagName}${attrs ? ' ' + attrs.trim() : ''} >`
  })
  
  // 5. Neutralize ALL closing tags (including non-standard like </=== TAG ===>)
  // First pass: well-formed closing tags </TAG>
  sanitized = sanitized.replace(/<\/\s*([a-zA-Z0-9_\s/=-]+?)\s*>/g, (_match, tagName: string) => `< /${tagName}>`)
  // Second pass: unclosed </ at start or preceded by something other than space
  // Handles edge cases like "</content<..." where </ appears but isn't properly closed
  sanitized = sanitized.replace(/<(\/[a-zA-Z0-9_\s/=-]+?)(?![^<>]*>)/g, '< $1')
  
  return `<${tag}>\n${sanitized}\n</${tag}>`
}

