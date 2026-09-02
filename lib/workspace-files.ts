import path from "path"

export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024 // 200 MB — supports large PhD dissertations (50–150 MB)
export const SAFE_FILE_ID = /^[A-Za-z0-9_-]{1,96}$/
export const SAFE_FILENAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,180}$/

/**
 * Root directory for all workspace files (assets, sources, compiled PDFs).
 * Reads WORKSPACES_DIR env var if set (useful in Docker / custom deployments),
 * otherwise falls back to <cwd>/workspaces.  Single source of truth — replaces
 * every scattered `path.join(process.cwd(), "workspaces")` call.
 */
export const WORKSPACES_ROOT: string = process.env.WORKSPACES_DIR
  ? path.resolve(process.env.WORKSPACES_DIR)
  : path.resolve(process.cwd(), "workspaces")

export function workspacePath(workspaceId: string, ...parts: string[]) {
  const root = path.resolve(WORKSPACES_ROOT, workspaceId)
  const result = path.resolve(root, ...parts)
  if (result !== root && !result.startsWith(`${root}${path.sep}`)) throw new Error("Unsafe workspace path")
  return result
}

export function detectedImageMime(bytes: Uint8Array) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).every((v, i) => v === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][i])) return "image/png"
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg"
  if (new TextDecoder().decode(bytes.subarray(0, 6)) === "GIF87a" || new TextDecoder().decode(bytes.subarray(0, 6)) === "GIF89a") return "image/gif"
  if (new TextDecoder().decode(bytes.subarray(0, 12)).startsWith("RIFF") && new TextDecoder().decode(bytes.subarray(8, 12)) === "WEBP") return "image/webp"
  if (new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-") return "application/pdf"
  return null
}

export function detectedPdf(bytes: Uint8Array) {
  return new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-"
}
