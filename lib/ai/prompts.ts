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
 *
 * Sanitisation strategy (single linear pass):
 * 1. Strip control characters and Unicode bidi overrides — invisible prompt
 *    manipulation vectors that tag escaping cannot reach.
 * 2. Break CDATA terminator `]]>` so content cannot close a CDATA section
 *    opened by surrounding system prompts.
 * 3. Break `?>` so processing instructions cannot be terminated.
 * 4. Break every `<` that is followed by a non-whitespace character. This
 *    invalidates opening tags, closing tags, CDATA starts, DOCTYPE
 *    declarations, and processing instructions in one pass, while leaving
 *    prose comparisons like `x < y` untouched (a space already follows `<`).
 */
export function wrapUntrustedContext(tag: string, content: string): string {
  if (!content) return `<${tag}>\n</${tag}>`

  let sanitized = content

  // 1. Strip control characters and Unicode directionality overrides.
  sanitized = sanitized
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[\u202A-\u202E\u2066-\u2069]/g, "")

  // 2. Neutralize CDATA terminators.
  sanitized = sanitized.replace(/\]\]>/g, "]] >")

  // 3. Neutralize XML processing instruction terminators.
  sanitized = sanitized.replace(/\?>/g, "? >")

  // 4. Neutralize every `<` that starts a tag-like token.
  //    `(?=\S)` ensures we only break `<` followed by a non-space character,
  //    preserving mathematical comparisons like `x < y`.
  sanitized = sanitized.replace(/<(?=\S)/g, "< ")

  return `<${tag}>\n${sanitized}\n</${tag}>`
}

