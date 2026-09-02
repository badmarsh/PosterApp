import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import sharp from "sharp"
import { atomicCreateVersionedFile } from "@/lib/asset-versioning"
import { requireWorkspaceEditor } from "@/lib/auth"
import { rateLimitAsync } from "@/lib/rate-limit"
import { WORKSPACES_ROOT } from "@/lib/workspace-files"


type ImageEditOperation = "remove-bg" | "crop-tight" | "upscale" | "custom" | "discard" | "accept"

interface ImageEditRequest {
  assetUrl: string
  workspaceId: string
  operation: ImageEditOperation
  prompt?: string
  originalFilename?: string
}

import { sanitizeFilename } from "@/lib/security"

function resolveAssetPath(assetUrl: string): string | null {
  const prefix = "/api/workspaces/"
  if (!assetUrl.startsWith(prefix)) return null
  const rest = assetUrl.slice(prefix.length)
  const parts = rest.split("/")
  if (parts.length < 3 || parts[1] !== "assets") return null
  const workspaceId = parts[0]
  if (!/^[a-zA-Z0-9_-]+$/.test(workspaceId)) return null
  const filename = parts.slice(2).join("/")
  const safeName = sanitizeFilename(filename)
  if (!safeName || safeName.includes("/") || safeName.includes("\\")) return null
  return path.join(WORKSPACES_ROOT, workspaceId, "assets", safeName)
}

