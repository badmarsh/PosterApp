import { NextResponse } from "next/server"
import { requireWorkspaceEditor } from "@/lib/auth"
import { issueCollaborationTicket } from "@/lib/collaboration-ticket"
import { rateLimitAsync } from "@/lib/rate-limit"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    // Viewers cannot obtain a collaboration write ticket (A6 fix)
    const access = await requireWorkspaceEditor(id)
    const result = await rateLimitAsync(`collab:${access.userId}`, 12, 60_000)
    if (!result.allowed) return NextResponse.json({ error: { code: "RATE_LIMITED", message: "Too many collaboration requests" } }, { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfterMs / 1000)) } })
    return NextResponse.json(await issueCollaborationTicket(id, access.userId), { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    if (error instanceof Response) return error
    return NextResponse.json({ error: { code: "INTERNAL", message: "Could not issue collaboration ticket" } }, { status: 500 })
  }
}
