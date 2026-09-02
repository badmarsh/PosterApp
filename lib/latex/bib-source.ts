/**
 * Resolves the active bibliography content for LaTeX compilation and export.
 * If reference cards exist with BibTeX entries (containing '@'), they take precedence;
 * otherwise falls back to workspace.bibContent.
 */
export function resolveBibSource(
  workspace: { bibContent?: string | null },
  outputCards?: Array<{ pattern?: string; content?: string | null }>
): string {
  const refCards = (outputCards || []).filter((c) => c.pattern === "references")
  const cardBib = refCards.map((c) => c.content).filter(Boolean).join("\n\n")
  if (cardBib && cardBib.includes("@")) {
    return cardBib
  }
  return workspace.bibContent || cardBib || ""
}
