import { NextRequest, NextResponse } from "next/server"
import * as fs from "fs"
import * as path from "path"
import { randomUUID } from "crypto"
import { requireWorkspaceEditor } from "@/lib/auth"
import { rateLimitAsync } from "@/lib/rate-limit"
import { processImageOcr, type OcrMode } from "@/lib/services/ocr-service"
import { prisma } from "@/lib/prisma"
import { workspacePath, SAFE_FILENAME } from "@/lib/workspace-files"

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

  const { allowed, retryAfterMs } = await rateLimitAsync(`${userId}:ocr`, 25, 60_000)
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limited. Please wait before scanning another image.", retryAfterMs },
      {
        status: 429,
        headers: { "Retry-After": Math.ceil(retryAfterMs / 1000).toString() },
      }
    )
  }

  try {
    const body = await req.json()
    const {
      image,
      mode = "auto",
      prompt,
      saveAsAsset = false,
    }: {
      image: string
      mode?: OcrMode
      prompt?: string
      saveAsAsset?: boolean
    } = body

    if (!image || typeof image !== "string") {
      return NextResponse.json(
        { error: "image (base64 string or data URI) is required" },
        { status: 400 }
      )
    }

    // Process OCR via multimodal vision model
    const ocrResult = await processImageOcr(image, mode, prompt)

    let createdAsset = null
    if (saveAsAsset) {
      try {
        const base64Data = image.includes(",") ? image.split(",")[1] : image
        const imgBuffer = Buffer.from(base64Data, "base64")
        const ext = image.includes("image/jpeg") || image.includes("image/jpg") ? "jpg" : "png"
        const filename = `scan_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}.${ext}`

        if (SAFE_FILENAME.test(filename) && imgBuffer.length <= 15 * 1024 * 1024) {
          const destPath = workspacePath(workspaceId, "assets", filename)
          await fs.promises.writeFile(destPath, imgBuffer)

          const assetKind =
            mode === "equation" || (ocrResult.equations && ocrResult.equations.length > 0)
              ? "equation"
              : mode === "table" || (ocrResult.tables && ocrResult.tables.length > 0)
              ? "table"
              : "figure"

          createdAsset = await prisma.asset.create({
            data: {
              id: randomUUID(),
              workspaceId,
              fileId: "scan",
              filename,
              url: `/api/workspaces/${workspaceId}/assets/${filename}`,
              thumbnailUrl: `/api/workspaces/${workspaceId}/assets/${filename}`,
              kind: assetKind,
              heading: ocrResult.equations?.[0]?.key || undefined,
              caption: ocrResult.title || ocrResult.equations?.[0]?.name || "Scanned Asset",
              snippet: ocrResult.equations?.[0]?.formula || ocrResult.summary || ocrResult.text.slice(0, 300),
              section: ocrResult.summary || undefined,
              bbox: ocrResult.text.slice(0, 1000) || undefined,
              tableRows: ocrResult.tables?.[0]?.rows || undefined,
              confidence: "high",
              page: 1,
            },
          })
        }
      } catch (assetErr) {
        console.warn("Failed to persist scanned image as workspace asset:", assetErr)
      }
    }

    return NextResponse.json({
      ok: true,
      result: ocrResult,
      asset: createdAsset,
    })
  } catch (error: unknown) {
    console.error("OCR route error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process image OCR" },
      { status: 500 }
    )
  }
}
