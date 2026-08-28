import { NextRequest, NextResponse } from "next/server"
import { rateLimit } from "@/lib/rate-limit"
import { requireWorkspaceEditor } from "@/lib/auth"
import { loadSourceContext } from "@/lib/ai/context"
import { generateAIResponse } from "@/lib/ai/client"
import { CardGenerationSchema } from "@/lib/ai/contracts"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; cardId: string }> }
) {
  const { id: workspaceId, cardId } = await params
  
  if (!/^[a-zA-Z0-9_-]+$/.test(workspaceId) || !/^[a-zA-Z0-9_-]+$/.test(cardId)) {
    return NextResponse.json({ error: 'Invalid workspace or card ID' }, { status: 400 })
  }

  let userId: string;
  try {
    const access = await requireWorkspaceEditor(workspaceId);
    userId = access.userId;
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { allowed, retryAfterMs } = rateLimit(`${userId}:generate`, 10, 60_000)
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limited', retryAfterMs }, { status: 429, headers: { 'Retry-After': Math.ceil(retryAfterMs / 1000).toString() } })
  }

  try {
    const body = await req.json()
    const { topic, assets, sourceIds, characterLimit = 300, bibKeys = [], outputType = "poster" } = body

    if (!topic) {
      return NextResponse.json({ error: "Card topic is required" }, { status: 400 })
    }

    if (characterLimit <= 0) {
      return NextResponse.json({ 
        error: "No available space for this card. Please increase the height budget, free up space, or move it to another column before auto-filling." 
      }, { status: 400 })
    }

    // 1. Load source markdown files deterministically
    const sourceContext = await loadSourceContext({ workspaceId, sourceIds });

    if (!sourceContext) {
      return NextResponse.json({ error: "No parsed documents found in workspace. Please ingest PDFs first." }, { status: 400 })
    }

    // 2. Format available assets
    const availableAssets = (assets || []).map((a: {id: string, kind: string, caption?: string, snippet?: string, filename?: string}) => ({
      id: a.id,
      filename: a.filename,
      kind: a.kind,
      caption: a.caption,
      snippet: a.snippet
    }))

    // 3. Build prompt
    const isAutonomous = topic === "Untitled card" || topic.trim() === ""
    const typeLabel = outputType === "paper" ? "an academic paper" : outputType === "slides" ? "presentation slides" : "a scientific poster"
    const topicInstruction = isAutonomous 
      ? `The user has NOT specified a topic. You must autonomously analyze the <Source Material> and <Available Figures/Tables>, and decide on the most compelling scientific section to create for this ${outputType} (e.g., "Methodology", "Key Results", "Conclusion"). Choose the topic that has the most solid content and supporting figures.`
      : `The user explicitly wants a ${outputType} section about: "${topic}". You must focus ONLY on this topic.`

    const formatConstraint = outputType === "paper" 
      ? `- Write cohesive academic paragraphs. Return the paragraphs as an array of strings (one string per paragraph) in the "bullets" JSON field. Do not use markdown bullet syntax (*), just return raw paragraphs.`
      : outputType === "slides"
      ? `- Write very short, punchy bullet points suitable for presentation slides. Each bullet must be at most 1 sentence.`
      : `- Each bullet should be no longer than 1-2 sentences.`

    const prompt = `You are an expert academic assistant tasked with writing a section for ${typeLabel}.

<Source Material>
${sourceContext}
</Source Material>

<Available Figures/Tables>
${JSON.stringify(availableAssets, null, 2)}
</Available Figures/Tables>

<Valid Cite Keys>
${JSON.stringify(bibKeys)}
</Valid Cite Keys>

${topicInstruction}

IMPORTANT constraints:
- STRICT GROUNDING: You MUST base your content STRICTLY and ONLY on the provided <Source Material>. Do NOT use outside knowledge, do NOT search the web, and do NOT hallucinate facts.
- NO HALLUCINATED CITATIONS: If you use the \\cite{} command, you MUST ONLY use keys from the <Valid Cite Keys> array. If the array is empty, do not use citations.
- INLINE EQUATIONS: If the topic involves equations or math from the source text, you may reproduce them verbatim in the bullets as LaTeX math (e.g. $E=mc^2$ or $$...$$).
- The TOTAL combined length of all text you generate MUST be strictly around ${characterLimit} characters to fit the physical constraints of the ${outputType} layout.
${formatConstraint}

Also, review the available figures/tables. If any of them strongly support the points you made, assign them to 'figure1' or 'figure2'. You can assign up to 2 assets. To accurately identify the assets, look for their \`filename\` in the <Source Material>.

Respond EXACTLY in this JSON format with no markdown wrappers:
{
  "title": "The topic title you wrote about (e.g. 'Methods', 'Results')",
  "bullets": ["Point 1...", "Point 2..."],
  "assignedAssets": [
    { "slot": "figure1", "assetId": "..." },
    { "slot": "figure2", "assetId": "..." }
  ]
}`

    const model = process.env.AI_GENERATION_MODEL || process.env.AI_MODEL || "gemini-3-flash"

    const parsedData = await generateAIResponse("generate-card", {
      model,
      userPrompt: prompt,
      schema: CardGenerationSchema,
      signal: AbortSignal.timeout(180_000)
    });

    return NextResponse.json(parsedData)
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    console.error("Card generation failed:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate card content" },
      { status: 500 }
    )
  }
}
