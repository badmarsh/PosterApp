/**
 * POST /api/workspaces/[id]/thesis-review/chunks
 *
 * Citation-anchor lookup: given chunk IDs cited in a review's evidence
 * (`evidence[].chunkId` / the [c17] anchors emitted with retrieved context),
 * returns the stored chunk rows so:
 *   - the UI can jump from a finding to the exact retrieved passage,
 *   - verification is an exact ID lookup rather than a fuzzy substring search.
 *
 * GET with ?ids=c1,c2 also supported for simple hyperlink navigation.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireWorkspaceEditor } from "@/lib/auth"
import { rateLimitAsync } from "@/lib/rate-limit"
import { fetchChunksByIds } from "@/lib/ai/vector-rag"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await params
  try {
    await requireWorkspaceEditor(workspaceId)
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const ids = (req.nextUrl.searchParams.get("ids") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100)

  if (ids.length === 0) {
    return NextResponse.json({ chunks: [] })
  }

  const chunks = await fetchChunksByIds(workspaceId, ids)
  return NextResponse.json({ chunks })
}

export async function POST(
  req: NextRequest,
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

  const { allowed } = await rateLimitAsync(`${userId}:${workspaceId}:chunks`, 60, 60_000)
  if (!allowed) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const ids = (Array.isArray(body?.chunkIds) ? body.chunkIds : [])
    .map((x: unknown) => String(x).trim())
    .filter((x: string) => /^[a-zA-Z0-9_-]+$/.test(x))
    .slice(0, 100)

  if (ids.length === 0) {
    return NextResponse.json({ chunks: [] })
  }

  const chunks = await fetchChunksByIds(workspaceId, ids)
  return NextResponse.json({ chunks })
}
