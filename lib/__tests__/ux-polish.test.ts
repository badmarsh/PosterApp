import { describe, it, expect } from "vitest"
import { pluralizeSk, decodeHtmlEntities, cn } from "@/lib/utils"
import * as fs from "fs/promises"

describe("UX Polish — lib/utils helpers", () => {
  it("pluralizeSk handles Slovak three-form plural", () => {
    expect(pluralizeSk(1, "chunk", "chunky", "chunkov")).toBe("chunk")
    expect(pluralizeSk(2, "chunk", "chunky", "chunkov")).toBe("chunky")
    expect(pluralizeSk(3, "chunk", "chunky", "chunkov")).toBe("chunky")
    expect(pluralizeSk(4, "chunk", "chunky", "chunkov")).toBe("chunky")
    expect(pluralizeSk(5, "chunk", "chunky", "chunkov")).toBe("chunkov")
    expect(pluralizeSk(0, "chunk", "chunky", "chunkov")).toBe("chunkov")
  })

  it("decodeHtmlEntities decodes named and numeric entities", () => {
    expect(decodeHtmlEntities("&amp; &lt; &gt;")).toBe("& < >")
    expect(decodeHtmlEntities("&#39; &#x27;")).toBe("' '")
    expect(decodeHtmlEntities("a &amp;#x27; b")).toBe("a ' b")
  })

  it("cn merges tailwind classes", () => {
    expect(cn("p-2", "p-4")).toBe("p-4")
    expect(cn("bg-card", { "text-foreground": true })).toContain("bg-card")
  })
})

describe("UX Polish — design token alignment", () => {
  it("globals.css defines semantic tokens", async () => {
    const css = await fs.readFile("app/globals.css", "utf-8")
    expect(css).toContain("--warning")
    expect(css).toContain("--success")
    expect(css).toContain("--destructive")
    expect(css).toContain("--status-info")
    expect(css).toContain("--destructive-foreground")
    expect(css).toContain("--risk-foreground")
    expect(css).toContain("--background")
    expect(css).toContain("--foreground")
  })
  it("StatusIcon uses design tokens not hardcoded amber", async () => {
    const src = await fs.readFile("components/status.tsx", "utf-8")
    expect(src).not.toContain("text-amber-500")
    expect(src).toContain("text-warning")
  })
  it("useCopyFeedback hook exists and exports copy helpers", async () => {
    const src = await fs.readFile("hooks/use-copy-feedback.ts", "utf-8")
    expect(src).toContain("export function useCopyFeedback")
    expect(src).toContain("navigator.clipboard.writeText")
    expect(src).toContain("toast.success")
  })
  it("CopyButton component uses design tokens and transition", async () => {
    const src = await fs.readFile("components/ui/copy-button.tsx", "utf-8")
    expect(src).toContain("transition-colors duration-150")
    expect(src).toContain("text-success")
  })
  it("AcademicSearchDialog uses skeleton and EmptyState", async () => {
    const src = await fs.readFile("components/academic-search-dialog.tsx", "utf-8")
    expect(src).toContain("Skeleton")
    expect(src).toContain("EmptyState")
    expect(src).toContain("useCopyFeedback")
    expect(src).toContain("isCopied")
  })
  it("CommandPalette indexes bibliography and inbox", async () => {
    const src = await fs.readFile("components/command-palette.tsx", "utf-8")
    expect(src).toContain("setIsBibManagerOpen")
    expect(src).toContain("setIsEquationLibraryOpen")
    expect(src).toContain("View Approval Inbox")
    expect(src).toContain("Compile / Recompile PDF")
  })
})

describe("UX Polish — error lens & quick fixes (2026-09-17 audit)", () => {
  it("pdf-sidebar renders the structured error lens, not only the raw log", async () => {
    const src = await fs.readFile("components/pdf-sidebar.tsx", "utf-8")
    expect(src).toContain("parseCompileLog")
    expect(src).toContain("attributeIssuesToCards")
    expect(src).toContain("Show raw log")
    expect(src).toContain("setInspectorTab")
  })

  it("CardInspector surfaces modular quick fixes and the height meter", async () => {
    const inspector = await fs.readFile("components/card-inspector.tsx", "utf-8")
    const quickFixes = await fs.readFile("components/card-inspector/quick-fixes-panel.tsx", "utf-8")
    expect(inspector).toContain("HeightMeter")
    expect(inspector).toContain("estimateHeightBreakdown")
    expect(quickFixes).toContain("deriveQuickFixes")
    expect(quickFixes).toContain("findDanglingCiteKeys")
    expect(quickFixes).toContain("findDanglingRefKeys")
  })

  it("CardInspector uses semantic warning tokens (no hardcoded amber)", async () => {
    const src = await fs.readFile("components/card-inspector.tsx", "utf-8")
    expect(src).not.toContain("amber-500")
  })

  it("quick fixes and log parser are unit-tested", async () => {
    const qf = await fs.readFile("lib/latex/__tests__/quick-fixes.test.ts", "utf-8")
    expect(qf).toContain("deriveQuickFixes")
    const lp = await fs.readFile("lib/latex/__tests__/log-parser.test.ts", "utf-8")
    expect(lp).toContain("parseCompileLog")
  })
})

