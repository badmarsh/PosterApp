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
export function nextVersionedPath(dir: string, filename: string): string {
  const ext = path.extname(filename)
  const base = path.basename(filename, ext)

  // Strip any existing _edited_vN suffix so re-editing an already-edited file
  // still increments from the canonical base name.
  const coreBase = base.replace(/_edited_v\d+$/, "")

  let n = 1
  while (true) {
    const candidate = path.join(dir, `${coreBase}_edited_v${n}${ext}`)
    if (!fs.existsSync(candidate)) {
      return candidate
    }
    n++
  }
}
