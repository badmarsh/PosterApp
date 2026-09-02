import { NextRequest, NextResponse } from "next/server"
import { rateLimitAsync } from "@/lib/rate-limit"
import { requireWorkspaceEditor } from "@/lib/auth"
import { generateAIResponse } from "@/lib/ai/client"
import { ShrinkContentSchema } from "@/lib/ai/contracts"
import { loadSourceContext } from "@/lib/ai/context"
import { resolveAiModel, AI_TIMEOUTS } from "@/lib/ai/models"
import { wrapUntrustedContext } from "@/lib/ai/prompts"

import { z } from "zod"

const RequestBodySchema = z.object({
  content: z.string().min(1).max(50_000),
  warning: z.string().max(10_000).optional(),
  targetCharacters: z.number().int().positive().optional().default(200),
  sourceIds: z.array(z.string()).optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; cardId: string }> }
) {
  const { id: workspaceId, cardId } = await params

  if (!/^[a-zA-Z0-9_-]+$/.test(workspaceId) || !/^[a-zA-Z0-9_-]+$/.test(cardId)) {
    return NextResponse.json({ error: "Invalid workspace or card ID" }, { status: 400 })
  }

  let userId: string
  let workspace: any
  try {
    const access = await requireWorkspaceEditor(workspaceId)
    userId = access.userId
    workspace = access.workspace
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(req.url)
  const expectedRevision = url.searchParams.get("revision")

  if (expectedRevision && workspace.revision !== parseInt(expectedRevision, 10)) {
    return NextResponse.json({ error: "Stale revision" }, { status: 409 })
  }

  const { allowed, retryAfterMs } = await rateLimitAsync(`${userId}:shrink`, 10, 60_000)
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limited", retryAfterMs },
      { status: 429, headers: { "Retry-After": Math.ceil(retryAfterMs / 1000).toString() } }
    )
  }

  try {
    const rawBody = await req.json()
    const parsedBody = RequestBodySchema.safeParse(rawBody)
    if (!parsedBody.success) {
      return NextResponse.json({ error: "Invalid request payload", details: parsedBody.error.format() }, { status: 400 })
    }
    const { content, warning, targetCharacters, sourceIds } = parsedBody.data

    // Load source context to help the AI maintain facts while summarizing
    const sourceContext = await loadSourceContext({ workspaceId, sourceIds, maxChars: 30_000 })

    const systemPrompt = `You are an expert academic editor. The user's poster has a layout overflow issue in one of the cards.
Your task is to shrink/summarize the text so that it fits within the specified character budget without losing the core scientific message.
Do NOT remove or mutate any LaTeX figure or table commands unless explicitly requested by the user's warning.`

    const userPrompt = `${wrapUntrustedContext("Current Card Content", content)}

${wrapUntrustedContext("Layout Warning", warning || "The content is too long and overflows its container.")}

${wrapUntrustedContext("Source Context", sourceContext || "(No source context available)")}

${wrapUntrustedContext(
      "Task",
      `Shrink the text to be approximately ${targetCharacters} characters long.
Keep the same format (e.g., bullets if it was bullets, paragraphs if it was paragraphs).
Use the source context to ensure you don't hallucinate facts while summarizing.

Respond EXACTLY in this JSON format:
{
  "content": "The new, shrunk content..."
}`
    )}`

    const parsedData = await generateAIResponse("shrink", {
      model: resolveAiModel("shrink"),
      systemPrompt,
      userPrompt,
      schema: ShrinkContentSchema,
      signal: AbortSignal.timeout(AI_TIMEOUTS.shrink),
    })

    const isOverBudget = targetCharacters > 0 && parsedData.content.length > targetCharacters * 1.4

    return NextResponse.json({
      ...parsedData,
      overBudget: isOverBudget,
    })
  } catch (err: unknown) {
    if (err instanceof Response) return err
    console.error("Card shrink failed:", err)
    return NextResponse.json(
      { error: "Failed to shrink card content" },
      { status: 500 }
    )
  }
}
