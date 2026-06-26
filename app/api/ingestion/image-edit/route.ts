import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import { nextVersionedPath } from "@/lib/asset-versioning"

const WORKSPACES_DIR = path.join(process.cwd(), "workspaces")
const OPENROUTER_BASE_URL =
  process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1"
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? ""

// Model to use for image editing via OpenRouter
const IMAGE_MODEL = "openai/gpt-image-1"

// ---------------------------------------------------------------------------
// Request body type
// ---------------------------------------------------------------------------

type ImageEditOperation = "remove-bg" | "crop-tight" | "upscale" | "custom"

interface ImageEditRequest {
  assetUrl: string
  workspaceId: string
  operation: ImageEditOperation
  prompt?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPrompt(operation: ImageEditOperation, customPrompt?: string): string {
  switch (operation) {
    case "remove-bg":
      return "Remove the background, make it transparent"
    case "crop-tight":
      return "Crop tightly to the main content, remove all white/empty padding"
    case "upscale":
      return "Upscale and sharpen this image"
    case "custom":
      return customPrompt ?? "Edit this image"
  }
}

/**
 * Convert a buffer to a data-URI string (base64).
 */
function bufferToDataUrl(buf: Buffer, mimeType: string): string {
  return `data:${mimeType}; base64,${buf.toString("base64")}`
}

/**
 * Detect a reasonable MIME type from a file extension.
 */
function mimeFromExt(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  const map: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
    ".svg": "image/svg+xml",
  }
  return map[ext] ?? "image/png"
}

/**
 * Resolve the filesystem path for an internal asset URL
 * (e.g. /api/workspaces/<id>/assets/foo.png → <cwd>/workspaces/<id>/assets/foo.png)
 */
function resolveAssetPath(assetUrl: string): string | null {
  // Expected shape: /api/workspaces/<id>/assets/<filename...>
  const prefix = "/api/workspaces/"
  if (!assetUrl.startsWith(prefix)) return null
  const rest = assetUrl.slice(prefix.length) // "<id>/assets/<filename>"
  const parts = rest.split("/")
  if (parts.length < 3 || parts[1] !== "assets") return null
  const workspaceId = parts[0]
  const filename = parts.slice(2).join("/")
  return path.join(WORKSPACES_DIR, workspaceId, "assets", filename)
}

