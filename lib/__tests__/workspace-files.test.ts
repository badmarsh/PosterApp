import { describe, it, expect } from "vitest"
import fc from "fast-check"
import path from "path"
import { workspacePath } from "../workspace-files"

describe("workspacePath", () => {
  const root = path.resolve(process.cwd(), "workspaces", "test-ws")

  it("returns the workspace root when called with no parts", () => {
    expect(workspacePath("test-ws")).toBe(root)
  })

  it("returns a path under the workspace root for safe sub-paths", () => {
    const result = workspacePath("test-ws", "assets", "image.png")
    expect(result).toBe(path.resolve(root, "assets", "image.png"))
  })

  it("throws on .. traversal", () => {
    expect(() => workspacePath("test-ws", "..")).toThrow("Unsafe workspace path")
    expect(() => workspacePath("test-ws", "assets", "..", "..", "secrets")).toThrow("Unsafe workspace path")
  })

  it("throws on absolute path injection", () => {
    expect(() => workspacePath("test-ws", "/etc/passwd")).toThrow("Unsafe workspace path")
  })

  it("never escapes the workspace root (property test)", () => {
    fc.assert(
      fc.property(
        fc.string({ unit: "grapheme-composite", minLength: 1, maxLength: 32 }),
        fc.array(fc.string({ unit: "grapheme-composite" }), { maxLength: 8 }),
        (id, parts) => {
          const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "_")
          if (!safeId) return true
          try {
            const p = workspacePath(safeId, ...parts)
            const expectedRoot = path.resolve(process.cwd(), "workspaces", safeId)
            return p === expectedRoot || p.startsWith(expectedRoot + path.sep)
          } catch {
            return true // throwing on unsafe input is the correct behavior
          }
        }
      ),
      { numRuns: 1000 }
    )
  })
})