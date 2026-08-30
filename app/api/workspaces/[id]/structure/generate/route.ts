import { NextRequest, NextResponse } from "next/server"
import { rateLimitAsync } from "@/lib/rate-limit"
import { requireWorkspaceEditor } from "@/lib/auth"
import { loadSourceContext } from "@/lib/ai/context"
import { generateAIResponse } from "@/lib/ai/client"
import { StructureGenerationSchema } from "@/lib/ai/contracts"
import { buildDefaultStructure, OutputType } from "@/lib/output-types"
import { resolveAiModel, AI_TIMEOUTS } from "@/lib/ai/models"
import { wrapUntrustedContext } from "@/lib/ai/prompts"

// ─── Per-type structural constraints ─────────────────────────────────────────

function clampCount(outputType: OutputType, count: number | undefined): number {
  if (outputType === "poster") return count && count >= 3 ? Math.min(count, 15) : 9
  if (outputType === "slides") return count && count >= 3 ? Math.min(count, 25) : 10
  // paper: count = number of sections (Abstract + body + Conclusion + References)
  return count && count >= 3 ? Math.min(count, 12) : 6
}

/**
 * Build a targeted structure-generation prompt for each output type.
 */
function buildPrompt(outputType: OutputType, n: number, sourceContext: string): string {
  const src = sourceContext.slice(0, 50_000)
  const wrappedSource = wrapUntrustedContext("Source Material", src)

  if (outputType === "slides") {
    const contentSlides = n - 2
    return `You are an expert scientific presenter. Analyze the source documents and design a ${n}-slide presentation deck.

${wrappedSource}

The presentation must have EXACTLY ${n} slides in this order:
1. Slide 1: Title slide — always title "Title Slide", pattern "title-slide". (No column needed.)
2. Slides 2 to ${n - 1}: EXACTLY ${contentSlides} content slides, each covering ONE distinct scientific topic from the sources. Assign each slide a specific, descriptive title (not generic — e.g. "Lattice QCD: Discretisation Scheme", not just "Methodology"). Vary patterns: prefer "bullets" for conceptual slides, "bullets-image" for visual/diagrammatic content, "figure-slide" for result figures, "two-column" for comparisons.
3. Slide ${n}: References — always title "References", pattern "references". (No column needed.)

RULES:
- Output EXACTLY ${n} slides.
- Each content slide covers a DIFFERENT topic — no duplicates.
- Titles must reflect the actual paper content, not placeholder names.
- Do NOT include column values (slides do not use columns).
- Valid patterns: "title-slide", "bullets", "bullets-image", "figure-slide", "two-column", "references".

Respond EXACTLY with JSON:
{
  "cards": [
    { "title": "Title Slide", "pattern": "title-slide" },
    { "title": "Specific Topic Title", "pattern": "bullets" },
    ...
    { "title": "References", "pattern": "references" }
  ]
}`
  }

  if (outputType === "paper") {
    const bodySections = n - 2
    return `You are an expert academic writer. Analyze the source documents and design a ${n}-section academic paper structure.

${wrappedSource}

The paper must have EXACTLY ${n} sections:
1. Section 1: "Abstract" — always pattern "section". (No column or number prefix.)
2. Sections 2 to ${n - 1}: EXACTLY ${bodySections} numbered body sections. Number them starting from 1 (e.g. "1 Introduction", "2 Related Work", "3 Proposed Method"). Each section covers a distinct academic topic drawn from the source material. Use concrete, paper-specific titles. Assign pattern "section" for prose sections, "section-figure" when the section involves a key diagram/figure, "section-table" when it involves tabular results.
3. Section ${n}: "References" — always pattern "references". (No column.)

RULES:
- Output EXACTLY ${n} sections.
- Titles for body sections MUST be numbered starting from 1.
- Titles must reflect the actual paper content (e.g. "3 Equivariant Graph Neural Networks" not just "3 Methodology").
- Do NOT include column values (papers do not use columns).
- Valid patterns: "section", "section-figure", "section-table", "section-two-figures", "references".

Respond EXACTLY with JSON:
{
  "cards": [
    { "title": "Abstract", "pattern": "section" },
    { "title": "1 Introduction", "pattern": "section" },
    ...
    { "title": "References", "pattern": "references" }
  ]
}`
  }

  // POSTER: n cards across 3 columns. Column 3 ends with References.
  const basePerCol = Math.floor(n / 3)
  const remainder = n % 3
  const col1Count = basePerCol + (remainder >= 1 ? 1 : 0)
  const col2Count = basePerCol + (remainder === 2 ? 1 : 0)
  const col3Count = n - col1Count - col2Count // includes References

  return `You are an expert scientific poster designer. Analyze the source documents and design a ${n}-card academic poster distributed across 3 columns.

${wrappedSource}

The poster must have EXACTLY ${n} cards with this column distribution:
- Column 1 (${col1Count} cards): Left column — introductory content: motivation, problem statement, background theory, prior work.
- Column 2 (${col2Count} cards): Middle column — the core scientific contribution: methodology, system architecture, experimental setup, key algorithms.
- Column 3 (${col3Count} cards): Right column — findings and conclusions: results, evaluation, discussion, conclusion. The LAST card in column 3 MUST be "References" with pattern "references".

For each card:
- Assign a specific, descriptive title based on the actual paper content (e.g. "Equivariant Architecture Design", not just "Methodology").
- Assign a pattern: "bullets" for concept/text cards, "bullets-image" if a figure is likely shown, "bullets-table" if results are tabular, "image-focused" for a pure figure card, "references" for the bibliography card.
- Set "column" to 1, 2, or 3.

RULES:
- Output EXACTLY ${n} cards.
- Distribute as: ${col1Count} in column 1, ${col2Count} in column 2, ${col3Count} in column 3.
- Last card MUST be { "title": "References", "pattern": "references", "column": 3 }.
- Valid patterns: "bullets", "bullets-image", "bullets-two-images", "bullets-table", "image-focused", "references".

Respond EXACTLY with JSON:
{
  "cards": [
    { "title": "Specific Topic", "pattern": "bullets", "column": 1 },
    ...
    { "title": "References", "pattern": "references", "column": 3 }
  ]
}`
}

