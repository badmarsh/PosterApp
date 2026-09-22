import { NextRequest, NextResponse } from "next/server"
import { requireWorkspaceEditor } from "@/lib/auth"
import { rateLimitAsync } from "@/lib/rate-limit"
import { isDemoProject } from "@/lib/mock-data"
import { summarizeCompileError } from "@/lib/latex/compile-summary"
import { parseAiModelOverrides, parseAiApiKey } from "@/lib/ai/models"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await params

  if (!isDemoProject(workspaceId)) {
    try {
      await requireWorkspaceEditor(workspaceId)
    } catch (err) {
      if (err instanceof Response) return err
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  // Rate-limit AI-powered compile summaries (10 per minute per user).
  const userId = workspaceId
  const { allowed, retryAfterMs } = await rateLimitAsync(`${userId}:compile-summary`, 10, 60_000)
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limited", retryAfterMs },
      { status: 429, headers: { "Retry-After": Math.ceil(retryAfterMs / 1000).toString() } }
    )
  }

  try {
    const body = await req.json()
    const { log, cards } = body

    if (!log || typeof log !== "string") {
      return NextResponse.json({ error: "Compiler log is required" }, { status: 400 })
    }

    const modelOverrides = parseAiModelOverrides(req.headers)
    const apiKey = parseAiApiKey(req.headers)

    const summary = await summarizeCompileError(log, cards, {
      signal: req.signal,
      apiKey,
      modelOverrides,
    })

    return NextResponse.json({ summary })
  } catch (error) {
    console.error("[compile-summary] error:", error)
    return NextResponse.json({ error: "Failed to summarize compile error" }, { status: 500 })
  }
}
