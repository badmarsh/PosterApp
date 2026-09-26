import { createHash } from "crypto"
import path from "path"
import fs from "fs/promises"
import { normalizeLatexPath } from "./helpers"
import type { Project } from "@/lib/poster-types"
import { safeFetch } from "@/lib/safe-fetch"
import { detectedImageMime } from "@/lib/workspace-files"

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
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
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

interface DownloadedImage {
  buffer: Buffer
  ext: string
}

const ALLOWED_MIMES = new Set(Object.keys(MIME_TO_EXT))

/**
 * Download a remote image with SSRF protection (reserved-host + DNS checks on
 * every redirect hop), timeout, size cap, and content sniffing. Only real
 * raster/vector images and PDFs are accepted; anything else (HTML, JSON,
 * internal service responses) is discarded. Returns null on any failure.
 */
export async function downloadRemoteImage(url: string): Promise<DownloadedImage | null> {
  try {
    const res = await safeFetch(url, {
      timeoutMs: FETCH_TIMEOUT_MS,
      headers: { Accept: "image/*,application/pdf" },
    })
    if (!res.ok || !res.body) return null

    const declaredLength = Number(res.headers.get("content-length") ?? "0")
    if (declaredLength > MAX_BYTES) return null

    const declaredMime = res.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? ""
    if (declaredMime && !ALLOWED_MIMES.has(declaredMime)) return null

    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_BYTES) {
        await reader.cancel().catch(() => {})
        return null
      }
      chunks.push(value)
    }
    if (total === 0) return null
    const buffer = Buffer.concat(chunks)

    // Verify the bytes are actually an image/PDF. SVG has no magic bytes, so it
    // is accepted only when the server declared it and the body looks like XML.
    const sniffed = detectedImageMime(buffer)
    let ext: string
    if (sniffed) {
      ext = MIME_TO_EXT[sniffed]
    } else if (declaredMime === "image/svg+xml" && /^\s*(<\?xml|<svg)/i.test(buffer.subarray(0, 512).toString("utf8"))) {
      ext = ".svg"
    } else {
      return null
    }
    return { buffer, ext }
  } catch {
    return null
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
    const local = normalizeLatexPath(localPath)
    // Generators emit the URL through normalizeLatexPath (which strips TeX
    // specials), so match both the raw and the normalized spelling.
    for (const needle of new Set([url, normalizeLatexPath(url)])) {
      if (needle) rewritten = rewritten.split(needle).join(local)
    }
  }
  return rewritten
}
// ---------------------------------------------------------------------------
// App-relative figures (figures shipped with the app in `public/`)
// ---------------------------------------------------------------------------
/**
 * Figures referenced as `/figures/…` are served by Next from `public/`, which
 * pdflatex cannot read: inside the sandbox only the staging directory exists.
 * Demo/curated content and template galleries therefore use public-relative
 * paths, and this function copies the referenced files into the stage under
 * `assets/public/` so the very same `.tex` compiles — both in the app and in an
 * exported ZIP opened in Overleaf.
 *
 * Only paths that resolve inside `public/` are accepted (no `..` traversal, no
 * absolute paths, no `/api/…` routes), and only image extensions pdflatex can
 * include are copied. Unresolved paths are left untouched so the generator's
 * `\PosterIncludeGraphics` fallback keeps working.
 */
const PUBLIC_FIGURE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".pdf", ".png", ".gif"]

/** App-relative figure URLs referenced by any output card. */
export function collectPublicFigureUrls(project: Project): string[] {
  const urls = new Set<string>()
  for (const output of project.outputs) {
    for (const card of output.cards) {
      for (const fig of card.figures ?? []) {
        const url = fig?.url?.trim()
        if (!url) continue
        if (isRemoteUrl(url)) continue
        if (!url.startsWith("/")) continue
        if (url.startsWith("/api/")) continue
        urls.add(url.split("?")[0].split("#")[0])
      }
    }
  }
  return [...urls]
}

export function publicFigureFileName(url: string): string {
  const ext = PUBLIC_FIGURE_EXTENSIONS.find((candidate) => url.toLowerCase().endsWith(candidate)) ?? ".png"
  const hash = createHash("sha256").update(url).digest("hex").slice(0, 16)
  const base = path.basename(url).replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 40)
  return `${base || "figure"}-${hash}${ext}`
}

export async function materializePublicFigures(
  project: Project,
  stageDir: string,
  publicDir = path.join(process.cwd(), "public"),
): Promise<Map<string, string>> {
  const mapping = new Map<string, string>()
  for (const url of collectPublicFigureUrls(project)) {
    const candidate = path.resolve(publicDir, `.${url}`)
    // Resolve-then-check keeps `..` and absolute-path tricks out of the stage.
    if (!candidate.startsWith(path.resolve(publicDir) + path.sep)) continue
    let buffer: Buffer
    try {
      // turbopackIgnore: the path is already resolved inside `publicDir` and
      // verified above; without the hint the bundler treats this as arbitrary
      // filesystem access and traces the whole project into the server output.
      buffer = await fs.readFile(/* turbopackIgnore: true */ candidate)
    } catch {
      continue
    }
    const relative = path.posix.join("assets", "public", publicFigureFileName(url))
    const absolute = path.join(stageDir, relative)
    await fs.mkdir(path.dirname(absolute), { recursive: true })
    await fs.writeFile(absolute, buffer)
    mapping.set(url, relative)
  }
  return mapping
}
