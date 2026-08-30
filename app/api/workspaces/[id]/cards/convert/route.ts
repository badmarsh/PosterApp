import { NextRequest, NextResponse } from "next/server"
import { rateLimitAsync } from "@/lib/rate-limit"
import { requireWorkspaceEditor } from "@/lib/auth"
import { generateAIResponse } from "@/lib/ai/client"
import { CardGenerationSchema } from "@/lib/ai/contracts"
import { resolveAiModel, AI_TIMEOUTS } from "@/lib/ai/models"
import { buildCitationInstruction, buildGroundingInstruction, wrapUntrustedContext } from "@/lib/ai/prompts"

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

  const { allowed, retryAfterMs } = await rateLimitAsync(`${userId}:convert`, 10, 60_000)
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limited", retryAfterMs },
      { status: 429, headers: { "Retry-After": Math.ceil(retryAfterMs / 1000).toString() } }
    )
  }

  try {
    const body = await req.json()
    const { sourceContent, sourceTopic, sourceType, targetType, characterLimit = 300, bibKeys = [] } = body

    if (!sourceContent) {
      return NextResponse.json({ error: "sourceContent is required" }, { status: 400 })
    }

    const validTypes = ["poster", "slides", "paper"]
    if (!validTypes.includes(sourceType) || !validTypes.includes(targetType)) {
      return NextResponse.json({ error: "Invalid sourceType or targetType" }, { status: 400 })
    }

    const typeLabelMap = {
      poster: "a scientific poster",
      slides: "presentation slides",
      paper: "an academic paper",
    }

    const targetLabel = typeLabelMap[targetType as keyof typeof typeLabelMap] || "a document"

    let formatInstruction = ""
    if (targetType === "paper") {
      formatInstruction = `Rewrite the following ${sourceType} content into a full academic prose paragraph. Expand the points with complete sentences. Do not add new facts.`
    } else if (targetType === "slides") {
      formatInstruction = `Condense the following ${sourceType} content into 3-5 very short, punchy bullet points for a presentation slide. Each bullet must be at most 1 sentence.`
    } else {
      formatInstruction = `Summarize the following ${sourceType} content into 3-5 terse bullet points for a scientific poster. Each bullet should be no longer than 1-2 sentences.`
    }

    const formatConstraint =
      targetType === "paper"
        ? `- Write cohesive academic paragraphs. Return the paragraphs as an array of strings (one string per paragraph) in the "bullets" JSON field. Do not use markdown bullet syntax (*), just return raw paragraphs.`
        : `- Write short bullets as instructed.`

    const groundingInstruction = buildGroundingInstruction()
    const citationInstruction = buildCitationInstruction(bibKeys)
    const boundedContent = typeof sourceContent === "string" ? sourceContent.slice(0, 20_000) : ""
    const wrappedContent = wrapUntrustedContext(
      "Source Content",
      `Topic: ${sourceTopic || "Untitled"}\nText:\n${boundedContent}`
    )

    const prompt = `You are an expert academic assistant tasked with rewriting content for ${targetLabel}.

${wrappedContent}

<Valid Cite Keys>
${JSON.stringify(bibKeys)}
</Valid Cite Keys>


${formatInstruction}

IMPORTANT constraints:
- ${groundingInstruction}
- ${citationInstruction}
- The TOTAL combined length of all text you generate MUST be strictly around ${characterLimit} characters to fit the physical constraints of the ${targetType} layout.
${formatConstraint}

Respond EXACTLY in this JSON format with no markdown wrappers:
{
  "title": "The topic title (keep it similar to original)",
  "bullets": ["Point 1...", "Point 2..."]
}`

    const parsedData = await generateAIResponse("convert", {
      model: resolveAiModel("convert"),
      userPrompt: prompt,
      schema: CardGenerationSchema,
      signal: AbortSignal.timeout(AI_TIMEOUTS.generation),
    })

    const totalLength = (parsedData.bullets || []).join(" ").length
    const isOverBudget = characterLimit > 0 && totalLength > characterLimit * 1.4

    return NextResponse.json({
      ...parsedData,
      overBudget: isOverBudget,
    })
  } catch (err: unknown) {
    if (err instanceof Response) return err
    console.error("Card conversion failed:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to convert card content" },
      { status: 500 }
    )
  }
}