// ─── Route handler ────────────────────────────────────────────────────────────

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

  const { allowed, retryAfterMs } = await rateLimitAsync(`${userId}:structure`, 10, 60_000)
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limited", retryAfterMs },
      { status: 429, headers: { "Retry-After": Math.ceil(retryAfterMs / 1000).toString() } }
    )
  }


  try {
    const body = await req.json()
    const outputType = (body.outputType || "poster") as OutputType
    const count = typeof body.count === "number" ? body.count : undefined
    const sourceIds = Array.isArray(body.sourceIds) ? body.sourceIds : undefined

    const n = clampCount(outputType, count)

    // 1. Load source context
    const sourceContext = await loadSourceContext({ workspaceId, sourceIds })

    // No sources → static fallback
    if (!sourceContext || sourceContext.trim() === "") {
      return NextResponse.json({ cards: buildDefaultStructure(outputType, n) })
    }

    const prompt = buildPrompt(outputType, n, sourceContext)

    try {
      const parsedData = await generateAIResponse("generate-structure", {
        model: resolveAiModel("structure"),
        userPrompt: prompt,
        schema: StructureGenerationSchema,
        signal: AbortSignal.timeout(AI_TIMEOUTS.structure),
      })

      if (parsedData?.cards && Array.isArray(parsedData.cards) && parsedData.cards.length > 0) {
        let cards = parsedData.cards

        // Enforce exact requested count N
        const defaultCards = buildDefaultStructure(outputType, n)
        if (cards.length > n) {
          // Keep first n-1 and ensure the last card is References
          const sliced = cards.slice(0, n - 1)
          const lastRef = cards.find(c => c.pattern === "references") || {
            title: "References",
            pattern: "references" as const,
            column: outputType === "poster" ? 3 : undefined,
          }
          cards = [...sliced, lastRef]
        } else if (cards.length < n) {
          // Pad missing cards from default structure
          const diff = n - cards.length
          const nonRefDefault = defaultCards.filter(c => c.pattern !== "references")
          const padding = nonRefDefault.slice(0, diff).map(p => ({
            title: p.title,
            pattern: p.pattern as typeof cards[number]["pattern"],
            column: p.column,
          }))
          const refCard = cards.find(c => c.pattern === "references") || {
            title: "References",
            pattern: "references" as const,
            column: outputType === "poster" ? 3 : undefined,
          }
          cards = [...cards.filter(c => c.pattern !== "references"), ...padding, refCard]
        }

        // Safety: ensure last card is always References
        if (cards[cards.length - 1]?.pattern !== "references") {
          const lastCol = outputType === "poster" ? 3 : undefined
          cards[cards.length - 1] = { title: "References", pattern: "references" as const, column: lastCol }
        }

        // For posters: re-assign columns to ensure exact column distribution
        if (outputType === "poster") {
          const total = cards.length
          const bpc = Math.floor(total / 3)
          const rem = total % 3
          const c1 = bpc + (rem >= 1 ? 1 : 0)
          const c2 = bpc + (rem === 2 ? 1 : 0)

          cards = cards.map((c, i) => {
            const assignedCol: 1 | 2 | 3 = i < c1 ? 1 : i < c1 + c2 ? 2 : 3
            return { ...c, column: assignedCol }
          })
        }

        // For slides and papers: strip any column values (they don't use columns)
        if (outputType === "slides" || outputType === "paper") {
          cards = cards.map(({ column: _col, ...rest }) => rest)
        }

        return NextResponse.json({ cards })
      }
    } catch (aiErr) {
      console.warn("AI structure generation failed, using static fallback:", aiErr)
    }

    // Static fallback
    return NextResponse.json({ cards: buildDefaultStructure(outputType, n) })
  } catch (err: unknown) {
    if (err instanceof Response) return err
    console.error("Structure generation failed:", err)
    return NextResponse.json(
      { error: "Failed to generate structure" },
      { status: 500 }
    )
  }
}
