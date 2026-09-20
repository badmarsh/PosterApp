import { NextRequest, NextResponse } from "next/server"
import { requireWorkspaceEditor } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { workspacePath } from "@/lib/workspace-files"
import { rateLimitAsync } from "@/lib/rate-limit"
import { generateAIResponse } from "@/lib/ai/client"
import { FixAssetSchema } from "@/lib/ai/contracts"
import { parseAiModelOverrides, resolveAiModelWithOverrides, parseAiApiKey, AI_TIMEOUTS } from "@/lib/ai/models"
import * as path from "path"
import * as fs from "fs/promises"
import { z } from "zod"

const RequestSchema = z.object({
  type: z.enum(["figure", "logo"]).default("figure"),
  cardId: z.string().optional(),
  figureIndex: z.number().int().min(0).optional().default(0),
  currentUrl: z.string().optional(),
  caption: z.string().optional(),
  issue: z.string().optional(),
})

const VALID_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif", ".pdf"])

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

  const { allowed, retryAfterMs } = await rateLimitAsync(`${userId}:fix-asset`, 15, 60_000)
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limited", retryAfterMs },
      { status: 429, headers: { "Retry-After": Math.ceil(retryAfterMs / 1000).toString() } }
    )
  }

  try {
    const body = await req.json().catch(() => ({}))
    const parsed = RequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request payload", details: parsed.error.format() }, { status: 400 })
    }

    const { type, cardId, figureIndex, currentUrl, caption } = parsed.data
    const workspaceDir = workspacePath(workspaceId)

    // Gather candidate assets from workspace assets directory
    const assetsDir = path.join(workspaceDir, "assets")
    let assetFiles: string[] = []
    try {
      const files = await fs.readdir(assetsDir)
      assetFiles = files.filter((f) => VALID_EXTENSIONS.has(path.extname(f).toLowerCase()))
    } catch {
      assetFiles = []
    }

    // Gather candidate logos if type is logo
    let logoFiles: { filename: string; url: string; source: "workspace" | "public" }[] = []
    if (type === "logo") {
      try {
        const wsLogosDir = path.join(workspaceDir, "logos")
        const files = await fs.readdir(wsLogosDir)
        for (const f of files) {
          if (VALID_EXTENSIONS.has(path.extname(f).toLowerCase())) {
            logoFiles.push({ filename: f, url: `/api/workspaces/${workspaceId}/assets/${f}`, source: "workspace" })
          }
        }
      } catch {
        // ws logos optional
      }
      try {
        const publicLogosDir = path.join(process.cwd(), "public", "logos")
        const files = await fs.readdir(publicLogosDir)
        for (const f of files) {
          if (VALID_EXTENSIONS.has(path.extname(f).toLowerCase())) {
            logoFiles.push({ filename: f, url: `/logos/${f}`, source: "public" })
          }
        }
      } catch {
        // public logos optional
      }
    }

    // DB Asset records for metadata (captions, original names)
    const dbAssets = await prisma.asset.findMany({
      where: { workspaceId },
      select: { filename: true, caption: true, url: true, heading: true, snippet: true },
    })

    // Fetch active output and card context
    const full = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { outputs: { include: { cards: true } } },
    })
    const activeOutput = full?.outputs.find((o: any) => o.isActive) ?? full?.outputs[0]
    const targetCard = cardId ? activeOutput?.cards.find((c: any) => c.id === cardId) : null

    // If no candidate files exist at all
    if (type === "figure" && assetFiles.length === 0) {
      return NextResponse.json({
        ok: false,
        error: "No image files found in workspace assets. Please upload a figure via the Upload button.",
        candidateCount: 0,
      }, { status: 404 })
    }

    if (type === "logo" && logoFiles.length === 0 && assetFiles.length === 0) {
      return NextResponse.json({
        ok: false,
        error: "No logo or branding images found in workspace or defaults.",
        candidateCount: 0,
      }, { status: 404 })
    }

    // Prepare candidate list
    type Candidate = { filename: string; url: string; caption?: string; score: number }
    const candidates: Candidate[] = []

    if (type === "figure") {
      for (const fn of assetFiles) {
        const dbRec = dbAssets.find((a) => a.filename === fn)
        candidates.push({
          filename: fn,
          url: `/api/workspaces/${workspaceId}/assets/${fn}`,
          caption: dbRec?.caption || dbRec?.heading || "",
          score: 0,
        })
      }
    } else {
      for (const l of logoFiles) {
        candidates.push({
          filename: l.filename,
          url: l.url,
          score: l.source === "public" ? 5 : 10,
        })
      }
      for (const fn of assetFiles) {
        if (/logo|brand|emblem|icon|shield/i.test(fn)) {
          candidates.push({
            filename: fn,
            url: `/api/workspaces/${workspaceId}/assets/${fn}`,
            score: 15,
          })
        }
      }
    }

    // Token similarity scoring
    const normalizeTokens = (str: string) =>
      str
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .split(" ")
        .filter((t) => t.length >= 3)

    const queryTokens = new Set([
      ...normalizeTokens(currentUrl ? path.basename(currentUrl) : ""),
      ...normalizeTokens(caption || ""),
      ...normalizeTokens(targetCard?.title || ""),
    ])

    for (const cand of candidates) {
      const candTokens = new Set([
        ...normalizeTokens(cand.filename),
        ...normalizeTokens(cand.caption || ""),
      ])
      let matchCount = 0
      for (const qt of queryTokens) {
        if (candTokens.has(qt)) matchCount += 3
        else {
          for (const ct of candTokens) {
            if (ct.includes(qt) || qt.includes(ct)) {
              matchCount += 1
              break
            }
          }
        }
      }
      cand.score += matchCount
    }

    candidates.sort((a, b) => b.score - a.score)

    let bestCandidate = candidates[0]
    let explanation = ""

    // If there are multiple candidates with close scores, let LLM pick the best one
    if (candidates.length > 1 && candidates[0].score > 0) {
      try {
        const modelOverrides = parseAiModelOverrides(req.headers)
        const clientApiKey = parseAiApiKey(req.headers)
        const systemPrompt = `You are an intelligent asset matcher for an academic scientific document editor.
A figure or logo reference was broken or missing. Select the best matching available file from the candidate list.`

        const userPrompt = `Target context:
- Type: ${type}
- Broken URL: ${currentUrl || "none"}
- Caption / Description: ${caption || "none"}
- Section / Card Title: ${targetCard?.title || "none"}

Candidate files:
${JSON.stringify(candidates.map((c) => ({ filename: c.filename, caption: c.caption })), null, 2)}

Respond with JSON:
{
  "matchedFilename": "the chosen filename",
  "explanation": "Brief 1-sentence explanation of why this file matches"
}`

        const aiRes = await generateAIResponse("autofix", {
          model: resolveAiModelWithOverrides("autofix", modelOverrides),
          apiKey: clientApiKey,
          systemPrompt,
          userPrompt,
          schema: FixAssetSchema,
          temperature: 0.1,
          signal: AbortSignal.timeout(AI_TIMEOUTS.autofix || 30_000),
        })

        if (aiRes?.matchedFilename) {
          const matched = candidates.find(
            (c) => c.filename.toLowerCase() === aiRes.matchedFilename?.toLowerCase()
          )
          if (matched) {
            bestCandidate = matched
            explanation = aiRes.explanation || `Matched with workspace asset "${matched.filename}".`
          }
        }
      } catch (aiErr) {
        console.warn("[fix-asset] AI matching failed, using heuristic score:", aiErr)
      }
    }

    if (!bestCandidate) {
      return NextResponse.json({
        ok: false,
        error: "Could not find a suitable matching asset.",
      }, { status: 404 })
    }

    if (!explanation) {
      explanation = `Reconnected to workspace asset "${bestCandidate.filename}".`
    }

    // Apply the fix to the database
    if (type === "figure" && cardId) {
      const card = await prisma.card.findUnique({ where: { id: cardId } })
      if (card) {
        const currentFigures = Array.isArray(card.figures) ? [...(card.figures as any[])] : []
        const idx = figureIndex ?? 0
        while (currentFigures.length <= idx) {
          currentFigures.push({
            id: `fig_${currentFigures.length}_${Date.now().toString(36)}`,
            url: "",
            caption: "",
          })
        }
        currentFigures[idx] = {
          ...currentFigures[idx],
          url: bestCandidate.url,
          caption: currentFigures[idx]?.caption || bestCandidate.caption || caption || "",
        }

        await prisma.card.update({
          where: { id: cardId },
          data: { figures: currentFigures },
        })

        // Also update workspace revision
        await prisma.workspace.update({
          where: { id: workspaceId },
          data: { revision: { increment: 1 } },
        })
      }
    } else if (type === "logo") {
      if (activeOutput) {
        await prisma.output.update({
          where: { id: activeOutput.id },
          data: { logoUrl: bestCandidate.url },
        })
      }
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: { logoUrl: bestCandidate.url, revision: { increment: 1 } },
      })
    }

    return NextResponse.json({
      ok: true,
      fixedUrl: bestCandidate.url,
      filename: bestCandidate.filename,
      explanation,
      type,
      cardId,
      figureIndex,
    })
  } catch (err: unknown) {
    console.error("[fix-asset] Error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fix asset" },
      { status: 500 }
    )
  }
}