describe("UX Polish — grounding, preview decomposition and responsive chrome", () => {
  const previewFiles = [
    "components/preview/poster-canvas.tsx",
    "components/preview/slide-deck-view.tsx",
    "components/preview/paper-document-view.tsx",
    "components/preview/preview-toolbar.tsx",
    "components/preview/column-occupancy-meter.tsx",
  ]

  it("keeps the preview decomposition as live imports, not orphaned files", async () => {
    const preview = await fs.readFile("components/poster-preview.tsx", "utf-8")
    for (const file of previewFiles) {
      await fs.access(file)
    }
    expect(preview).toContain("PosterCanvas")
    expect(preview).toContain("SlideDeckView")
    expect(preview).toContain("PaperDocumentView")
    expect(preview).toContain("PreviewToolbar")
  })

  it("renders grounding affordances with semantic tokens and safe markdown math", async () => {
    const content = await fs.readFile("components/card-inspector/content-tab.tsx", "utf-8")
    const canvas = await fs.readFile("components/poster-preview.tsx", "utf-8")
    const math = await fs.readFile("components/preview/inline-card-content.tsx", "utf-8")
    const sourceMarkdown = await fs.readFile("components/thesis-review/source-markdown-view.tsx", "utf-8")
    expect(content).toContain("EvidenceChip")
    expect(content).toContain("SuggestedAssetsTray")
    expect(content).toContain("autoShrinkCardAction")
    expect(canvas).toContain("attributeIssuesToCards")
    expect(canvas).toContain("InlineCardContent")
    expect(math).toContain("remarkMath")
    expect(math).not.toContain("dangerouslySetInnerHTML")
    expect(sourceMarkdown).toContain("rehypeSanitize")
    expect(sourceMarkdown).toContain("trust: false")
  })

  it("provides one complete UI dictionary for Slovak, Czech and English", async () => {
    const source = await fs.readFile("lib/i18n/ui.ts", "utf-8")
    const switcher = await fs.readFile("components/language-switcher.tsx", "utf-8")
    expect(source).toContain('export const UI_LANGUAGES = ["sk", "cs", "en"] as const')
    expect(source).toContain("export const UI_COPY")
    expect(switcher).toContain("DropdownMenu")
    expect(switcher).toContain("setLanguage")
  })

  it("moves the multi-sidebar layout to the responsive pane shell below 1280px", async () => {
    const media = await fs.readFile("hooks/use-media-query.ts", "utf-8")
    const shell = await fs.readFile("components/layout/shell.tsx", "utf-8")
    expect(media).toContain("min-width: 1280px")
    expect(shell).toContain("MobileNavButton")
    expect(shell).toContain("absolute inset-0")
  })
})

describe("UX Polish — design token sweep (2026-09-17 audit, friction #5)", () => {
  const FILES = [
    "components/structure-sidebar.tsx",
    "components/agent-panel.tsx",
    "components/agent/approval-inbox.tsx",
    "components/settings/agent-integration-panel.tsx",
    "components/poster-preview.tsx",
    "components/research-lab-templates.tsx",
    "components/equation-registry-dialog.tsx",
    "components/header-inspector.tsx",
    "components/thesis-review/analysis-plan-panel.tsx",
    "components/thesis-review/defense-prep-panel.tsx",
    "components/academic-search-dialog.tsx",
    "components/showcase-gallery.tsx",
    "components/deerflow/deerflow-panel.tsx",
  ]

  it.each(FILES)("semantic-only tokens in %s (no amber/emerald/green/blue/red-500)", async (file) => {
    const src = await fs.readFile(file, "utf-8")
    expect(src).not.toMatch(/(?:bg|text|border)-(?:amber|emerald|green|blue|red)-500/)
    expect(src).not.toContain("/100/10")
  })

  it("compile status and defense verdicts use semantic tokens", async () => {
    const preview = await fs.readFile("components/preview/preview-toolbar.tsx", "utf-8")
    expect(preview).toContain("text-success")
    const panel = await fs.readFile("components/thesis-review/defense-prep-panel.tsx", "utf-8")
    expect(panel).toContain("bg-success/10")
    expect(panel).toContain("RehearsalTimer")
    expect(panel).toContain("buildDefensePackMarkdown")
  })
})

describe("UX Polish — KaTeX HTML injection safety (debug-polish sprint)", () => {
  const KATEX_HTML_SITES = [
    "components/equation-registry-dialog.tsx",
    "components/ingestion/asset-list.tsx",
    "components/scanner/image-ocr-dialog.tsx",
    "components/thesis-review/evidence-quote-viewer.tsx",
    "lib/services/equation-service.ts",
  ]

  it.each(KATEX_HTML_SITES)("%s pins trust:false on every DOM-bound katex render", async (file) => {
    const src = await fs.readFile(file, "utf-8")
    expect(src).toContain("trust: false")
    // Every rendered-HTML call must pass an options object that includes trust: false.
    // (A validation-only call whose output is discarded is exempt.)
    const renderCalls = src.split("katex.renderToString(").slice(1)
    expect(renderCalls.length).toBeGreaterThan(0)
    for (const call of renderCalls) {
      const optionsStart = call.indexOf("{")
      if (optionsStart === -1) continue
      const options = call.slice(optionsStart, call.indexOf(")", optionsStart))
      // Formula-validation probes ({ throwOnError: true }) never reach the DOM.
      const isValidationProbe = options.includes("throwOnError: true") && !options.includes("displayMode")
      if (isValidationProbe) continue
      expect(options).toContain("trust: false")
    }
  })

  it("showcase gallery and deerflow panel stay free of raw palette classes", async () => {
    for (const file of ["components/showcase-gallery.tsx", "components/deerflow/deerflow-panel.tsx"]) {
      const src = await fs.readFile(file, "utf-8")
      expect(src).not.toMatch(/(?:bg|text|border)-(?:amber|emerald|green|blue|red|rose|sky|indigo|zinc|gray|slate)-\d/)
      expect(src).not.toContain("text-white")
      expect(src).not.toContain("bg-black/")
    }
  })
})