// ---------------------------------------------------------------------------
// POST /api/ingestion/image-edit
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  // -- Parse request body ---------------------------------------------------
  let body: ImageEditRequest
  try {
    body = (await req.json()) as ImageEditRequest
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    )
  }

  const { assetUrl, workspaceId, operation, prompt } = body

  if (!assetUrl || !workspaceId || !operation) {
    return NextResponse.json(
      { error: "assetUrl, workspaceId, and operation are required" },
      { status: 400 }
    )
  }

  const validOperations: ImageEditOperation[] = [
    "remove-bg",
    "crop-tight",
    "upscale",
    "custom",
  ]
  if (!validOperations.includes(operation)) {
    return NextResponse.json(
      { error: `operation must be one of: ${validOperations.join(", ")}` },
      { status: 400 }
    )
  }

  if (operation === "custom" && !prompt) {
    return NextResponse.json(
      { error: "prompt is required when operation is 'custom'" },
      { status: 400 }
    )
  }

  // -- Locate the asset on disk --------------------------------------------
  const assetPath = resolveAssetPath(assetUrl)

  if (!assetPath) {
    return NextResponse.json(
      { error: "Could not resolve assetUrl to a workspace asset path" },
      { status: 400 }
    )
  }

  const assetsDir = path.join(WORKSPACES_DIR, workspaceId, "assets")
  if (!fs.existsSync(assetsDir)) {
    return NextResponse.json(
      { error: `Workspace '${workspaceId}' not found` },
      { status: 404 }
    )
  }

  if (!fs.existsSync(assetPath)) {
    return NextResponse.json(
      { error: `Asset not found: ${assetUrl}` },
      { status: 404 }
    )
  }

  // -- Load and base64-encode the source image -----------------------------
  let imageBuffer: Buffer
  try {
    imageBuffer = fs.readFileSync(assetPath)
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to read asset file", detail: String(err) },
      { status: 500 }
    )
  }

  const mimeType = mimeFromExt(assetPath)
  const dataUrl = bufferToDataUrl(imageBuffer, mimeType)
  const editPrompt = buildPrompt(operation, prompt)

  // -- Call OpenRouter with gpt-image-1 ------------------------------------
  if (!OPENROUTER_API_KEY) {
    return NextResponse.json(
      { error: "OPENROUTER_API_KEY is not configured" },
      { status: 500 }
    )
  }

  let openRouterResponse: Response
  try {
    openRouterResponse = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://posterapp.local",
        "X-Title": "PosterApp Image Editor",
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: dataUrl },
              },
              {
                type: "text",
                text: editPrompt,
              },
            ],
          },
        ],
      }),
    })
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to reach OpenRouter", detail: String(err) },
      { status: 503 }
    )
  }

  if (!openRouterResponse.ok) {
    const errBody = await openRouterResponse.text().catch(() => "")
    return NextResponse.json(
      {
        error: "OpenRouter returned an error",
        status: openRouterResponse.status,
        detail: errBody,
      },
      { status: 502 }
    )
  }

  let orData: {
    choices?: Array<{
      message?: {
        content?:
          | string
          | Array<{ type: string; image_url?: { url: string } }>
      }
    }>
  }
  try {
    orData = await openRouterResponse.json()
  } catch {
    return NextResponse.json(
      { error: "Failed to parse OpenRouter JSON response" },
      { status: 502 }
    )
  }

  // -- Extract the result image from the response ---------------------------
  // gpt-image-1 returns the edited image as a base64 data URL in the content.
  const firstChoice = orData.choices?.[0]
  const content = firstChoice?.message?.content

  let resultDataUrl: string | null = null

  if (typeof content === "string") {
    // Plain text response — might be a data URL directly
    if (content.startsWith("data:")) {
      resultDataUrl = content.trim()
    }
  } else if (Array.isArray(content)) {
    for (const part of content) {
      if (part.type === "image_url" && part.image_url?.url) {
        resultDataUrl = part.image_url.url
        break
      }
    }
  }

  if (!resultDataUrl) {
    return NextResponse.json(
      {
        error: "OpenRouter did not return an image in the expected format",
        raw: orData,
      },
      { status: 502 }
    )
  }

  // -- Decode and save result image (non-destructive versioning) -----------
  let resultBuffer: Buffer
  if (resultDataUrl.startsWith("data:")) {
    const base64Part = resultDataUrl.split(",")[1]
    if (!base64Part) {
      return NextResponse.json(
        { error: "Malformed base64 data URL in OpenRouter response" },
        { status: 502 }
      )
    }
    resultBuffer = Buffer.from(base64Part, "base64")
  } else {
    // If it's a remote URL, fetch it
    try {
      const imgResp = await fetch(resultDataUrl)
      if (!imgResp.ok) {
        return NextResponse.json(
          { error: "Failed to download edited image from URL" },
          { status: 502 }
        )
      }
      resultBuffer = Buffer.from(await imgResp.arrayBuffer())
    } catch (err) {
      return NextResponse.json(
        { error: "Failed to fetch edited image", detail: String(err) },
        { status: 502 }
      )
    }
  }

  const originalFilename = path.basename(assetPath)
  const newFilePath = nextVersionedPath(assetsDir, originalFilename)
  const newFilename = path.basename(newFilePath)

  try {
    fs.writeFileSync(newFilePath, resultBuffer)
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to save edited image", detail: String(err) },
      { status: 500 }
    )
  }

  return NextResponse.json({
    url: `/api/workspaces/${workspaceId}/assets/${newFilename}`,
    filename: newFilename,
  })
}
