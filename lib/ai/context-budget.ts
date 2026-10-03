/** Hard bounds and fair weighted composition for review-source context. */
export const MAX_REVIEW_CONTEXT_CHARS = 60_000

export interface ReviewContextSource {
  key: string
  label: string
  content: string
  /** Relative share; unused capacity is redistributed to sources with more text. */
  weight: number
}

export interface BudgetedReviewContext {
  contextText: string
  selectedChars: number
  sourceChars: number
  truncated: boolean
  selectedBySource: Record<string, number>
}

function trimAtBoundary(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  if (maxChars <= 0) return ""

  const prefix = text.slice(0, maxChars)
  const lowerBound = Math.floor(maxChars * 0.7)
  const boundaries = [
    prefix.lastIndexOf("\n\n"),
    prefix.lastIndexOf("\n"),
    prefix.lastIndexOf(". "),
    prefix.lastIndexOf("? "),
    prefix.lastIndexOf("! "),
  ]
  const boundary = Math.max(...boundaries)
  return (boundary >= lowerBound ? prefix.slice(0, boundary + 1) : prefix).trimEnd()
}

/**
 * Compose multiple evidence sources under one character ceiling. Character budgets are
 * allocated proportionally, then unused capacity from short/empty sources is redistributed.
 * Labels and separators are counted as part of the same hard budget.
 */
export function buildBudgetedReviewContext(
  sources: ReviewContextSource[],
  requestedBudget = MAX_REVIEW_CONTEXT_CHARS
): BudgetedReviewContext {
  const budget = Math.max(0, Math.min(MAX_REVIEW_CONTEXT_CHARS, Math.floor(requestedBudget)))
  const active = sources
    .map((source) => ({ ...source, content: source.content.trim(), weight: Math.max(0, source.weight) }))
    .filter((source) => source.content.length > 0 && source.weight > 0)
  const sourceChars = active.reduce((sum, source) => sum + source.content.length, 0)

  if (active.length === 0 || budget === 0) {
    return { contextText: "", selectedChars: 0, sourceChars, truncated: sourceChars > 0, selectedBySource: {} }
  }

  // Reserve every label and the exact blank-line separators before dividing content capacity.
  const markers = active.map((source) => `[${source.label}]\n`)
  const markerChars = markers.reduce((sum, marker) => sum + marker.length, 0)
  const separatorChars = Math.max(0, active.length - 1) * 2
  let contentCapacity = budget - markerChars - separatorChars

  if (contentCapacity <= 0) {
    // Keep the highest-weight labelled sources that fit rather than exceeding the hard limit.
    const ranked = active
      .map((source, index) => ({ source, index, marker: markers[index] }))
      .sort((a, b) => b.source.weight - a.source.weight || a.source.key.localeCompare(b.source.key))
    const selected: Array<{ source: ReviewContextSource; marker: string; text: string }> = []
    let used = 0
    for (const item of ranked) {
      const next = item.marker.length + (selected.length > 0 ? 2 : 0)
      if (used + next > budget) continue
      selected.push({ source: item.source, marker: item.marker, text: "" })
      used += next
    }
    const contextText = selected.map((item) => item.marker.trimEnd()).join("\n\n")
    return {
      contextText: contextText.slice(0, budget),
      selectedChars: Math.min(contextText.length, budget),
      sourceChars,
      truncated: sourceChars > 0,
      selectedBySource: {},
    }
  }

  // Repeatedly satisfy sources whose complete content fits within their current share,
  // redistributing their unused capacity to longer sources.
  const allocations = new Map<string, number>()
  let remaining = contentCapacity
  let pending = [...active]
  while (pending.length > 0 && remaining > 0) {
    const totalWeight = pending.reduce((sum, source) => sum + source.weight, 0)
    if (totalWeight <= 0) break
    const shares = pending.map((source) => ({
      source,
      share: Math.floor((remaining * source.weight) / totalWeight),
    }))
    const fitting = shares.filter(({ source, share }) => source.content.length <= share)
    if (fitting.length === 0) {
      for (const { source, share } of shares) allocations.set(source.key, share)
      break
    }
    for (const { source } of fitting) {
      allocations.set(source.key, source.content.length)
      remaining -= source.content.length
    }
    const fitted = new Set(fitting.map(({ source }) => source.key))
    pending = pending.filter((source) => !fitted.has(source.key))
    if (pending.length > 0 && fitting.length === 0) break
  }

  const parts: string[] = []
  const selectedBySource: Record<string, number> = {}
  let truncated = false
  for (const source of active) {
    const contentBudget = allocations.get(source.key) ?? 0
    if (contentBudget <= 0) {
      truncated ||= source.content.length > 0
      continue
    }
    const content = trimAtBoundary(source.content, contentBudget)
    if (!content) {
      truncated ||= source.content.length > 0
      continue
    }
    parts.push(`[${source.label}]\n${content}`)
    selectedBySource[source.key] = content.length
    if (content.length < source.content.length) truncated = true
  }

  const contextText = parts.join("\n\n")
  // Defensive final guard; allocation math already includes markers/separators.
  const boundedText = contextText.length <= budget ? contextText : contextText.slice(0, budget)
  return {
    contextText: boundedText,
    selectedChars: boundedText.length,
    sourceChars,
    truncated: truncated || sourceChars > boundedText.length,
    selectedBySource,
  }
}
