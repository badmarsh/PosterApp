import { NextRequest, NextResponse } from "next/server"
import { requireWorkspaceEditor } from "@/lib/auth"
import { rateLimitAsync } from "@/lib/rate-limit"
import { prisma } from "@/lib/prisma"
import { parseBibEntries } from "@/lib/bib-types"
import { suggestCitationsWithAI, suggestCitationsForText } from "@/lib/services/citation-suggester"

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

  const { allowed, retryAfterMs } = await rateLimitAsync(`${userId}:bib-suggest`, 30, 60_000)
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limited. Please wait.", retryAfterMs },
      {
        status: 429,
        headers: { "Retry-After": Math.ceil(retryAfterMs / 1000).toString() },
      }
    )
  }

  try {
    const body = await req.json()
    const { cardContent, cardTitle } = body

    if (!cardContent || typeof cardContent !== "string") {
      return NextResponse.json({ ok: true, suggestions: [] })
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { bibContent: true },
    })

    if (!workspace?.bibContent) {
      return NextResponse.json({ ok: true, suggestions: [] })
    }

    const entries = parseBibEntries(workspace.bibContent)
    if (entries.length === 0) {
      return NextResponse.json({ ok: true, suggestions: [] })
    }

    // Try AI suggestions, falls back to deterministic if rate limited or offline
    const suggestions = await suggestCitationsWithAI(cardContent, entries, cardTitle)

    return NextResponse.json({
      ok: true,
      suggestions,
    })
  } catch (err: unknown) {
    if (err instanceof Response) return err
    console.error("Citation suggest route error:", err)
    return NextResponse.json(
      { error: "Failed to generate citation suggestions" },
      { status: 500 }
    )
  }
}
