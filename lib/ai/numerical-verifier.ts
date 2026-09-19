/**
 * Numerical and Statistical Consistency Engine (Phase 15)
 *
 * Verifies consistency between inline manuscript claims (e.g. claimed p-values,
 * accuracies, collision energies, particle counts) and the actual data in tables/figures
 * without relying exclusively on generative LLM recall.
 */

export interface ExtractedNumericalDatum {
  raw: string
  value: number
  unit?: string
  parameter?: string // e.g. "p-value", "accuracy", "energy", "AUC"
  contextSnippet: string
  sourceType: "inline_text" | "table" | "equation"
  chunkId?: string
}

export interface NumericalDiscrepancy {
  parameter: string
  inlineClaim: {
    value: number
    unit?: string
    snippet: string
    chunkId?: string
  }
  tableOrEquationEvidence: {
    value: number
    unit?: string
    snippet: string
    chunkId?: string
  }
  relativeDiscrepancy: number // |v1 - v2| / max(|v1|, |v2|)
  severity: "critical" | "moderate" | "minor"
  explanation: string
}

/**
 * Regex patterns matching scientific parameters, values, and common units.
 */
const NUMERICAL_PARAM_RE = /(?:p\s*[-=<>≤≥]\s*|accuracy\s*(?:of|=|:)?\s*|presnos[ťt]\s*(?:je|=|:)?\s*|dosiahli\s+sme\s+|F1\s*[-=:]\s*|AUC\s*[-=:]\s*|energy\s*[-=:]\s*|E\s*=\s*|N\s*=\s*|vzork[a-z]*\s*=\s*)([0-9]+(?:[.,][0-9]+)?)\s*(%|GeV|TeV|MeV|keV|eV|ms|s|kg|g|m|cm|mm|µm|nm)?/gi

/**
 * Extracts numeric metrics and parameters from prose or tables.
 */
export function extractNumericalData(
  text: string,
  sourceType: "inline_text" | "table" | "equation" = "inline_text",
  chunkId?: string
): ExtractedNumericalDatum[] {
  if (!text) return []
  const data: ExtractedNumericalDatum[] = []
  let match: RegExpExecArray | null

  // Clone regex to reset state
  const re = new RegExp(NUMERICAL_PARAM_RE.source, "gi")
  while ((match = re.exec(text)) !== null) {
    const rawMatch = match[0]
    const numStr = match[1].replace(",", ".")
    const val = parseFloat(numStr)
    const unit = match[2] ? match[2].trim() : undefined

    let parameter = "numeric_value"
    const lowerMatch = rawMatch.toLowerCase()
    if (lowerMatch.includes("p ") || lowerMatch.includes("p-") || lowerMatch.includes("p=") || lowerMatch.includes("p<")) parameter = "p-value"
    else if (lowerMatch.includes("accurac") || lowerMatch.includes("presnos")) parameter = "accuracy"
    else if (lowerMatch.includes("f1")) parameter = "f1-score"
    else if (lowerMatch.includes("auc")) parameter = "auc"
    else if (lowerMatch.includes("gev") || lowerMatch.includes("tev") || lowerMatch.includes("energy")) parameter = "energy"

    if (!Number.isNaN(val)) {
      data.push({
        raw: rawMatch,
        value: val,
        unit,
        parameter,
        contextSnippet: text.slice(Math.max(0, match.index - 30), Math.min(text.length, match.index + rawMatch.length + 30)),
        sourceType,
        chunkId,
      })
    }
  }

  return data
}

/**
 * Compares inline manuscript claims against extracted tables to find discrepancies.
 */
export function verifyNumericalConsistency(
  inlineText: string,
  tableTexts: Array<{ content: string; chunkId?: string }>,
  tolerance = 0.01
): {
  checkedCount: number
  discrepancies: NumericalDiscrepancy[]
  isConsistent: boolean
} {
  const inlineMetrics = extractNumericalData(inlineText, "inline_text")
  const tableMetrics = tableTexts.flatMap((t) => extractNumericalData(t.content, "table", t.chunkId))

  const discrepancies: NumericalDiscrepancy[] = []

  for (const im of inlineMetrics) {
    // Look for matching parameters in table metrics
    const matchingTableMetric = tableMetrics.find(
      (tm) => tm.parameter === im.parameter && (im.unit ? tm.unit === im.unit : true)
    )

    if (matchingTableMetric) {
      const denom = Math.max(Math.abs(im.value), Math.abs(matchingTableMetric.value), 1e-9)
      const relDiff = Math.abs(im.value - matchingTableMetric.value) / denom

      if (relDiff > tolerance) {
        const severity = relDiff > 0.1 ? "critical" : relDiff > 0.03 ? "moderate" : "minor"
        discrepancies.push({
          parameter: im.parameter || "numeric_value",
          inlineClaim: {
            value: im.value,
            unit: im.unit,
            snippet: im.contextSnippet,
            chunkId: im.chunkId,
          },
          tableOrEquationEvidence: {
            value: matchingTableMetric.value,
            unit: matchingTableMetric.unit,
            snippet: matchingTableMetric.contextSnippet,
            chunkId: matchingTableMetric.chunkId,
          },
          relativeDiscrepancy: Math.round(relDiff * 1000) / 1000,
          severity,
          explanation: `Manuscript text claims ${im.parameter} = ${im.value}${im.unit || ""} but backing table reports ${matchingTableMetric.value}${matchingTableMetric.unit || ""} (discrepancy: ${Math.round(relDiff * 100)}%).`,
        })
      }
    }
  }

  return {
    checkedCount: inlineMetrics.length,
    discrepancies,
    isConsistent: discrepancies.length === 0,
  }
}
