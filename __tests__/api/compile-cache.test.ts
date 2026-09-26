import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workspace: { findUnique: vi.fn() },
  },
}))
vi.mock("@/lib/latex/compiler-runner", () => ({
  safeLog: vi.fn((l) => l),
  runSandboxedLatex: vi.fn(async () => "Mock pdflatex output"),
}))
vi.mock("@/lib/latex/remote-assets", () => ({
  materializeRemoteFigures: vi.fn(async () => new Map()),
  materializePublicFigures: vi.fn(async () => new Map()),
  rewriteTexRemoteUrls: vi.fn((tex) => tex),
}))
vi.mock("fs/promises", () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(async () => {}),
    stat: vi.fn(),
    mkdir: vi.fn(async () => {}),
    mkdtemp: vi.fn(async () => "/tmp/stage"),
    rm: vi.fn(async () => {}),
    cp: vi.fn(async () => {}),
    readdir: vi.fn(async () => []),
    copyFile: vi.fn(async () => {}),
    rename: vi.fn(async () => {}),
  },
}))

import { prisma } from "@/lib/prisma"
import { runSandboxedLatex } from "@/lib/latex/compiler-runner"
import fs from "fs/promises"
import { compileWorkspace } from "@/lib/latex/compile-workspace"

const p = vi.mocked(prisma)
const mockRunner = vi.mocked(runSandboxedLatex)
const mockFs = vi.mocked(fs)

describe("compileWorkspace caching", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(p.workspace.findUnique as any).mockResolvedValue({
      id: "ws_cache_test",
      revision: 5,
      name: "Cached Workspace",
      authors: "Author",
      venue: "Venue",
      assets: [],
      outputs: [
        {
          id: "out_1",
          isActive: true,
          templateId: "atlas",
          outputType: "poster",
          themeColor: "#ff0000",
          cards: [],
        },
      ],
    })
  })

  it("returns cached compilation if compile-cache.json and main.pdf match the current revision", async () => {
    // compile-cache.json matches
    ;(mockFs.readFile as any).mockResolvedValue(
      JSON.stringify({
        revision: 5,
        outputId: "out_1",
        templateId: "atlas",
        themeColor: "#ff0000",
        cardCount: 0,
        cardsHash: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
        log: "Cached log",
      })
    )
    // main.pdf exists and has content
    ;(mockFs.stat as any).mockResolvedValue({ size: 1024 })

    const result = await compileWorkspace("ws_cache_test")

    expect(result.ok).toBe(true)
    expect(result.cached).toBe(true)
    expect(result.log).toContain("Cached")
    expect(mockRunner).not.toHaveBeenCalled()
  })

  it("recompiles when revision in workspace is newer than the cache", async () => {
    // Cache has older revision 4, workspace has revision 5
    ;(mockFs.readFile as any).mockResolvedValue(
      JSON.stringify({
        revision: 4,
        outputId: "out_1",
        templateId: "atlas",
        themeColor: "#ff0000",
        cardCount: 0,
        cardsHash: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
      })
    )
    ;(mockFs.stat as any).mockResolvedValue({ size: 1024 })

    const result = await compileWorkspace("ws_cache_test")

    expect(mockRunner).toHaveBeenCalled()
    expect(result.ok).toBe(true)
    expect(result.cached).toBeFalsy()
  })

  it("recompiles when forceRecompile is true even if cache matches", async () => {
    ;(mockFs.readFile as any).mockResolvedValue(
      JSON.stringify({
        revision: 5,
        outputId: "out_1",
        templateId: "atlas",
        themeColor: "#ff0000",
        cardCount: 0,
        cardsHash: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
      })
    )
    ;(mockFs.stat as any).mockResolvedValue({ size: 1024 })

    const result = await compileWorkspace("ws_cache_test", { forceRecompile: true })

    expect(mockRunner).toHaveBeenCalled()
    expect(result.ok).toBe(true)
    expect(result.cached).toBeFalsy()
  })
})
