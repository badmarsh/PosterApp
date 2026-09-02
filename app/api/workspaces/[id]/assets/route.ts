import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { randomUUID } from "crypto"
import { requireWorkspaceEditor } from "@/lib/auth"
import { rateLimitAsync } from "@/lib/rate-limit"
import { z } from "zod"
import { SAFE_FILENAME } from "@/lib/workspace-files"

const AssetCreateSchema = z.object({
  // Server always generates the id — any client-supplied id is ignored
  fileId: z.string().max(128).optional().default("unknown-file"),
  filename: z.string().max(256).optional().default("unnamed"),
  url: z.string().max(2048).regex(/^(\/api\/|https?:\/\/|$)/, "url must be a relative API path or https URL").optional().default(""),
  thumbnailUrl: z.string().max(2048).optional().default(""),
  kind: z.enum(["figure", "table", "equation", "logo"]).optional().default("figure"),
  caption: z.string().max(4096).optional().default(""),
  snippet: z.string().max(8192).optional().default(""),
  // page must be a positive integer when supplied
  page: z.number().int().min(1).optional().default(1),
  confidence: z.enum(["high", "medium", "low"]).optional().default("high"),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const { userId } = await requireWorkspaceEditor(id)

    const { allowed, retryAfterMs } = await rateLimitAsync(`${userId}:${id}:asset-create`, 10, 60_000)
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many asset create requests", retryAfterMs },
        { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
      )
    }

    const raw = await req.json()
    const parsed = AssetCreateSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.format() }, { status: 400 })
    }
    const data = parsed.data

    const created = await prisma.asset.create({
      data: {
        id: randomUUID(), // always server-generated — client-supplied id is ignored
        workspaceId: id,
        fileId: data.fileId,
        filename: data.filename,
        url: data.url,
        thumbnailUrl: data.thumbnailUrl,
        kind: data.kind,
        caption: data.caption,
        snippet: data.snippet,
        page: data.page,
        confidence: data.confidence,
      }
    })
    return NextResponse.json({ ok: true, asset: created })
  } catch (err) {
    if (err instanceof Response) return err
    console.error("Asset POST error:", err)
    return NextResponse.json({ ok: false, error: "Failed to create asset" }, { status: 500 })
  }
}
