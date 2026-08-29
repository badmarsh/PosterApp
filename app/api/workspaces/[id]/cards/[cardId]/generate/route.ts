import { NextRequest, NextResponse } from "next/server"
import { rateLimitAsync } from "@/lib/rate-limit"
import { requireWorkspaceEditor } from "@/lib/auth"
import { loadSourceContext } from "@/lib/ai/context"
import { generateAIResponse } from "@/lib/ai/client"
import { CardGenerationSchema } from "@/lib/ai/contracts"
import { resolveAiModel, AI_TIMEOUTS } from "@/lib/ai/models"
import { buildCitationInstruction, buildGroundingInstruction, wrapUntrustedContext } from "@/lib/ai/prompts"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; cardId: string }> }
) {
  const { id: workspaceId, cardId } = await params

  if (!/^[a-zA-Z0-9_-]+$/.test(workspaceId) || !/^[a-zA-Z0-9_-]+$/.test(cardId)) {
    return NextResponse.json({ error: "Invalid workspace or card ID" }, { status: 400 })
  }

  let userId: string
  try {
    const access = await requireWorkspaceEditor(workspaceId)
    userId = access.userId
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { allowed, retryAfterMs } = await rateLimitAsync(`${userId}:generate`, 10, 60_000)
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limited", retryAfterMs },
      { status: 429, headers: { "Retry-After": Math.ceil(retryAfterMs / 1000).toString() } }
    )
  }


  try {
    const body = await req.json()
    const { topic, assets, sourceIds, characterLimit = 300, bibKeys = [], outputType = "poster" } = body

    if (!topic) {
      return NextResponse.json({ error: "Card topic is required" }, { status: 400 })
    }

    if (characterLimit <= 0) {
      return NextResponse.json(
        {
          error: "No available space for this card. Please increase the height budget, free up space, or move it to another column before auto-filling.",
        },
        { status: 400 }
      )
    }

    // 1. Load source markdown files
    const sourceContext = await loadSourceContext({ workspaceId, sourceIds })

    if (!sourceContext) {
      return NextResponse.json(
        { error: "No parsed documents found in workspace. Please ingest PDFs first." },
        { status: 400 }
      )
    }

    // 2. Format available assets
    const availableAssets = (assets || []).map(
      (a: { id: string; kind: string; caption?: string; snippet?: string; filename?: string }) => ({
        id: a.id,
        filename: a.filename,
        kind: a.kind,
        caption: a.caption,
        snippet: a.snippet,
      })
    )

    // 3. Build output-type-specific prompt
    const isAutonomous = !topic || topic === "Untitled card" || topic.trim() === ""

    const prompt = buildCardPrompt({
      outputType,
      topic,
      isAutonomous,
      sourceContext,
      availableAssets,
      bibKeys,
      characterLimit,
    })

    const parsedData = await generateAIResponse("generate-card", {
      model: resolveAiModel("generation"),
      userPrompt: prompt,
      schema: CardGenerationSchema,
      signal: AbortSignal.timeout(AI_TIMEOUTS.generation),
    })

    // Soft check: check if total length massively exceeds characterLimit
    const totalLength = (parsedData.bullets || []).join(" ").length
    const isOverBudget = characterLimit > 0 && totalLength > characterLimit * 1.4

    return NextResponse.json({
      ...parsedData,
      overBudget: isOverBudget,
    })
  } catch (err: unknown) {
    if (err instanceof Response) return err
    console.error("Card generation failed:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate card content" },
      { status: 500 }
    )
  }
}

// ─── Per-type card content prompts ───────────────────────────────────────────

interface CardPromptOptions {
  outputType: string
  topic: string
  isAutonomous: boolean
  sourceContext: string
  availableAssets: object[]
  bibKeys: string[]
  characterLimit: number
}

