import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { detectNovelty } from "@/lib/ai/novelty-detector"
import path from "path"
import fs from "fs"

// Rate-limit: 1 run per 3 minutes per workspace
const runLimiter = new Map<string, number>()
const RUN_COOLDOWN_MS = 3 * 60 * 1000

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: workspaceId } = await params

  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, userId },
    select: { id: true, bibContent: true },
  })
  if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const lastRun = runLimiter.get(workspaceId)
  if (lastRun && Date.now() - lastRun < RUN_COOLDOWN_MS) {
    return NextResponse.json({ error: "Rate limited — wait 3 minutes between novelty scans" }, { status: 429 })
  }
  runLimiter.set(workspaceId, Date.now())

  // Load source markdowns from disk (up to 60k chars total)
  const workspacesDir = process.env.WORKSPACES_DIR || "workspaces"
  const sourcesDir = path.join(workspacesDir, workspaceId, "sources")
  let thesisText = ""
  try {
    if (fs.existsSync(sourcesDir)) {
      const files = fs.readdirSync(sourcesDir).filter((f) => f.endsWith(".md"))
      for (const file of files) {
        const content = fs.readFileSync(path.join(sourcesDir, file), "utf-8")
        thesisText += content + "\n\n"
        if (thesisText.length > 60000) break
      }
    }
  } catch (err) {
    console.error("[novelty] Failed to read sources:", err)
  }

  if (!thesisText.trim()) {
    return NextResponse.json({ error: "No source documents found. Ingest a thesis PDF first." }, { status: 400 })
  }

  try {
    const report = await detectNovelty(thesisText, workspace.bibContent || "")
    return NextResponse.json(report)
  } catch (err) {
    console.error("[novelty] Error:", err)
    return NextResponse.json({ error: "Novelty detection failed" }, { status: 500 })
  }
}
