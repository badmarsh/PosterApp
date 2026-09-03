import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { readJsonBodyCapped, PayloadTooLargeError } from "@/lib/security"
import { rateLimitAsync } from "@/lib/rate-limit"
import { requireWorkspaceEditor } from "@/lib/auth"
import { generateAITextResponse } from "@/lib/ai/client"
import { loadSourceContext } from "@/lib/ai/context"
import { validateCard } from "@/lib/latex/validation"
import { parseAiModelOverrides, resolveAiModelWithOverrides, AI_TIMEOUTS } from "@/lib/ai/models"
import { buildCitationInstruction, wrapUntrustedContext } from "@/lib/ai/prompts"
import type { Card } from "@/lib/poster-types"

const MAX_SOURCE_CHARS = 40_000
const MAX_HISTORY_MESSAGES = 20
const MAX_HISTORY_CHARS = 40_000

const MAX_CHAT_BODY_BYTES = 12 * 1024 * 1024 // covers a few images at 3 MB each
const MAX_IMAGES_PER_MESSAGE = 4
const MAX_IMAGE_CHARS = 4 * 1024 * 1024 // ~3 MB binary, base64-encoded

const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.union([z.string().max(200_000), z.array(z.unknown()).max(50)]),
  images: z
    .array(
      z
        .string()
        .max(MAX_IMAGE_CHARS)
        .refine((v) => v.startsWith("data:image/") || /^[A-Za-z0-9+/=\s]+$/.test(v), {
          message: "images must be data:image/* URLs or base64",
        })
    )
    .max(MAX_IMAGES_PER_MESSAGE)
    .optional(),
})
const ChatBodySchema = z.object({
  messages: z.array(ChatMessageSchema).min(1).max(100),
  selectedCardId: z.string().max(128).optional(),
})
type ChatMessage = z.infer<typeof ChatMessageSchema>

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await params

  if (!/^[a-zA-Z0-9_-]+$/.test(workspaceId)) {
    return NextResponse.json({ error: "Invalid workspace ID" }, { status: 400 })
  }

  let userId: string
  let workspace: Awaited<ReturnType<typeof requireWorkspaceEditor>>["workspace"]
  try {
    const access = await requireWorkspaceEditor(workspaceId)
    userId = access.userId
    workspace = access.workspace
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { allowed, retryAfterMs } = await rateLimitAsync(`${userId}:chat`, 20, 60_000)
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limited", retryAfterMs },
      {
        status: 429,
        headers: { "Retry-After": Math.ceil(retryAfterMs / 1000).toString() },
      }
    )
  }


  try {
    let rawBody: unknown
    try {
      rawBody = await readJsonBodyCapped(req, MAX_CHAT_BODY_BYTES)
    } catch (bodyErr) {
      if (bodyErr instanceof PayloadTooLargeError) {
        return NextResponse.json({ error: "Payload too large" }, { status: 413 })
      }
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    const parsedBody = ChatBodySchema.safeParse(rawBody)
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsedBody.error.format() },
        { status: 400 }
      )
    }
    const { messages, selectedCardId }: { messages: ChatMessage[]; selectedCardId?: string } = parsedBody.data

    // Fetch full active output
    const full = await (await import("@/lib/prisma")).prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { outputs: { include: { cards: true } } },
    })
    const activeOutput = full?.outputs?.find((o) => o.isActive) || full?.outputs?.[0]
    const cards = activeOutput?.cards || []

    // 2. Build card list summary
    const cardListSummary = cards
      .sort((a, b) => (a.column || 0) - (b.column || 0) || a.order - b.order)
      .map(
        (c) =>
          `  [${c.id}] Col ${c.column || "N/A"} | "${c.title}" | pattern: ${c.pattern}`
      )
      .join("\n")

    // 3. Selected card full content
    let selectedCardContext = ""
    if (selectedCardId) {
      const card = cards.find((c) => c.id === selectedCardId)
      if (card) {
        const col = card.column === 1 || card.column === 2 || card.column === 3 ? card.column : null
        const frontendCard: Card = {
          id: card.id,
          title: card.title,
          column: col,
          order: card.order,
          pattern: card.pattern as Card["pattern"],
          content: card.content || "",
          table: (card.table && typeof card.table === "object" ? card.table : { rows: [] }) as Card["table"],
          figures: (Array.isArray(card.figures) ? card.figures : []) as Card["figures"],
          figureLayout: (card.figureLayout || "single") as Card["figureLayout"],
          validation: (card.validation || "valid") as Card["validation"],
          heightBudget: card.heightBudget,
          slideNotes: card.slideNotes || undefined,
        }

        const validationMessages = validateCard(frontendCard)
        const validationText =
          validationMessages.length > 0
            ? `\n\n` + wrapUntrustedContext(
                "Validation Errors",
                validationMessages.map((m) => `- [${m.level}] ${m.field}: ${m.message}`).join("\n")
              )
            : ""

        selectedCardContext = wrapUntrustedContext(
          "Currently Selected Card",
          `ID: ${card.id}
Title: ${card.title}
Column: ${card.column || "N/A"}, Order: ${card.order}
Pattern: ${card.pattern}
Content:
${card.content || "(empty)"}
Height budget: ${card.heightBudget ?? "N/A"}${validationText}`
        )
      }
    }

    // 4. Bibliography & citations context
    let bibKeys: string[] = []
    if (Array.isArray(workspace.bibKeys)) {
      bibKeys = (workspace.bibKeys as unknown[]).filter((k): k is string => typeof k === "string")
    } else if (typeof workspace.bibKeys === "string") {
      try {
        const parsed = JSON.parse(workspace.bibKeys)
        if (Array.isArray(parsed)) {
          bibKeys = parsed.filter((k): k is string => typeof k === "string")
        }
      } catch {}
    }
    const bibSummary = workspace.bibContent ? workspace.bibContent.slice(0, 10_000) : ""
    const citationRule = buildCitationInstruction(bibKeys)

    // 5. Load source markdown snippets
    const sourceSnippets = await loadSourceContext({ workspaceId, maxChars: MAX_SOURCE_CHARS })

    const outputType = activeOutput?.outputType || "poster"
    const docTypeLabel =
      outputType === "paper"
        ? "scientific paper"
        : outputType === "slides"
        ? "slides presentation"
        : "scientific poster"
    const editorLabel =
      outputType === "paper"
        ? "scientific paper editor"
        : outputType === "slides"
        ? "slides editor"
        : "scientific poster editor"

    // 6. System prompt
    const systemPrompt = `You are a helpful AI assistant integrated into PosterApp, a ${editorLabel}.
You help researchers write, refine, and improve their academic ${docTypeLabel} content.

${wrapUntrustedContext("Current Workspace", `Project Title: ${activeOutput?.title || workspace.name}
Authors: ${workspace.authors || "N/A"}
Venue: ${workspace.venue || "N/A"}
Template: ${activeOutput?.templateId || "N/A"}
Output Type: ${outputType}`)}

${wrapUntrustedContext("Bibliography & Citations", `Valid cite keys: ${JSON.stringify(bibKeys)}
${bibSummary ? `BibTeX references:\n${bibSummary}` : "No bibliography ingested yet."}
Citation rule: ${citationRule}`)}

${wrapUntrustedContext("Document Structure", cardListSummary || "No cards yet.")}
${selectedCardContext ? `${selectedCardContext}\n` : ""}${wrapUntrustedContext("Source Documents", sourceSnippets || "No source documents ingested yet.")}

When the user asks you to modify a card, provide the suggested text directly in your reply.
Keep responses EXTREMELY concise and actionable. Do NOT use conversational filler (e.g. no "Here is the fixed text", no "I can help with that").
Prefer bullet points for suggestions.
If asked about specific content, base your answer on the source documents and current card content above.

If the CURRENTLY SELECTED CARD has VALIDATION ERRORS, your primary goal is to provide a fix for those errors using the <fix> tag.
If you are suggesting a fix or replacement for the CURRENTLY SELECTED CARD, you MUST provide the new content inside a special XML tag <fix>...</fix>.
Example:
<fix>
* Fixed bullet point 1
* Fixed bullet point 2
</fix>
This will allow the user to apply the fix automatically with one click.`

    // 7. Call AI (filter out any incoming system messages, and bound count and character size)
    let hasImages = false
    const rawHistory = messages
      .filter((m) => m && (m.role === "user" || m.role === "assistant"))
      .slice(-MAX_HISTORY_MESSAGES)

    let accumulatedChars = 0
    const historyMessages: { role: string; content: string | unknown[] }[] = []
    for (let i = rawHistory.length - 1; i >= 0; i--) {
      const msg = rawHistory[i]
      const textContent = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)
      if (accumulatedChars + textContent.length > MAX_HISTORY_CHARS) {
        const remaining = MAX_HISTORY_CHARS - accumulatedChars
        if (remaining > 100) {
          historyMessages.unshift({
            role: msg.role,
            content: textContent.slice(-remaining),
          })
        }
        break
      }

      if (msg.images && Array.isArray(msg.images) && msg.images.length > 0) {
        hasImages = true
        historyMessages.unshift({
          role: msg.role,
          content: [
            { type: "text", text: textContent },
            ...msg.images.map((img: string) => ({
              type: "image_url",
              image_url: { url: img.startsWith("data:") ? img : `data:image/jpeg;base64,${img}` },
            })),
          ],
        })
      } else if (Array.isArray(msg.content)) {
        hasImages = true
        historyMessages.unshift(msg)
      } else {
        historyMessages.unshift({
          role: msg.role,
          content: textContent,
        })
      }
      accumulatedChars += textContent.length
    }

    const modelOverrides = parseAiModelOverrides(req.headers)
    const selectedModel = hasImages
      ? resolveAiModelWithOverrides("vision", modelOverrides)
      : resolveAiModelWithOverrides("chat", modelOverrides)
    const assistantContent = await generateAITextResponse("chat", {
      role: hasImages ? "vision" : "chat",
      model: selectedModel,
      systemPrompt,
      userPrompt: historyMessages.length > 0 ? historyMessages : [{ role: "user", content: "Hello" }],
      temperature: 0.7,
      signal: AbortSignal.timeout(AI_TIMEOUTS.chat),
    })


    return NextResponse.json({ role: "assistant", content: assistantContent })
  } catch (error: unknown) {
    if (error instanceof Response) return error
    console.error("Chat route error:", error)
    return NextResponse.json(
      { error: "Failed to generate chat response" },
      { status: 500 }
    )
  }
}