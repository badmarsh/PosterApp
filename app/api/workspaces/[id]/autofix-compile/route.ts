import { NextRequest, NextResponse } from "next/server"
import { rateLimitAsync } from "@/lib/rate-limit"
import { requireWorkspaceEditor } from "@/lib/auth"
import { generateAIResponse } from "@/lib/ai/client"
import { CompileFixesSchema } from "@/lib/ai/contracts"
import type { Card } from "@/lib/poster-types"
import { resolveAiModel, AI_TIMEOUTS } from "@/lib/ai/models"
import { hasUnsafeLatex } from "@/lib/latex/validation"
import { wrapUntrustedContext } from "@/lib/ai/prompts"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await params

  if (!/^[a-zA-Z0-9_-]+$/.test(workspaceId)) {
    return NextResponse.json({ error: "Invalid workspace ID" }, { status: 400 })
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

  // Stricter rate limit for autofix (expensive)
  const { allowed, retryAfterMs } = await rateLimitAsync(`${userId}:autofix`, 3, 60_000)
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limited", retryAfterMs },
      { status: 429, headers: { "Retry-After": Math.ceil(retryAfterMs / 1000).toString() } }
    )
  }

  try {
    const body = await req.json()
    const { log, cards } = body

    if (!log || !cards || !Array.isArray(cards)) {
      return NextResponse.json({ error: "Compiler log and cards array are required" }, { status: 400 })
    }

    // Clean compiler log: truncate noisy font/file loading lines if log is excessively large
    const logLines = (log as string).split("\n")
    let trimmedLog = log as string
    if (logLines.length > 200) {
      const errorIdx = logLines.findIndex((l) => l.startsWith("!"))
      if (errorIdx !== -1) {
        const start = Math.max(0, errorIdx - 20)
        const end = Math.min(logLines.length, errorIdx + 150)
        trimmedLog = logLines.slice(start, end).join("\n")
      } else {
        trimmedLog = logLines.slice(-150).join("\n")
      }
    }

    // Prepare context
    const cardContext = cards.map((c: Card) => `[CARD ID: ${c.id}]\n${c.content}\n`).join("\n\n")

    const systemPrompt = `You are an expert debugger for a LaTeX poster/slides/paper compiler. Card contents are stored as MARKDOWN, not raw LaTeX. They are automatically converted to LaTeX before compilation via this pipeline:

- Bullet lists: Markdown "- item" → \\begin{itemize}\\item...\\end{itemize}
- Bold: **text** → \\textbf{text}
- Italic: *text* → \\textit{text}
- Inline math: $formula$ → passed through as-is (only safe commands allowed)
- Display math: $$formula$$ → passed through as-is
- All other special LaTeX characters (_ % & # { } $ ^ ~ \\) are AUTOMATICALLY escaped by escapeLatex() before compilation — so users MUST NOT write \\_ or \\% in their card content; they should write _ and % as plain text, and the system handles escaping.
- Citations: \\cite{key} or [@key] → \\cite{key}

CRITICAL: The corrected card content you return MUST be in the same Markdown format as the input — NOT raw LaTeX. Do not add \\_, \\%, \\&, \\textbackslash, \\begin{itemize}, \\textbf, etc. Use Markdown equivalents instead.

Common errors and their Markdown fixes:
- "Missing $ inserted" → the user wrote a LaTeX math command outside $...$ — wrap the expression in $...$
- "Undefined control sequence \\foo" → remove the \\foo command or use plain text
- "Extra alignment tab &" → remove stray & characters from text (they're only valid in table rows)
- "Runaway argument" or "Paragraph ended" → unclosed $...$ math — fix by closing or removing the dollar sign`

    const userPrompt = `${wrapUntrustedContext("Compiler Log", trimmedLog)}

${wrapUntrustedContext("Current Card Contents", cardContext)}

${wrapUntrustedContext(
      "Task",
      `Analyze the compiler log and identify which card(s) caused the LaTeX compile error. The card contents are written in Markdown and automatically converted to LaTeX — so the error is caused by something in the Markdown that produces invalid LaTeX after conversion.

1. Provide a concise explanation (1-2 sentences) of what caused the compile error and what you fixed in the Markdown.
2. Return corrected card content in the SAME Markdown format as the input. Do NOT use raw LaTeX — use Markdown syntax (- for bullets, **bold**, *italic*, $math$).

Do not return patches for cards that are correct.
Respond EXACTLY in this JSON format (no markdown wrappers):
{
  "explanation": "Brief explanation e.g. 'The methodology card had an unmatched $ opening a math expression. Wrapped the formula in $...$.'",
  "patches": [
    {
      "id": "card_id_here",
      "content": "The corrected card content in Markdown format..."
    }
  ]
}`
    )}`

    const parsedData = await generateAIResponse("autofix-compile", {
      model: resolveAiModel("autofix"),
      systemPrompt,
      userPrompt,
      schema: CompileFixesSchema,
      temperature: 0.1,
      signal: AbortSignal.timeout(AI_TIMEOUTS.review),
    })

    // Validate that the returned IDs actually exist in the provided cards,
    // and ensure the content does not introduce unsafe LaTeX
    const validCardIds = new Set(cards.map((c: Card) => c.id))
    const validPatches = parsedData.patches.filter(
      (patch) =>
        validCardIds.has(patch.id) &&
        patch.content.trim().length > 0 &&
        hasUnsafeLatex(patch.content).length === 0
    )

    return NextResponse.json({
      explanation:
        parsedData.explanation ||
        `Fixed Markdown content in ${validPatches.length} card(s) to resolve the compile error.`,
      fixes: validPatches,
    })
  } catch (error: unknown) {
    if (error instanceof Response) return error
    console.error("Error in AI Autofix:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}