export async function POST(req: Request) {
  let body: ImageEditRequest
  try {
    body = (await req.json()) as ImageEditRequest
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { assetUrl, workspaceId, operation } = body

  if (!assetUrl || !workspaceId || !operation) {
    return NextResponse.json(
      { error: "assetUrl, workspaceId, and operation are required" },
      { status: 400 }
    )
  }

  let userId: string;
  try {
    const access = await requireWorkspaceEditor(workspaceId);
    userId = access.userId;
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { allowed, retryAfterMs } = await rateLimitAsync(`${userId}:image-edit`, 10, 60_000)
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limited', retryAfterMs }, { status: 429, headers: { 'Retry-After': Math.ceil(retryAfterMs / 1000).toString() } })
  }

  const validOperations: ImageEditOperation[] = ["remove-bg", "crop-tight", "upscale", "custom", "discard", "accept"]
  if (!validOperations.includes(operation)) {
    return NextResponse.json(
      { error: `operation must be one of: ${validOperations.join(", ")}` },
      { status: 400 }
    )
  }

  const assetPath = resolveAssetPath(assetUrl)
  if (!assetPath) {
    return NextResponse.json({ error: "Could not resolve assetUrl" }, { status: 400 })
  }

  const assetsDir = path.join(WORKSPACES_ROOT, workspaceId, "assets")
  const relative = path.relative(assetsDir, assetPath)
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return NextResponse.json({ error: "Invalid asset path" }, { status: 400 })
  }

  if (!fs.existsSync(assetsDir) || !fs.existsSync(assetPath)) {
    return NextResponse.json({ error: "Asset or workspace not found" }, { status: 404 })
  }

  if (assetPath.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "PDF assets cannot be image-edited directly." }, { status: 400 })
  }

  if (operation === "discard") {
    if (assetPath.includes("draft-")) {
      await fs.promises.unlink(assetPath).catch(() => {})
    }
    return NextResponse.json({ ok: true })
  }

  if (operation === "accept") {
    if (!assetPath.includes("draft-")) {
      return NextResponse.json({ error: "Not a draft asset" }, { status: 400 })
    }
    const rawOriginal = body.originalFilename || path.basename(assetPath).replace(/draft-\d+-[a-z0-9]+-/, "") || "image.png"
    const originalName = sanitizeFilename(rawOriginal, "image.png")
    const newFilePath = await atomicCreateVersionedFile(assetsDir, originalName, ".png")
    if (!newFilePath) return NextResponse.json({ error: 'Maximum number of edited versions reached' }, { status: 409 })
    
    await fs.promises.copyFile(assetPath, newFilePath)
    await fs.promises.unlink(assetPath).catch(() => {})
    
    const newFilename = path.basename(newFilePath)
    return NextResponse.json({
      url: `/api/workspaces/${workspaceId}/assets/${newFilename}`,
      filename: newFilename,
    })
  }

  if (operation === "remove-bg") {
    // Local white-background removal using sharp — no AI provider required
    try {
      const { data, info } = await sharp(assetPath)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })

      const threshold = 240
      const buffer = Buffer.from(data)
      for (let i = 0; i < buffer.length; i += 4) {
        const r = buffer[i], g = buffer[i + 1], b = buffer[i + 2]
        if (r >= threshold && g >= threshold && b >= threshold) {
          buffer[i + 3] = 0 // make near-white pixels transparent
        }
      }

      const resultBuffer = await sharp(buffer, {
        raw: { width: info.width, height: info.height, channels: 4 },
      })
        .png()
        .toBuffer()

      const origName = path.parse(assetPath).name
      const draftName = `draft-${Date.now()}-${Math.random().toString(36).slice(2)}-${origName}.png`
      const draftPath = path.join(assetsDir, draftName)
      await fs.promises.writeFile(draftPath, resultBuffer)
      return NextResponse.json({
        url: `/api/workspaces/${workspaceId}/assets/${draftName}`,
        filename: draftName,
      })
    } catch (err) {
      console.error("remove-bg failed:", err)
      return NextResponse.json({ error: "Background removal failed" }, { status: 500 })
    }
  }

  if (operation === "custom") {
    const prompt = (body.prompt ?? "").toLowerCase().trim()

    // Handle simple local transforms first (no AI needed)
    let localPipeline: ReturnType<typeof sharp> | null = null
    if (prompt.includes("grayscale") || prompt.includes("greyscale") || prompt.includes("black and white")) {
      localPipeline = sharp(assetPath).grayscale().png()
    } else if (prompt.includes("invert") || prompt.includes("negative")) {
      localPipeline = sharp(assetPath).negate().png()
    } else if (prompt.includes("blur")) {
      const sigma = parseFloat(prompt.match(/(\d+(\.\d+)?)/)?.[1] ?? "3")
      localPipeline = sharp(assetPath).blur(Math.min(Math.max(sigma, 0.3), 20)).png()
    } else if (prompt.includes("sharpen")) {
      localPipeline = sharp(assetPath).sharpen().png()
    } else if (prompt.includes("flip")) {
      localPipeline = sharp(assetPath).flip().png()
    } else if (prompt.includes("flop") || prompt.includes("mirror")) {
      localPipeline = sharp(assetPath).flop().png()
    } else if (prompt.includes("rotate 90") || prompt.includes("rotate90")) {
      localPipeline = sharp(assetPath).rotate(90).png()
    } else if (prompt.includes("rotate 180") || prompt.includes("rotate180")) {
      localPipeline = sharp(assetPath).rotate(180).png()
    } else if (prompt.includes("rotate 270") || prompt.includes("rotate -90")) {
      localPipeline = sharp(assetPath).rotate(270).png()
    }

    if (localPipeline) {
      try {
        const resultBuffer = await localPipeline.toBuffer()
        const origName = path.parse(assetPath).name
        const draftName = `draft-${Date.now()}-${Math.random().toString(36).slice(2)}-${origName}.png`
        const draftPath = path.join(assetsDir, draftName)
        await fs.promises.writeFile(draftPath, resultBuffer)
        return NextResponse.json({
          url: `/api/workspaces/${workspaceId}/assets/${draftName}`,
          filename: draftName,
        })
      } catch (err) {
        console.error("Custom local transform failed:", err)
        return NextResponse.json({ error: "Image transform failed" }, { status: 500 })
      }
    }

    // Fall back to OpenRouter generative edit if configured
    const orKey = process.env.OPENROUTER_API_KEY
    const orModel = process.env.OPENROUTER_IMAGE_MODEL ?? "openai/gpt-image-1"
    const orBase = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1"
    if (orKey) {
      try {
        const imgBuffer = await fs.promises.readFile(assetPath)
        const base64 = imgBuffer.toString("base64")
        const ext = path.extname(assetPath).toLowerCase().replace(".", "")
        const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg"

        const orRes = await fetch(`${orBase}/images/edits`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${orKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: orModel,
            prompt: body.prompt ?? "Enhance this scientific figure for a poster.",
            image: `data:${mime};base64,${base64}`,
            n: 1,
            size: "1024x1024",
          }),
          signal: AbortSignal.timeout(90_000),
        })

        if (!orRes.ok) {
          const errText = await orRes.text().catch(() => "")
          throw new Error(`OpenRouter edit API returned ${orRes.status}: ${errText.slice(0, 200)}`)
        }

        const orData = (await orRes.json()) as { data?: { url?: string; b64_json?: string }[] }
        const item = orData.data?.[0]
        if (!item) throw new Error("No image returned from OpenRouter")

        let resultBuffer: Buffer
        if (item.b64_json) {
          resultBuffer = Buffer.from(item.b64_json, "base64")
        } else if (item.url) {
          const dlRes = await fetch(item.url, { signal: AbortSignal.timeout(30_000) })
          if (!dlRes.ok) throw new Error(`Could not download result image: ${dlRes.status}`)
          resultBuffer = Buffer.from(await dlRes.arrayBuffer())
        } else {
          throw new Error("OpenRouter returned empty image data")
        }

        const origName = path.parse(assetPath).name
        const draftName = `draft-${Date.now()}-${Math.random().toString(36).slice(2)}-${origName}.png`
        const draftPath = path.join(assetsDir, draftName)
        await fs.promises.writeFile(draftPath, resultBuffer)
        return NextResponse.json({
          url: `/api/workspaces/${workspaceId}/assets/${draftName}`,
          filename: draftName,
        })
      } catch (err) {
        console.error("OpenRouter image edit failed:", err)
        return NextResponse.json({ error: "AI image edit failed" }, { status: 502 })
      }
    }

    // No AI provider — tell user which local transforms are available
    return NextResponse.json(
      {
        error:
          "Custom AI edits require OPENROUTER_API_KEY in your environment. " +
          "Local transforms available: grayscale, invert, blur, sharpen, flip, flop, rotate 90/180/270.",
      },
      { status: 422 }
    )
  }

  try {
    let pipeline = sharp(assetPath)
    
    // Always convert output to PNG for consistency and alpha channel support
    pipeline = pipeline.png()

    switch (operation) {
      case "crop-tight":
        pipeline = pipeline.trim({ threshold: 20 })
        break
      
      case "upscale":
        const metadata = await sharp(assetPath).metadata()
        if (metadata.width && metadata.height) {
          pipeline = pipeline.resize(metadata.width * 2, null, {
            kernel: sharp.kernel.lanczos3
          })
        }
        break
    }

    const resultBuffer = await pipeline.toBuffer()

    const parsed = path.parse(assetPath)
    const originalBasename = parsed.name
    const draftName = `draft-${Date.now()}-${Math.random().toString(36).slice(2)}-${originalBasename}.png`
    const draftPath = path.join(assetsDir, draftName)
    
    await fs.promises.writeFile(draftPath, resultBuffer)

    return NextResponse.json({
      url: `/api/workspaces/${workspaceId}/assets/${draftName}`,
      filename: draftName,
    })

  } catch (err) {
    console.error("Local Image Edit failed:", err)
    return NextResponse.json(
      { error: "Image processing failed" },
      { status: 500 }
    )
  }
}
