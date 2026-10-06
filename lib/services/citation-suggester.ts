import { type BibEntry } from "@/lib/bib-types"
import { generateAITextResponse } from "@/lib/ai/client"
import { resolveAiModel, AI_TIMEOUTS } from "@/lib/ai/models"
import {
  suggestCitationsForText,
  type SuggestedCitation,
} from "./citation-matcher"

export { suggestCitationsForText, type SuggestedCitation } from "./citation-matcher"

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
