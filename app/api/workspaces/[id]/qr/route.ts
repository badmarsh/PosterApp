import { NextRequest, NextResponse } from "next/server"
import { requireWorkspaceEditor } from "@/lib/auth"
import { rateLimitAsync } from "@/lib/rate-limit"
import { generateAndSaveQRCode } from "@/lib/services/qr-service"

import { z } from "zod"

const RequestBodySchema = z.object({
  url: z.string().url().max(2000),
  label: z.string().max(100).optional(),
})

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
    const rawBody = await req.json()
    const parsedBody = RequestBodySchema.safeParse(rawBody)
    if (!parsedBody.success) {
      return NextResponse.json({ error: "Invalid request payload", details: parsedBody.error.format() }, { status: 400 })
    }
    const { url, label } = parsedBody.data

    const result = await generateAndSaveQRCode(workspaceId, {
      url: url.trim(),
      label: label?.trim(),
    })

    return NextResponse.json({
      ok: true,
      ...result,
    })
  } catch (err: unknown) {
    if (err instanceof Response) return err
    console.error("QR code generation error:", err)
    return NextResponse.json(
      { error: "Failed to generate QR code" },
      { status: 500 }
    )
  }
}
