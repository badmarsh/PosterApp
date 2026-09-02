import { NextRequest, NextResponse } from "next/server"
import { rateLimitAsync } from "@/lib/rate-limit"
import { requireWorkspaceEditor } from "@/lib/auth"
import { generateAIResponse } from "@/lib/ai/client"
import { LayoutWarningsSchema } from "@/lib/ai/contracts"
import * as path from "path"
import * as fs from "fs/promises"
import * as os from "os"
import { runSandboxedLatex } from "@/lib/latex/compiler-runner"
import type { Card } from "@/lib/poster-types"
import { parseAiModelOverrides, resolveAiModelWithOverrides, AI_TIMEOUTS } from "@/lib/ai/models"
import { workspacePath } from "@/lib/workspace-files"

const MAX_PAGES_TO_REVIEW = 25

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

  // Stricter rate limit for vision model
  const { allowed, retryAfterMs } = await rateLimitAsync(`${userId}:review-layout`, 5, 60_000)
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limited", retryAfterMs },
      { status: 429, headers: { "Retry-After": Math.ceil(retryAfterMs / 1000).toString() } }
    )
  }

  const url = new URL(req.url)
  const expectedRevision = url.searchParams.get("revision")

  if (expectedRevision && workspace.revision !== parseInt(expectedRevision, 10)) {
    // If the revision is stale, don't run the expensive check.
    return NextResponse.json({ error: "Stale revision" }, { status: 409 })
  }

  const workspaceDir = workspacePath(workspaceId)
  const pdfPath = path.join(workspaceDir, "main.pdf")

  try {
    await fs.access(pdfPath)
  } catch {
    return NextResponse.json({ error: "No compiled PDF found to review" }, { status: 404 })
  }

  // Fetch active cards for title-to-ID mapping
  const full = await (await import("@/lib/prisma")).prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { outputs: { include: { cards: true } } },
  })
  if (!full) return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
  const activeOutput = full.outputs.find((item: any) => item.isActive) ?? full.outputs[0]
  const cards = (activeOutput?.cards ?? []) as unknown as Card[]

  // Create a unique temporary directory for rasterization
  let stage = ""
  try {
    stage = await fs.mkdtemp(path.join(os.tmpdir(), `posterapp-layout-${workspaceId}-`))

    // Copy the PDF into the temporary stage so WSL doesn't have to deal with Windows absolute paths
    await fs.copyFile(pdfPath, path.join(stage, "input.pdf"))

    // Use sandboxed compiler to convert pages (up to 25) to PNG and scale to max 1024px
    const buildCmd = `pdftoppm -png -f 1 -l ${MAX_PAGES_TO_REVIEW} -scale-to 1024 input.pdf page 2>&1`
    
    try {
      await runSandboxedLatex({ stage, buildCmd, timeoutMs: 30_000 })
    } catch (err: any) {
      if (err.message === "COMPILER_UNAVAILABLE") {
        return NextResponse.json({ error: { code: "PDF_TOOLS_UNAVAILABLE", message: "PDF layout review requires compiler tools in production" } }, { status: 503 })
      }
      throw new Error(`pdftoppm failed: ${err.message}`)
    }

    const stageFiles = await fs.readdir(stage)
    const pageFiles = stageFiles
      .filter((f) => /^page-\d+\.png$/.test(f))
      .sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, ""), 10)
        const numB = parseInt(b.replace(/\D/g, ""), 10)
        return numA - numB
      })

    if (pageFiles.length === 0) {
      throw new Error("pdftoppm produced no image pages")
    }

    const outputType = activeOutput?.outputType || "poster"
    const typeSpecificGuidelines =
      outputType === "paper"
        ? `Paper Guidelines:
- In two-column papers, wide tables or figures that span across BOTH columns are INTENDED and standard. Do NOT flag full-width spanning elements as overflows if they fit within overall page margins.
- Check if single-column formulas in the left column cross the central gutter into the right column.`
        : outputType === "slides"
        ? `Slides Guidelines:
- Flag content extending past the bottom edge of a slide or overlapping headers/footers.`
        : `Poster Guidelines:
- Flag major column height imbalances or content clipped at poster canvas edges.`

    const userPrompt: any[] = [
      {
        type: "text",
        text: `Inspect all ${pageFiles.length} attached rendered page(s)/slide(s) for severe visual layout defects:
1. Two-column collisions: Single-column formulas crossing the gutter into adjacent columns.
2. Hard clippings: Text, tables, or figures cut off at page edges.
3. Collisions: Captions overlapping figures or headers.

CRITICAL:
- Do NOT flag intentional full-width spanning figures or tables (table*, figure*) in two-column papers.
- Only report genuine, severe visible defects. If clean, return {"warnings": []}.`,
      },
    ]

    for (const pf of pageFiles) {
      const pngBuffer = await fs.readFile(path.join(stage, pf))
      userPrompt.push({
        type: "image_url",
        image_url: { url: `data:image/png;base64,${pngBuffer.toString("base64")}` },
      })
    }

    const systemPrompt = `You are a high-precision visual layout inspector for a scientific ${outputType} editor.
Inspect the rendered page(s) for genuine, severe layout defects:
${typeSpecificGuidelines}
- Serious element collisions (e.g. caption rendered over a figure).
- Clipped text or clipped plot axis labels.

Output Schema:
{
  "warnings": [
    { 
      "cardTitle": "Short card/section name (max 4 words, e.g. 'Section 1' or 'Ablation')", 
      "issue": "Ultra-concise defect (max 8 words, e.g. 'Formula spills across central column gutter')", 
      "recommendation": "Concise, actionable user fix (max 10 words, e.g. 'Split formula across lines or reduce text')",
      "estimatedOverflowCharacters": 20 
    }
  ]
}

STRICT CALIBRATION:
- HIGH CONFIDENCE ONLY: Do NOT flag intentional full-width spanning elements or minor spacing variations.
- NEVER suggest raw LaTeX commands (do NOT write \\begin{sidewaystable}, \\resizebox, \\small, etc.).
- Default to clean: If the document is properly typeset, return {"warnings": []}.
- NEVER include entries with "No issues detected", "None", or "Clean".`

    const modelOverrides = parseAiModelOverrides(req.headers)
    const parsedData = await generateAIResponse("review-layout", {
      model: resolveAiModelWithOverrides("reviewLayout", modelOverrides),
      systemPrompt,
      userPrompt,
      schema: LayoutWarningsSchema,
      temperature: 0.1,
      signal: AbortSignal.timeout(AI_TIMEOUTS.review),
    })

    // Filter out any hallucinated "no issue" or "none" items
    const isFalseWarning = (w: { issue?: string; recommendation?: string }) => {
      const text = `${w.issue || ""} ${w.recommendation || ""}`.toLowerCase()
      return (
        /no\s+(significant\s+)?(issue|overflow|problem|warning|defect|error)/i.test(text) ||
        /^(none|clean|ok|n\/a|all\s+good)[\.\s]*$/i.test(w.issue?.trim() || "") ||
        /^(none|n\/a|clean|ok)[\.\s]*$/i.test(w.recommendation?.trim() || "")
      )
    }

    const validWarnings = (parsedData.warnings || []).filter((w) => !isFalseWarning(w))

    // Map the returned card titles back to stable cardIds
    const warningsWithRealIds = []
    const unmatchedWarnings = []
    const rev = parseInt(expectedRevision || "0", 10)

    const cleanTitle = (t: string) => t.trim().toLowerCase().replace(/^\d+[\.\s]*/, "")

    for (const warning of validWarnings) {
      const normalizedWarningTitle = cleanTitle(warning.cardTitle)
      // First exact match on cleaned title, then substring match
      let matchedCard = cards.find(
        (c) => cleanTitle(c.title) === normalizedWarningTitle
      )
      if (!matchedCard) {
        matchedCard = cards.find((c) => {
          const cardTitleNorm = cleanTitle(c.title)
          return (
            cardTitleNorm.includes(normalizedWarningTitle) ||
            normalizedWarningTitle.includes(cardTitleNorm)
          )
        })
      }

      if (matchedCard) {
        warningsWithRealIds.push({
          ...warning,
          cardId: matchedCard.id,
          compiledRevision: rev,
        })
      } else {
        unmatchedWarnings.push({
          ...warning,
          compiledRevision: rev,
        })
      }
    }

    return NextResponse.json({
      warnings: [...warningsWithRealIds, ...unmatchedWarnings],
      compiledRevision: rev,
      pageRange: { from: 1, to: pageFiles.length, maxEvaluated: MAX_PAGES_TO_REVIEW },
    })
  } catch (err: unknown) {
    if (err instanceof Response) return err
    console.error("VLM Review Error:", err)
    return NextResponse.json(
      { error: "Failed to run VLM layout review" },
      { status: 500 }
    )
  } finally {
    if (stage) {
      await fs.rm(stage, { recursive: true, force: true }).catch(() => undefined)
    }
  }
}
