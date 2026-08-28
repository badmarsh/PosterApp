import fs from "fs"
import path from "path"

/**
 * Creates an empty file using an exclusive flag ('wx') to prevent race conditions.
 * Returns the atomic path generated.
 */
export async function atomicCreateVersionedFile(dir: string, filename: string, forceExtension?: string): Promise<string | null> {
  const originalExt = path.extname(filename)
  const base = path.basename(filename, originalExt)
  const coreBase = base.replace(/_edited_v\d+$/, "")
  const ext = forceExtension || originalExt

  const MAX_VERSIONS = 999
  for (let n = 1; n <= MAX_VERSIONS; n++) {
    const candidate = path.join(dir, `${coreBase}_edited_v${n}${ext}`)
    try {
      const handle = await fs.promises.open(candidate, "wx")
      await handle.close()
      return candidate
    } catch (err: any) {
      if (err.code !== "EEXIST") {
        throw err;
      }
    }
  }
  return null
}
