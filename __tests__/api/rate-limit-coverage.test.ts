import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync, statSync } from "fs"
import { join } from "path"

const API_DIR = join(__dirname, "..", "..", "app", "api")

const MUTATING_METHODS = [
  "export async function POST",
  "export async function PUT",
  "export async function PATCH",
  "export async function DELETE",
]

/**
 * Recursively collect all route.ts files under app/api/.
 */
function collectRouteFiles(dir: string): string[] {
  const entries = readdirSync(dir)
  const results: string[] = []
  for (const entry of entries) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      results.push(...collectRouteFiles(full))
    } else if (entry === "route.ts") {
      results.push(full)
    }
  }
  return results
}

describe("Rate-limit coverage for mutating API routes", () => {
  const routeFiles = collectRouteFiles(API_DIR)

  it("found at least one route file (sanity check)", () => {
    expect(routeFiles.length).toBeGreaterThan(0)
  })

  for (const filePath of routeFiles) {
    const relative = filePath.replace(API_DIR, "app/api")
    const content = readFileSync(filePath, "utf-8")

    const hasMutatingMethod = MUTATING_METHODS.some((m) => content.includes(m))
    if (!hasMutatingMethod) continue // GET-only route — skip

    it(`${relative} includes rateLimitAsync`, () => {
      expect(content).toContain("rateLimitAsync")
    })
  }
})
