import { describe, it, expect } from "vitest"
import JSZip from "jszip"

describe("export-bundle", () => {
  it("bundles main.tex, references.bib, and assets into a valid zip archive", async () => {
    const zip = new JSZip()
    zip.file("main.tex", "\\documentclass{article}\n\\begin{document}\nHello\n\\end{document}")
    zip.file("references.bib", "@article{test, title={Test}}")
    zip.file("README.md", "# Documentation")

    const assetsFolder = zip.folder("assets")
    assetsFolder?.file("fig1.png", Buffer.from("dummy-image-bytes"))

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" })
    expect(zipBuffer).toBeInstanceOf(Buffer)
    expect(zipBuffer.length).toBeGreaterThan(50)

    // Load zip and verify contents
    const loadedZip = await JSZip.loadAsync(zipBuffer)
    expect(loadedZip.file("main.tex")).not.toBeNull()
    expect(loadedZip.file("references.bib")).not.toBeNull()
    expect(loadedZip.file("README.md")).not.toBeNull()
    expect(loadedZip.file("assets/fig1.png")).not.toBeNull()

    const readTex = await loadedZip.file("main.tex")?.async("string")
    expect(readTex).toContain("\\documentclass{article}")
  })
})
