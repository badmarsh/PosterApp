import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { randomUUID } from "crypto"
import { requireWorkspaceEditor } from "@/lib/auth"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const { userId } = await requireWorkspaceEditor(id)

    const asset = await req.json()
    const created = await prisma.asset.create({
      data: {
        id: asset.id || randomUUID(),
        workspaceId: id,
        fileId: asset.fileId || "unknown-file",
        filename: asset.filename || "unnamed",
        url: asset.url || "",
        thumbnailUrl: asset.thumbnailUrl || "",
        kind: asset.kind || "figure",
        caption: asset.caption || "",
        snippet: asset.snippet || "",
        page: asset.page || 1,
        confidence: asset.confidence || "high",
      }
    })
    return NextResponse.json({ ok: true, asset: created })
  } catch (err) {
    if (err instanceof Response) return err
    console.error("Asset POST error:", err)
    return NextResponse.json({ ok: false, error: "Failed to create asset" }, { status: 500 })
  }
}
