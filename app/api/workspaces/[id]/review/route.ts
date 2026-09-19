import { NextRequest, NextResponse } from "next/server"
import type { Card } from "@/lib/poster-types"
import { extractCiteKeys } from "@/lib/bib-parser"
import { rateLimitAsync } from "@/lib/rate-limit"
import { requireWorkspaceEditor } from "@/lib/auth"
import { loadSourceContext } from "@/lib/ai/context"
import { generateAIResponse } from "@/lib/ai/client"
import { ReviewTipsSchema } from "@/lib/ai/contracts"
import { parseAiModelOverrides, resolveAiModelWithOverrides, parseAiApiKey, AI_TIMEOUTS } from "@/lib/ai/models"
import { wrapUntrustedContext } from "@/lib/ai/prompts"
import { AI_CONFIG } from "@/lib/config/ai"
import { estimateHeight, validatePosterColumns } from "@/lib/latex"

const MAX_CARD_CHARS = 3_000
const MAX_ALL_CARDS_CHARS = 40_000
const MAX_BIB_CHARS = 20_000

function buildLintReport(cards: Card[], bibKeys: string[], templateId?: string | null) {
  const missingCites = new Set<string>()
  const usedCites = new Set<string>()

  const emptyCaptions: { cardId: string; figId: string }[] = []
  const emptyCards: string[] = []
  const pendingCards: string[] = []
  const layoutOverflows: string[] = []

  // 1. Citation and Layout Audit
  for (const card of cards) {
    if (card.validation === "pending") {
      pendingCards.push(`${card.id} ("${card.title || "Untitled"}")`)
      continue
    }

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

    // Audit Layout with the same structural model used by the editor. This
    // includes figures, tables, bullets, and explicit per-card targets.
    if (!card.content || card.content.trim() === "") {
      emptyCards.push(card.id)
    }
    if (typeof card.heightBudget === "number" && card.heightBudget > 0) {
      const estimatedHeight = estimateHeight(card)
      if (estimatedHeight > card.heightBudget) {
        layoutOverflows.push(
          `${card.id}: estimated ${estimatedHeight}u vs card budget ${card.heightBudget}u`
        )
      }
    }
  }

  // A collection of individually small cards can still overflow its column.
  for (const message of validatePosterColumns(cards, templateId)) {
    layoutOverflows.push(message.message)
  }

  const unusedBibKeys = bibKeys.filter((k) => !usedCites.has(k))

  return {
    missingCites: Array.from(missingCites),
    unusedBibKeys,
    emptyCaptions,
    emptyCards,
    pendingCards,
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
    const { bibContent, bibKeys = [], cards = [], title, authors, venue, templateName } = body

    const lintReport = buildLintReport(cards, bibKeys, templateName)

    // Load source markdown from disk deterministically (capped at 60k chars)
    const sourceSnippets = await loadSourceContext({ workspaceId, maxChars: AI_CONFIG.review.maxSourceChars })

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
      if (c.validation === "pending") {
        let entry = `[${c.id}] | column ${c.column} | pattern: ${c.pattern} | status: PENDING_PLACEHOLDER\n`
        entry += `Title: ${c.title}\n`
        entry += `Content: [PLACEHOLDER — no experiment has run yet. Excluded from claim evaluation.]\n`
        boundedCardEntries.push(entry)
        continue
      }

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
- Pending placeholder cards awaiting experiments: ${lintReport.pendingCards.length > 0 ? lintReport.pendingCards.join(", ") : "none"}
- Estimated layout overflows (chars vs budget): ${lintReport.layoutOverflows.length > 0 ? "\n  " + lintReport.layoutOverflows.join("\n  ") : "none"}`)}

${wrapUntrustedContext("Full Card Contents", fullCardContents || "No cards provided.")}

${wrapUntrustedContext("Review Task", `Review the poster cards against the source documents above.
Cards marked as PENDING_PLACEHOLDER are experimental stubs that have not run yet. Exclude them from grounding penalties and report them only as info-level stubs awaiting results.
For each issue found, output a JSON tip with:
- severity: "error" | "warning" | "info"
- category: "citation" | "typo" | "figure" | "layout" | "content" | "grounding"
- cardId: the exact bracketed id of the card the issue is in (e.g. "card_abc123"), or omit if the issue is poster-wide
- message: one actionable sentence (mention the card title or specific text)

Use category "grounding" when a specific factual claim in a non-placeholder card cannot be
verified against any provided source snippet.

Return EXACTLY (no markdown wrappers):
{"tips": [{"severity":"...", "category":"...", "cardId":"...", "message":"..."}]}`)}`

    try {
      const modelOverrides = parseAiModelOverrides(req.headers)
      const clientApiKey = parseAiApiKey(req.headers)
      const parsedData = await generateAIResponse("review", {
        model: resolveAiModelWithOverrides("review", modelOverrides),
        apiKey: clientApiKey,
        systemPrompt,
        userPrompt,
        schema: ReviewTipsSchema,
        temperature: 0.1,
        signal: AbortSignal.timeout(AI_TIMEOUTS.review),
      })

      const knownCardIds = new Set((cards as Card[]).map((c) => c.id))
      const tips = (parsedData.tips ?? []).map((t) => (t.cardId && !knownCardIds.has(t.cardId) ? { ...t, cardId: undefined } : t))

      return NextResponse.json({
        ...parsedData,
        tips,
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
      { error: "Failed to generate review" },
      { status: 500 }
    )
  }
}
