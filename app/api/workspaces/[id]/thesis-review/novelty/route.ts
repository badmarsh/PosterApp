import { NextRequest, NextResponse } from "next/server"
import { requireWorkspaceEditor } from "@/lib/auth"
import { detectNovelty } from "@/lib/ai/novelty-detector"
import { rateLimitAsync } from "@/lib/rate-limit"
import path from "path"
import fs from "fs"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await params

  let bibContent: string | null = null
  let userId: string
  try {
    const access = await requireWorkspaceEditor(workspaceId)
    bibContent = access.workspace.bibContent
    userId = access.userId
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { allowed, retryAfterMs } = await rateLimitAsync(
    `${userId}:${workspaceId}:novelty`,
    1,
    3 * 60 * 1000
  )
  if (!allowed) {
    return NextResponse.json(
      { error: `Rate limited — try again in ${Math.ceil(retryAfterMs / 1000)}s` },
      { status: 429 }
    )
  }

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
    const report = await detectNovelty(thesisText, bibContent || "")
    return NextResponse.json(report)
  } catch (err) {
    console.error("[novelty] Error:", err)
    return NextResponse.json({ error: "Novelty detection failed" }, { status: 500 })
  }
}
