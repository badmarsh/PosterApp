import { NextRequest, NextResponse } from "next/server"
import { requireWorkspaceEditor } from "@/lib/auth"
import { rateLimitAsync } from "@/lib/rate-limit"
import { generateAndSaveQRCode } from "@/lib/services/qr-service"

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

  const { allowed, retryAfterMs } = await rateLimitAsync(`${userId}:qr-gen`, 20, 60_000)
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
    const { url, label } = body

    if (!url || typeof url !== "string" || !url.trim()) {
      return NextResponse.json({ error: "Valid URL is required" }, { status: 400 })
    }

    const trimmedUrl = url.trim()
    const result = await generateAndSaveQRCode(workspaceId, {
      url: trimmedUrl,
      label: typeof label === "string" ? label.trim() : undefined,
    })

    return NextResponse.json({
      ok: true,
      ...result,
    })
  } catch (err: unknown) {
    console.error("QR code generation error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate QR code" },
      { status: 500 }
    )
  }
}