function buildCardPrompt(opts: CardPromptOptions): string {
  const { outputType, topic, isAutonomous, sourceContext, availableAssets, bibKeys, characterLimit } = opts

  const topicInstruction = isAutonomous
    ? `The card title is unspecified or generic. Autonomously choose the most compelling scientific topic from the source material that has not yet been covered elsewhere, and write about it.`
    : `Write the content for the card titled: "${topic}". Stay strictly on this topic.`

  const citeNote = buildCitationInstruction(bibKeys)
  const groundingRule = buildGroundingInstruction()
  const wrappedSource = wrapUntrustedContext("Source Material", sourceContext)

  // ─── POSTER card ────────────────────────────────────────────────────────
  if (outputType === "poster") {
    return `You are an expert scientific poster author.

${wrappedSource}

<Available Figures/Tables>
${JSON.stringify(availableAssets, null, 2)}
</Available Figures/Tables>

<Valid Cite Keys>
${JSON.stringify(bibKeys)}
</Valid Cite Keys>

${topicInstruction}

POSTER CARD WRITING RULES:
- ${groundingRule}
- Write 3–6 concise bullet points. Each bullet = 1–2 sentences max. Dense, information-rich.
- Prefer quantitative claims where the source provides numbers (e.g. "Achieves 94.2% accuracy on X benchmark").
- You may include brief inline LaTeX math if the topic involves formulas from the source (e.g. $\\mathcal{L} = ...$).
- The TOTAL character count of all bullets combined must be around ${characterLimit} characters to fit the poster column.
- ${citeNote}

Figure assignment: If any figure/table in <Available Figures/Tables> directly supports this card's topic, assign up to 2.

Respond EXACTLY in this JSON format (no markdown wrapper):
{
  "title": "Refined card title (keep close to original topic)",
  "bullets": ["Bullet 1...", "Bullet 2...", ...],
  "assignedAssets": [
    { "slot": "figure1", "assetId": "..." }
  ]
}`
  }

  // ─── SLIDES card ────────────────────────────────────────────────────────
  if (outputType === "slides") {
    return `You are an expert scientific presenter writing slide content.

${wrappedSource}

<Available Figures/Tables>
${JSON.stringify(availableAssets, null, 2)}
</Available Figures/Tables>

<Valid Cite Keys>
${JSON.stringify(bibKeys)}
</Valid Cite Keys>

${topicInstruction}

PRESENTATION SLIDE WRITING RULES:
- ${groundingRule}
- Write 4–6 bullet points. Each bullet must be a SHORT, punchy statement — ideally 1 sentence, max 15 words. Suitable for reading at a glance.
- Think "slide bullets", not essay prose. Each bullet = one clear takeaway or fact.
- Quantitative results are highly valued (e.g. "97% efficiency gain over baseline").
- You may use brief inline LaTeX math if the slide topic involves an equation (e.g. $E = mc^2$).
- The TOTAL character count of all bullets combined must be around ${characterLimit} characters.
- ${citeNote}
- Do NOT write long sentences or full paragraphs.

Figure assignment: Assign a figure/table if it directly illustrates the slide's key point.

Respond EXACTLY in this JSON format (no markdown wrapper):
{
  "title": "Refined slide title",
  "bullets": ["Short bullet 1", "Short bullet 2", ...],
  "assignedAssets": [
    { "slot": "figure1", "assetId": "..." }
  ]
}`
  }

  // ─── PAPER section ───────────────────────────────────────────────────────
  return `You are an expert academic writer writing a section of a research paper.

${wrappedSource}

<Available Figures/Tables>
${JSON.stringify(availableAssets, null, 2)}
</Available Figures/Tables>

<Valid Cite Keys>
${JSON.stringify(bibKeys)}
</Valid Cite Keys>

${topicInstruction}

ACADEMIC PAPER SECTION WRITING RULES:
- ${groundingRule}
- Write 2–4 coherent academic paragraphs. Each paragraph = one string in the "bullets" array.
- Use formal academic prose: no bullet points or markdown syntax inside the text.
- You may use inline LaTeX math to reproduce equations from the source verbatim (e.g. $\\mathcal{L}_{total} = ...$).
- ${citeNote}
- The TOTAL character count of all paragraphs combined must be around ${characterLimit} characters.
- If this is the Abstract section: write a single compact paragraph summarising objectives, methods, and results.
- If this is an Introduction: motivate the problem, state the research gap, and outline the paper structure.
- If this is a Methods/Architecture section: describe the technical approach precisely.
- If this is a Results section: report quantitative findings with numbers and comparisons.

Figure assignment: If a figure or table in <Available Figures/Tables> is referenced or supports this section, assign it.

Respond EXACTLY in this JSON format (no markdown wrapper). Return paragraphs as plain prose strings — no bullet asterisks (*):
{
  "title": "Section title (keep numbered prefix if original had one, e.g. '3 Methodology')",
  "bullets": ["Full paragraph 1...", "Full paragraph 2...", ...],
  "assignedAssets": [
    { "slot": "figure1", "assetId": "..." }
  ]
}`
}

