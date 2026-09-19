import { describe, it, expect } from "vitest"
import { parsePdfWithFallback } from "@/lib/services/pdf-fallback-parser"
import fs from "fs"
import path from "path"

describe("pdf-fallback-parser", () => {
  it("extracts text and headings from a real PDF file without fake worker errors", async () => {
    const fixturePath = path.resolve(process.cwd(), "tests/fixtures/test.pdf")
    const pdfBytes = fs.readFileSync(fixturePath)

    const result = await parsePdfWithFallback(pdfBytes, "sample-thesis.pdf")

    expect(result).toBeDefined()
    expect(result.pageCount).toBeGreaterThanOrEqual(1)
    expect(result.md_content).toContain("# sample thesis")
    expect(result.md_content.length).toBeGreaterThan(10)
  })

  it("handles Uint8Array input buffer format", async () => {
    const fixturePath = path.resolve(process.cwd(), "tests/fixtures/test.pdf")
    const pdfBytes = fs.readFileSync(fixturePath)
    const uint8 = new Uint8Array(pdfBytes)

    const result = await parsePdfWithFallback(uint8, "test_file.pdf")
    expect(result.pageCount).toBe(1)
    expect(result.md_content).toContain("Page 1")
  })
})
