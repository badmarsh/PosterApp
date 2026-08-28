import { NextRequest, NextResponse } from "next/server"
import type { Card } from "@/lib/poster-types"
import { extractCiteKeys } from "@/lib/bib-parser"
import { rateLimit } from "@/lib/rate-limit"
import { requireWorkspaceEditor } from "@/lib/auth"
import { loadSourceContext } from "@/lib/ai/context"
import { generateAIResponse } from "@/lib/ai/client"
import { ReviewTipsSchema } from "@/lib/ai/contracts"

function buildLintReport(cards: Card[], bibKeys: string[]) {
  const missingCites = new Set<string>()
  const usedCites = new Set<string>()
  
  const emptyCaptions: { cardId: string, figId: string }[] = []
  const emptyCards: string[] = []
  const layoutOverflows: string[] = []

  // 1. Citation and Layout Audit
  for (const card of cards) {
    // Audit Content for cites
    const textParts = [card.content]
    if (card.table?.caption) textParts.push(card.table.caption)
    if (card.figures) {
      card.figures.forEach(f => { if (f.caption) textParts.push(f.caption) })
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
        layoutOverflows.push(`${card.id}: ${card.content.length} chars vs budget of ~${Math.floor((card.heightBudget / 14) * 60)} chars`)
      }
    }
  }
  
  const unusedBibKeys = bibKeys.filter(k => !usedCites.has(k))

  return {
    missingCites: Array.from(missingCites),
    unusedBibKeys,
    emptyCaptions,
    emptyCards,
    layoutOverflows
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await params
  
  if (!/^[a-zA-Z0-9_-]+$/.test(workspaceId)) {
    return NextResponse.json({ error: 'Invalid workspace ID' }, { status: 400 })
  }

  let userId: string;
  try {
    const access = await requireWorkspaceEditor(workspaceId);
    userId = access.userId;
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { allowed, retryAfterMs } = rateLimit(`${userId}:review`, 5, 60_000)
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limited', retryAfterMs }, { status: 429, headers: { 'Retry-After': Math.ceil(retryAfterMs / 1000).toString() } })
  }

  try {
    const body = await req.json()
    const { bibContent, bibKeys = [], cards = [], title, authors, venue, templateName } = body

    const lintReport = buildLintReport(cards, bibKeys)
    
    // Load source markdown from disk deterministically
    const sourceSnippets = await loadSourceContext({ workspaceId, maxChars: 60_000 });

    const fullCardContents = cards.map((c: Card) => {
      let content = `[${c.id}] | column ${c.column} | pattern: ${c.pattern} | height budget: ${c.heightBudget || "N/A"}\n`
      content += `Title: ${c.title}\n`
      content += `Content (FULL):\n${c.content}\n`
      if (c.figures && c.figures.length > 0) {
        content += `Figures:\n`
        for (const f of c.figures) {
          content += `  - [${f.id}]: caption="${f.caption}" url=${f.url}\n`
        }
      }
      if (c.table && c.table.caption) {
        content += `Table caption: "${c.table.caption}"\n`
      }
      return content
    }).join("\n\n")

    const systemPrompt = `You are a scientific poster reviewer. You have access to the source documents
and bibliography provided below. Every factual concern you raise must be traceable to a specific
source snippet or bib entry included in this prompt. If you cannot verify a claim from the
provided sources, do not flag it as a grounding error — instead focus on style, clarity, and
citation correctness.`

    const userPrompt = `=== POSTER METADATA ===
Title: ${title || "N/A"}
Authors: ${authors || "N/A"}
Venue: ${venue || "N/A"}

=== SOURCE DOCUMENTS (ground truth corpus) ===
The following is the full text extracted from the user's uploaded PDF files.
You may ONLY use these as factual references.

${sourceSnippets || "No source documents found. Focus only on lint report and card structure."}

=== BIBLIOGRAPHY ===
Available cite keys: [${bibKeys.join(", ")}]
Full .bib:
${bibContent || "No bibliography provided."}

=== PRE-COMPUTED LINT REPORT (deterministic, always accurate) ===
- \\cite{} keys used in poster but MISSING from bib: ${lintReport.missingCites.length > 0 ? lintReport.missingCites.join(", ") : "none"}
- Bib keys defined but NEVER cited anywhere: ${lintReport.unusedBibKeys.length > 0 ? lintReport.unusedBibKeys.join(", ") : "none"}
- Figure captions that are empty: ${lintReport.emptyCaptions.length > 0 ? lintReport.emptyCaptions.map(e => `${e.cardId} -> ${e.figId}`).join(", ") : "none"}
- Cards with no content at all: ${lintReport.emptyCards.length > 0 ? lintReport.emptyCards.join(", ") : "none"}
- Estimated layout overflows (chars vs budget): ${lintReport.layoutOverflows.length > 0 ? "\n  " + lintReport.layoutOverflows.join("\n  ") : "none"}

=== FULL CARD CONTENTS ===
${fullCardContents || "No cards provided."}

=== REVIEW TASK ===
Review the poster cards against the source documents above.
For each issue found, output a JSON tip with:
- severity: "error" | "warning" | "info"
- category: "citation" | "typo" | "figure" | "layout" | "content" | "grounding"
- message: one actionable sentence (mention the card title or specific text)

Use category "grounding" when a specific factual claim in a card cannot be
verified against any provided source snippet.

Return EXACTLY (no markdown wrappers):
{"tips": [{"severity":"...", "category":"...", "message":"..."}]}`

    const model = process.env.AI_REVIEW_MODEL || process.env.AI_MODEL || "gemini-3-flash"

    const parsedData = await generateAIResponse("review", {
      model,
      systemPrompt,
      userPrompt,
      schema: ReviewTipsSchema,
      temperature: 0.1,
      signal: AbortSignal.timeout(180_000)
    });

    return NextResponse.json(parsedData)

  } catch (error: unknown) {
    if (error instanceof Response) return error;
    console.error("Error in AI Review:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal server error" }, { status: 500 })
  }
}
