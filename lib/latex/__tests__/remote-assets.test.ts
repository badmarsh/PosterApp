import { describe, it, expect, vi, afterEach } from "vitest"
import fs from "fs/promises"
import os from "os"
import path from "path"
import {
  isRemoteUrl,
  collectRemoteFigureUrls,
  rewriteTexRemoteUrls,
  materializeRemoteFigures
} from "../remote-assets"
import type { Project } from "@/lib/poster-types"

describe("Remote Assets", () => {
  describe("isRemoteUrl", () => {
    it("identifies remote URLs correctly", () => {
      expect(isRemoteUrl("https://example.com/image.jpg")).toBe(true)
      expect(isRemoteUrl("http://example.com/image.jpg")).toBe(true)
      expect(isRemoteUrl("/local/path/image.jpg")).toBe(false)
      expect(isRemoteUrl("file:///local/image.jpg")).toBe(false)
      expect(isRemoteUrl(null)).toBe(false)
      expect(isRemoteUrl(undefined)).toBe(false)
      expect(isRemoteUrl("")).toBe(false)
    })
  })

  describe("collectRemoteFigureUrls", () => {
    it("collects all unique remote URLs from project cards", () => {
      const project: Project = {
        id: "ws1",
        revision: 1,
        name: "Test",
        authors: "Test Author",
        venue: "Test Venue",
        outputs: [
          {
            id: "out1",
            title: "Output 1",
            outputType: "poster",
            templateId: "atlas",
            cards: [
              {
                id: "card1",
                title: "Card 1",
                column: 1,
                order: 0,
                pattern: "bullets-image",
                content: "",
                table: { hasHeader: false, caption: "", rows: [] },
                figureLayout: "single",
                validation: "valid",
                figures: [
                  { id: "fig1", url: "https://example.com/image1.jpg", caption: "Image 1" },
                  { id: "fig2", url: "/local/image2.jpg", caption: "Image 2" }
                ]
              },
              {
                id: "card2",
                title: "Card 2",
                column: 2,
                order: 1,
                pattern: "bullets-two-images",
                content: "",
                table: { hasHeader: false, caption: "", rows: [] },
                figureLayout: "two-up",
                validation: "valid",
                figures: [
                  { id: "fig3", url: "https://example.com/image3.jpg", caption: "Image 3" },
                  { id: "fig4", url: "https://example.com/image1.jpg", caption: "Image 4" } // Duplicate
                ]
              }
            ]
          }
        ],
        assets: [],
        ingestFiles: [],
        activeOutputId: "out1"
      }

      const urls = collectRemoteFigureUrls(project)
      expect(urls).toEqual([
        "https://example.com/image1.jpg",
        "https://example.com/image3.jpg"
      ])
    })
  })

  describe("rewriteTexRemoteUrls", () => {
    it("rewrites remote URLs to local paths in LaTeX", () => {
      const tex = `
\\begin{center}
  \\includegraphics[width=1.0\\linewidth,keepaspectratio]{https://example.com/image.jpg}
\\end{center}
\\begin{minipage}[t]{0.495\\linewidth}
  \\centering
  \\includegraphics[width=\\linewidth,keepaspectratio]{https://example.com/image2.png}
\\end{minipage}
`

      const mapping = new Map([
        ["https://example.com/image.jpg", "assets/remote/remote-abc123.jpg"],
        ["https://example.com/image2.png", "assets/remote/remote-def456.png"]
      ])

      const rewritten = rewriteTexRemoteUrls(tex, mapping)
      
      expect(rewritten).toContain("assets/remote/remote-abc123.jpg")
      expect(rewritten).toContain("assets/remote/remote-def456.png")
      expect(rewritten).not.toContain("https://example.com/image.jpg")
      expect(rewritten).not.toContain("https://example.com/image2.png")
    })

    it("normalizes Windows backslash separators in mapping values", () => {
      const tex = "\\includegraphics{https://example.com/image.jpg}"
      const mapping = new Map([
        ["https://example.com/image.jpg", "assets\\remote\\remote-abc123.jpg"]
      ])
      const rewritten = rewriteTexRemoteUrls(tex, mapping)
      expect(rewritten).toBe("\\includegraphics{assets/remote/remote-abc123.jpg}")
    })
  })

  describe("materializeRemoteFigures", () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it("writes downloads under the stage dir and maps them to forward-slash LaTeX paths", async () => {
      const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          new Response(pngBytes, { status: 200, headers: { "content-type": "image/png" } })
        )
      )

      const stage = await fs.mkdtemp(path.join(os.tmpdir(), "remote-assets-"))
      try {
        const project: Project = {
          id: "ws1",
          name: "Test",
          authors: "Test Author",
          venue: "Test Venue",
          outputs: [
            {
              id: "out1",
              outputType: "poster",
              templateId: "atlas",
              title: "Poster",
              cards: [
                {
                  id: "card1",
                  title: "Card 1",
                  column: 1,
                  order: 0,
                  pattern: "bullets-image",
                  content: "Content",
                  table: { hasHeader: false, caption: "", rows: [] },
                  figures: [{ id: "fig1", url: "https://example.com/image.png", caption: "" }],
                  figureLayout: "single",
                  validation: "valid"
                }
              ]
            }
          ],
          assets: [],
          ingestFiles: [],
          activeOutputId: "out1"
        }

        const mapping = await materializeRemoteFigures(project, stage)

        const localPath = mapping.get("https://example.com/image.png")
        expect(localPath).toMatch(/^assets\/remote\/remote-[0-9a-f]{16}\.png$/)

        const segments = (localPath ?? "").split("/")
        const written = await fs.readFile(path.join(stage, ...segments))
        expect(new Uint8Array(written)).toEqual(pngBytes)
      } finally {
        await fs.rm(stage, { recursive: true, force: true })
      }
    })
  })
})