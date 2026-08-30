import { type BibEntry } from "@/lib/bib-types"
import { extractCiteKeys } from "@/lib/bib-parser"
import { generateAITextResponse } from "@/lib/ai/client"
import { resolveAiModel, AI_TIMEOUTS } from "@/lib/ai/models"

export interface SuggestedCitation {
  bibKey: string
  entry: BibEntry
  targetBulletText: string
  reason: string
  confidence: number // 0.0 - 1.0
}

/**
 * Extract tokens/keywords from text for similarity matching.
 */
function extractKeywords(text: string): Set<string> {
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "with", "by", "about",
    "against", "between", "into", "through", "during", "before", "after", "above", "below", "from",
    "up", "down", "in", "out", "over", "under", "again", "further", "then", "once", "here", "there",
    "when", "where", "why", "how", "all", "any", "both", "each", "few", "more", "most", "other",
    "some", "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "s",
    "t", "can", "will", "just", "don", "should", "now", "we", "our", "show", "result", "using",
    "used", "based", "study", "card", "section", "figure", "table", "data", "model",
  ])

  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s_-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w))
  )
}

/**
 * Fast deterministic citation suggestion based on keyword overlap and entity matching.
 */
export function suggestCitationsForText(
  cardText: string,
  entries: BibEntry[]
): SuggestedCitation[] {
  if (!cardText || !entries || entries.length === 0) return []

  const existingCiteKeys = new Set(extractCiteKeys(cardText))
  const lines = cardText.split("\n").filter((l) => l.trim().length > 0)
  const suggestions: SuggestedCitation[] = []

  for (const entry of entries) {
    if (existingCiteKeys.has(entry.key)) continue // Already cited

    // Build entry search corpus
    const entryTerms = new Set<string>()
    const titleWords = extractKeywords(entry.title)
    titleWords.forEach((w) => entryTerms.add(w))

    entry.authors.forEach((a) => {
      extractKeywords(a).forEach((w) => entryTerms.add(w))
    })
    if (entry.journal) extractKeywords(entry.journal).forEach((w) => entryTerms.add(w))
    if (entry.booktitle) extractKeywords(entry.booktitle).forEach((w) => entryTerms.add(w))
    if (entry.key) extractKeywords(entry.key).forEach((w) => entryTerms.add(w))

    let bestMatchLine = ""
    let maxOverlap = 0
    let matchReason = ""

    for (const line of lines) {
      if (line.includes(`\\cite{${entry.key}}`)) continue

      const lineKeywords = extractKeywords(line)
      let overlapCount = 0
      const matchedWords: string[] = []

      for (const word of lineKeywords) {
        if (entryTerms.has(word)) {
          overlapCount++
          matchedWords.push(word)
        }
      }

      // Check author surname directly
      for (const author of entry.authors) {
        const surname = author.split(/[\s,]+/)[0].toLowerCase()
        if (surname.length > 3 && line.toLowerCase().includes(surname)) {
          overlapCount += 3
          matchedWords.push(surname)
        }
      }

      // Exact title substring match (e.g. "ATLAS Experiment", "LHC Machine", "Tile Calorimeter")
      const cleanTitle = entry.title.toLowerCase()
      if (cleanTitle.length > 5 && line.toLowerCase().includes(cleanTitle)) {
        overlapCount += 5
        matchedWords.push(`"${entry.title}"`)
      }

      if (overlapCount > maxOverlap) {
        maxOverlap = overlapCount
        bestMatchLine = line.trim().replace(/^[-*#\s]+/, "")
        matchReason = `Matches keywords: ${matchedWords.slice(0, 4).join(", ")}`
      }
    }

    if (maxOverlap >= 2 && bestMatchLine) {
      const confidence = Math.min(1.0, 0.4 + maxOverlap * 0.12)
      suggestions.push({
        bibKey: entry.key,
        entry,
        targetBulletText: bestMatchLine,
        reason: matchReason,
        confidence,
      })
    }
  }

  // Sort by highest confidence
  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 4)
}

/**
 * Deep semantic citation suggestions via AI.
 */
export async function suggestCitationsWithAI(
  cardContent: string,
  entries: BibEntry[],
  cardTitle?: string
): Promise<SuggestedCitation[]> {
  if (!cardContent || entries.length === 0) return []

  const availableEntries = entries.map((e) => ({
    key: e.key,
    title: e.title,
    authors: e.authorString,
    year: e.year,
  }))

  const prompt = `You are an academic citation and scientific bibliography expert.
Analyze the following card content from a scientific poster/paper:
Card Title: "${cardTitle || "Untitled"}"
Card Content:
"""
${cardContent}
"""

Available Bibliography References:
${JSON.stringify(availableEntries, null, 2)}

Identify any statements, bullet points, experiments, datasets, theories, or claims in the card that should cite one of the available bibliography references, but are currently missing a \\cite{} citation.

Respond ONLY with a JSON array of suggested citations in this exact format:
[
  {
    "bibKey": "key_from_bibliography",
    "targetBulletText": "Snippet or bullet point text that should include the citation",
    "reason": "Short explanation of why this citation belongs here"
  }
]
If no citations are missing, return []`

  try {
    const rawJson = await generateAITextResponse("citation-suggest", {
      model: resolveAiModel("bibtex"),
      userPrompt: prompt,
      temperature: 0.1,
      signal: AbortSignal.timeout(AI_TIMEOUTS.bibtex),
    })

    const cleaned = rawJson.replace(/```json/gi, "").replace(/```/g, "").trim()
    const parsed = JSON.parse(cleaned)

    if (!Array.isArray(parsed)) return suggestCitationsForText(cardContent, entries)

    const entryMap = new Map<string, BibEntry>(entries.map((e) => [e.key, e]))
    const suggestions: SuggestedCitation[] = []

    for (const item of parsed) {
      if (item.bibKey && entryMap.has(item.bibKey)) {
        suggestions.push({
          bibKey: item.bibKey,
          entry: entryMap.get(item.bibKey)!,
          targetBulletText: item.targetBulletText || cardContent.slice(0, 60),
          reason: item.reason || "Relevant academic reference",
          confidence: 0.9,
        })
      }
    }

    return suggestions.length > 0 ? suggestions : suggestCitationsForText(cardContent, entries)
  } catch (err) {
    console.warn("AI citation suggestion failed, falling back to heuristic:", err)
    return suggestCitationsForText(cardContent, entries)
  }
}
