import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import { prisma } from "@/lib/prisma"
import { requireWorkspaceEditor } from "@/lib/auth"
import { rateLimitAsync } from "@/lib/rate-limit"
import { generateCaption } from "@/lib/services/vision-service"
import { WORKSPACES_ROOT } from "@/lib/workspace-files"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await params

  let userId: string
  try {
    const access = await requireWorkspaceEditor(workspaceId)
    userId = access.userId
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { allowed, retryAfterMs } = await rateLimitAsync(`${userId}:backfill-captions`, 5, 60_000)
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfterMs },
      { status: 429, headers: { "Retry-After": Math.ceil(retryAfterMs / 1000).toString() } }
    )
  }

  const assets = await prisma.asset.findMany({
    where: { workspaceId },
    orderBy: { id: "asc" },
  })

  const isGeneric = (cap?: string | null) => {
    if (!cap || !cap.trim()) return true
    const lower = cap.trim().toLowerCase()
    return (
      lower === "figure" ||
      lower === "table" ||
      lower === "image" ||
      lower === "untitled" ||
      lower === "n/a" ||
      lower.startsWith("figure ") ||
      lower.startsWith("table ")
    )
  }

  const candidates = assets.filter((a) => {
    if (a.kind === "equation") {
      return isGeneric(a.caption) || !a.caption || a.caption.startsWith("Equation ")
    }
    if (!a.filename || a.filename.toLowerCase().endsWith(".pdf")) return false
    return isGeneric(a.caption) || !a.snippet || !a.snippet.trim()
  })

  if (candidates.length === 0) {
    return NextResponse.json({
      message: "All assets already have detailed captions",
      updatedCount: 0,
      assets: [],
    })
  }

  const sourcesDir = path.join(WORKSPACES_ROOT, workspaceId, "sources")
  const sourcesMap = new Map<string, string>()
  if (fs.existsSync(sourcesDir)) {
    try {
      const files = fs.readdirSync(sourcesDir).filter((f) => f.endsWith(".md"))
      for (const f of files) {
        sourcesMap.set(f, fs.readFileSync(path.join(sourcesDir, f), "utf-8"))
      }
    } catch {}
  }

  const { generateEquationCaption } = await import("@/lib/services/equation-service")
  const updatedAssets: { id: string; caption: string }[] = []
  let updatedCount = 0

  for (let i = 0; i < candidates.length; i++) {
    const asset = candidates[i]
    const filename = asset.filename

    let contextWindow = ""
    if (filename) {
      for (const [, content] of sourcesMap.entries()) {
        const pos = content.indexOf(filename)
        if (pos !== -1) {
          contextWindow = content.substring(
            Math.max(0, pos - 1000),
            Math.min(content.length, pos + 1000)
          )
          break
        }
      }
    }

    try {
      if (asset.kind === "equation") {
        const formula = asset.snippet || asset.caption || ""
        if (formula) {
          // If no context by filename, search by formula
          if (!contextWindow) {
            for (const [, content] of sourcesMap.entries()) {
              const pos = content.indexOf(formula.slice(0, 30))
              if (pos !== -1) {
                contextWindow = content.substring(
                  Math.max(0, pos - 1000),
                  Math.min(content.length, pos + 1000)
                )
                break
              }
            }
          }

          const generated = await generateEquationCaption(formula, contextWindow)
          if (generated.caption && !generated.caption.startsWith("Equation ")) {
            const updated = await prisma.asset.update({
              where: { id: asset.id },
              data: {
                caption: generated.caption,
                snippet: formula,
              },
            })
            updatedAssets.push({ id: updated.id, caption: updated.caption ?? "" })
            updatedCount++
          }
        }
      } else if (filename) {
        const assetPath = path.join(WORKSPACES_ROOT, workspaceId, "assets", filename)
        if (fs.existsSync(assetPath)) {
          const fileBuffer = fs.readFileSync(assetPath)
          const base64 = fileBuffer.toString("base64")
          const generated = await generateCaption(base64, contextWindow)

          const newCaption = generated.caption || generated.name || (asset.kind === "table" ? "Table" : "Figure")
          const newSnippet = generated.snippet || generated.name || ""

          if (newCaption && newCaption !== "Figure" && newCaption !== "Table") {
            const updated = await prisma.asset.update({
              where: { id: asset.id },
              data: {
                caption: newCaption,
                snippet: newSnippet,
              },
            })
            updatedAssets.push({ id: updated.id, caption: updated.caption ?? "" })
            updatedCount++
          }
        }
      }
    } catch (err) {
      console.warn(`[Backfill] Failed for asset ${asset.filename || asset.id}:`, err)
    }

    // Pacing delay between items
    if (i < candidates.length - 1) {
      await new Promise((r) => setTimeout(r, 400))
    }
  }

  return NextResponse.json({
    message: `Successfully backfilled ${updatedCount} asset captions`,
    updatedCount,
    assets: updatedAssets,
  })
}
