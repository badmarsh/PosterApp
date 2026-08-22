import fs from "fs"
import path from "path"

/**
 * Given a directory and an original filename, return the first non-existing
 * versioned path of the form `basename_edited_v{n}.ext`.
 *
 * Example:
 *   nextVersionedPath("/workspaces/ws1/assets", "plot1.pdf")
 *   → "/workspaces/ws1/assets/plot1_edited_v1.pdf"   (if that doesn't exist)
 *   → "/workspaces/ws1/assets/plot1_edited_v2.pdf"   (if v1 already exists)
 *
 * Pure filesystem check — no files are created or modified.
 */
export async function nextVersionedPath(dir: string, filename: string): Promise<string | null> {
  const ext = path.extname(filename)
  const base = path.basename(filename, ext)
  const coreBase = base.replace(/_edited_v\d+$/, "")

  const MAX_VERSIONS = 999
  for (let n = 1; n <= MAX_VERSIONS; n++) {
    const candidate = path.join(dir, `${coreBase}_edited_v${n}${ext}`)
    try {
      await fs.promises.access(candidate)
    } catch {
      return candidate
    }
  }
  return null
}
