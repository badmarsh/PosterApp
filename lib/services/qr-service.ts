import QRCode from "qrcode"
import fs from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { prisma } from "@/lib/prisma"

export interface QRCodeOptions {
  url: string
  label?: string
  width?: number
  darkColor?: string
  lightColor?: string
}

/**
 * Generate high-resolution PNG buffer for a given target URL.
 */
export async function generateQRCodePngBuffer(options: QRCodeOptions): Promise<Buffer> {
  const {
    url,
    width = 600,
    darkColor = "#000000ff",
    lightColor = "#ffffffff",
  } = options

  const buffer = await QRCode.toBuffer(url, {
    type: "png",
    width,
    margin: 2,
    color: {
      dark: darkColor,
      light: lightColor,
    },
    errorCorrectionLevel: "M",
  })

  return buffer
}

/**
 * Generates and saves a QR code asset to workspaces/<workspaceId>/assets/qrcode.png
 * and records it in the database Asset table.
 */
export async function generateAndSaveQRCodeAsset(
  workspaceId: string,
  options: QRCodeOptions
): Promise<{ assetId: string; url: string; label: string }> {
  const buffer = await generateQRCodePngBuffer(options)
  const assetsDir = path.join(process.cwd(), "workspaces", workspaceId, "assets")
  await fs.mkdir(assetsDir, { recursive: true })

  const filename = "qrcode.png"
  const filePath = path.join(assetsDir, filename)
  await fs.writeFile(filePath, buffer)

  const publicUrl = `/api/workspaces/${workspaceId}/assets/${filename}`
  const label = options.label?.trim() || "Scan for Paper & Code"

  // Upsert Asset in database
  const asset = await prisma.asset.upsert({
    where: {
      workspaceId_filename: {
        workspaceId,
        filename,
      },
    },
    update: {
      url: publicUrl,
      thumbnailUrl: publicUrl,
      caption: label,
      kind: "figure",
      page: 1,
      confidence: "high",
    },
    create: {
      id: randomUUID(),
      workspaceId,
      fileId: "qr-code",
      filename,
      url: publicUrl,
      thumbnailUrl: publicUrl,
      kind: "figure",
      page: 1,
      confidence: "high",
      caption: label,
    },
  })

  return {
    assetId: asset.id,
    url: publicUrl,
    label,
  }
}

export { generateAndSaveQRCodeAsset as generateAndSaveQRCode }

