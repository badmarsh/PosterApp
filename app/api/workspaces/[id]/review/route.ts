import { NextRequest, NextResponse } from "next/server"
import type { Card } from "@/lib/poster-types"
import { extractCiteKeys } from "@/lib/bib-parser"
import { rateLimitAsync } from "@/lib/rate-limit"
import { requireWorkspaceEditor } from "@/lib/auth"
import { loadSourceContext } from "@/lib/ai/context"
import { generateAIResponse } from "@/lib/ai/client"
import { ReviewTipsSchema } from "@/lib/ai/contracts"
import { resolveAiModel, AI_TIMEOUTS } from "@/lib/ai/models"
import { wrapUntrustedContext } from "@/lib/ai/prompts"

const MAX_CARD_CHARS = 3_000
const MAX_ALL_CARDS_CHARS = 40_000
const MAX_BIB_CHARS = 20_000

function buildLintReport(cards: Card[], bibKeys: string[]) {
  const missingCites = new Set<string>()
  const usedCites = new Set<string>()

  const emptyCaptions: { cardId: string; figId: string }[] = []
  const emptyCards: string[] = []
  const layoutOverflows: string[] = []

  // 1. Citation and Layout Audit
  for (const card of cards) {
    // Audit Content for cites
    const textParts = [card.content || ""]
    if (card.table?.caption) textParts.push(card.table.caption)
    if (card.figures) {
      card.figures.forEach((f) => {
        if (f.caption) textParts.push(f.caption)
      })
    }
    const textToCheck = textParts.join("\n")
    const foundKeys = extractCiteKeys(textToCheck)

    for (const key of foundKeys) {
      usedCites.add(key)
      if (!bibKeys.includes(key)) {
        missingCites.add(key)
      }
    }

    // Audit Figures
    if (card.figures) {
      for (const fig of card.figures) {
        if (!fig.caption || fig.caption.trim() === "") {
          emptyCaptions.push({ cardId: card.id, figId: fig.id })
        }
      }
    }

    // Audit Layout
    if (!card.content || card.content.trim() === "") {
      emptyCards.push(card.id)
    } else if (card.heightBudget) {
      // Rough heuristic: 60 chars per line, 14 units per line
      const estimatedHeight = Math.ceil(card.content.length / 60) * 14
      if (estimatedHeight > card.heightBudget) {
        layoutOverflows.push(
          `${card.id}: ${card.content.length} chars vs budget of ~${Math.floor(
            (card.heightBudget / 14) * 60
          )} chars`
        )
      }
    }
  }

  const unusedBibKeys = bibKeys.filter((k) => !usedCites.has(k))

  return {
    missingCites: Array.from(missingCites),
    unusedBibKeys,
    emptyCaptions,
    emptyCards,
    layoutOverflows,
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await params

  if (!/^[a-zA-Z0-9_-]+$/.test(workspaceId)) {
    return NextResponse.json({ error: "Invalid workspace ID" }, { status: 400 })
  }

  let userId: string
  try {
    const access = await requireWorkspaceEditor(workspaceId)
    userId = access.userId
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { allowed, retryAfterMs } = await rateLimitAsync(`${userId}:review`, 5, 60_000)
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limited", retryAfterMs },
      { status: 429, headers: { "Retry-After": Math.ceil(retryAfterMs / 1000).toString() } }
    )
  }


  try {
    const body = await req.json()
    const { bibContent, bibKeys = [], cards = [], title, authors, venue } = body

    const lintReport = buildLintReport(cards, bibKeys)

    // Load source markdown from disk deterministically (capped at 60k chars)
    const sourceSnippets = await loadSourceContext({ workspaceId, maxChars: 60_000 })

    // Bound bibContent
    const rawBib = typeof bibContent === "string" ? bibContent : ""
    const boundedBibContent =
      rawBib.length > MAX_BIB_CHARS
        ? rawBib.slice(0, MAX_BIB_CHARS) + "\n\n[...bibliography truncated for length...]"
        : rawBib

    // Bound card contents
    let accumulatedLength = 0
    const boundedCardEntries: string[] = []
    for (const c of cards as Card[]) {
      const truncatedCardContent =
        (c.content || "").length > MAX_CARD_CHARS
          ? (c.content || "").slice(0, MAX_CARD_CHARS) + " [...truncated...]"
          : c.content || ""

      let entry = `[${c.id}] | column ${c.column} | pattern: ${c.pattern} | height budget: ${c.heightBudget || "N/A"}\n`
      entry += `Title: ${c.title}\n`
      entry += `Content:\n${truncatedCardContent}\n`
      if (c.figures && c.figures.length > 0) {
        entry += `Figures:\n`
        for (const f of c.figures) {
          entry += `  - [${f.id}]: caption="${(f.caption || "").slice(0, 300)}" url=${f.url}\n`
        }
      }
      if (c.table && c.table.caption) {
        entry += `Table caption: "${c.table.caption.slice(0, 300)}"\n`
      }

      if (accumulatedLength + entry.length > MAX_ALL_CARDS_CHARS) {
        boundedCardEntries.push("[...additional cards truncated for length...]")
        break
      }
      boundedCardEntries.push(entry)
      accumulatedLength += entry.length
    }
    const fullCardContents = boundedCardEntries.join("\n\n")

    const systemPrompt = `You are a scientific poster reviewer. You have access to the source documents
and bibliography provided below. Every factual concern you raise must be traceable to a specific
source snippet or bib entry included in this prompt. If you cannot verify a claim from the
provided sources, do not flag it as a grounding error — instead focus on style, clarity, and
citation correctness.`

    const userPrompt = `${wrapUntrustedContext("Poster Metadata", `Title: ${title || "N/A"}
Authors: ${authors || "N/A"}
Venue: ${venue || "N/A"}`)}

${wrapUntrustedContext("Source Documents", sourceSnippets || "No source documents found. Focus only on lint report and card structure.")}

${wrapUntrustedContext("Bibliography", `Available cite keys: [${bibKeys.join(", ")}]
Full .bib:
${boundedBibContent || "No bibliography provided."}`)}

${wrapUntrustedContext("Pre-computed Lint Report", `- \\cite{} keys used in poster but MISSING from bib: ${lintReport.missingCites.length > 0 ? lintReport.missingCites.join(", ") : "none"}
- Bib keys defined but NEVER cited anywhere: ${lintReport.unusedBibKeys.length > 0 ? lintReport.unusedBibKeys.join(", ") : "none"}
- Figure captions that are empty: ${lintReport.emptyCaptions.length > 0 ? lintReport.emptyCaptions.map((e) => `${e.cardId} -> ${e.figId}`).join(", ") : "none"}
- Cards with no content at all: ${lintReport.emptyCards.length > 0 ? lintReport.emptyCards.join(", ") : "none"}
- Estimated layout overflows (chars vs budget): ${lintReport.layoutOverflows.length > 0 ? "\n  " + lintReport.layoutOverflows.join("\n  ") : "none"}`)}

${wrapUntrustedContext("Full Card Contents", fullCardContents || "No cards provided.")}

${wrapUntrustedContext("Review Task", `Review the poster cards against the source documents above.
For each issue found, output a JSON tip with:
- severity: "error" | "warning" | "info"
- category: "citation" | "typo" | "figure" | "layout" | "content" | "grounding"
- message: one actionable sentence (mention the card title or specific text)

Use category "grounding" when a specific factual claim in a card cannot be
verified against any provided source snippet.

Return EXACTLY (no markdown wrappers):
{"tips": [{"severity":"...", "category":"...", "message":"..."}]}`)}`

    try {
      const parsedData = await generateAIResponse("review", {
        model: resolveAiModel("review"),
        systemPrompt,
        userPrompt,
        schema: ReviewTipsSchema,
        temperature: 0.1,
        signal: AbortSignal.timeout(AI_TIMEOUTS.review),
      })

      return NextResponse.json({
        ...parsedData,
        lintReport,
      })
    } catch (aiError) {
      console.warn("[review] AI Review failed, falling back to deterministic lint findings:", aiError)
      return NextResponse.json({
        tips: [],
        lintReport,
        aiUnavailable: true,
      })
    }
  } catch (error: unknown) {
    if (error instanceof Response) return error
    console.error("Error in Review route:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}
