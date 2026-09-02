import { createHash } from "crypto"
import path from "path"
import fs from "fs/promises"
import { normalizeLatexPath } from "./helpers"
import type { Project } from "@/lib/poster-types"

/**
 * Remote figure materialization for the LaTeX pipeline.
 *
 * pdflatex cannot fetch http(s) URLs, so any figure whose `url` is an
 * absolute remote address (e.g. an Unsplash hotlink) must be downloaded
 * into the compile/export stage and referenced by a relative path like
 * `assets/remote/<hash>.jpg` before the .tex is written.
 */

const FETCH_TIMEOUT_MS = 10_000
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const EXT_WHITELIST = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".pdf"])
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "image/bmp": ".bmp",
  "application/pdf": ".pdf",
}

export function isRemoteUrl(url: string | undefined | null): boolean {
  return typeof url === "string" && (url.startsWith("http://") || url.startsWith("https://"))
}

/** Collect every absolute http(s) figure URL referenced by any output card. */
export function collectRemoteFigureUrls(project: Project): string[] {
  const urls = new Set<string>()
  for (const output of project.outputs) {
    for (const card of output.cards) {
      for (const fig of card.figures ?? []) {
        if (fig && isRemoteUrl(fig.url)) urls.add(fig.url)
      }
    }
  }
  return [...urls]
}

function inferExtension(url: string, contentType?: string | null): string {
  try {
    const pathname = new URL(url).pathname
    const ext = path.extname(pathname).toLowerCase()
    if (EXT_WHITELIST.has(ext)) return ext
  } catch {
    // fall through to content-type / default below
  }
  const mime = contentType?.split(";")[0].trim().toLowerCase()
  if (mime && MIME_TO_EXT[mime]) return MIME_TO_EXT[mime]
  return ".jpg"
}

interface DownloadedImage {
  buffer: Buffer
  ext: string
}

/** Download a remote image with timeout and size cap. Returns null on any failure. */
export async function downloadRemoteImage(url: string): Promise<DownloadedImage | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: "follow" })
    if (!res.ok || !res.body) return null

    const declaredLength = Number(res.headers.get("content-length") ?? "0")
    if (declaredLength > MAX_BYTES) return null

    const ext = inferExtension(url, res.headers.get("content-type"))

    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_BYTES) return null
      chunks.push(value)
    }
    if (total === 0) return null
    return { buffer: Buffer.concat(chunks), ext }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function remoteFileName(url: string, ext: string): string {
  const hash = createHash("sha1").update(url).digest("hex").slice(0, 16)
  return `remote-${hash}${ext}`
}

/**
 * Download every remote figure referenced by the project into `<stage>/assets/remote/`
 * and return a `url -> relative latex path` mapping (only for downloads that succeeded).
 */
export async function materializeRemoteFigures(
  project: Project,
  stageDir: string
): Promise<Map<string, string>> {
  const mapping = new Map<string, string>()
  for (const url of collectRemoteFigureUrls(project)) {
    const image = await downloadRemoteImage(url)
    if (!image) {
      console.warn(`[remote-assets] Failed to download figure ${url.slice(0, 120)}; keeping original URL`)
      continue
    }
    // Forward slashes are mandatory inside .tex: on Windows path.join() would
    // emit `assets\remote\...`, and LaTeX would parse `\remote` as an
    // undefined control sequence instead of a path separator.
    const relative = path.posix.join("assets", "remote", remoteFileName(url, image.ext))
    const absolute = path.join(stageDir, relative)
    await fs.mkdir(path.dirname(absolute), { recursive: true })
    await fs.writeFile(absolute, image.buffer)
    mapping.set(url, relative)
  }
  return mapping
}

/** Replace each remote URL inside the generated .tex with its local relative path. */
export function rewriteTexRemoteUrls(tex: string, mapping: Map<string, string>): string {
  let rewritten = tex
  for (const [url, localPath] of mapping) {
    // Defense in depth: never emit Windows separators into .tex.
    rewritten = rewritten.split(url).join(normalizeLatexPath(localPath))
  }
  return rewritten
}