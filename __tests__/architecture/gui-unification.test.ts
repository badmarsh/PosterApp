import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"

describe("GUI Audit, Typographic Scale & Modular Architecture", () => {
  it("decomposes monolithic HeaderInspector into dedicated subcomponents", () => {
    const dir = path.resolve(__dirname, "../../components/header-inspector")
    expect(fs.existsSync(dir)).toBe(true)
    expect(fs.existsSync(path.join(dir, "index.tsx"))).toBe(true)
    expect(fs.existsSync(path.join(dir, "title-fields.tsx"))).toBe(true)
    expect(fs.existsSync(path.join(dir, "authors-manager.tsx"))).toBe(true)
    expect(fs.existsSync(path.join(dir, "venue-styling.tsx"))).toBe(true)
    expect(fs.existsSync(path.join(dir, "template-branding.tsx"))).toBe(true)
    expect(fs.existsSync(path.join(dir, "operations-section.tsx"))).toBe(true)
    expect(fs.existsSync(path.join(dir, "shared.tsx"))).toBe(true)

    // Verify main entry point is a clean facade under 20 lines
    const rootHeader = fs.readFileSync(path.resolve(__dirname, "../../components/header-inspector.tsx"), "utf8")
    expect(rootHeader.split("\n").length).toBeLessThan(20)
  })

  it("ensures no arbitrary one-off font utilities (text-[13px] or text-[15px]) remain in components", () => {
    const componentsDir = path.resolve(__dirname, "../../components")
    const checkDir = (dir: string) => {
      const files = fs.readdirSync(dir)
      for (const file of files) {
        const full = path.join(dir, file)
        const stat = fs.statSync(full)
        if (stat.isDirectory()) {
          checkDir(full)
        } else if (/\.(tsx|ts)$/.test(file)) {
          const content = fs.readFileSync(full, "utf8")
          expect(content).not.toMatch(/text-\[13px\]/)
          expect(content).not.toMatch(/text-\[15px\]/)
        }
      }
    }
    checkDir(componentsDir)
  })

  it("provides unified breadcrumb / back buttons in deep Thesis Review sub-panels", () => {
    const expertView = fs.readFileSync(path.resolve(__dirname, "../../components/thesis-review/expert-review-workspace.tsx"), "utf8")
    expect(expertView).toContain("← Späť na prehľad")

    const planView = fs.readFileSync(path.resolve(__dirname, "../../components/thesis-review/analysis-plan-panel.tsx"), "utf8")
    expect(planView).toContain("← Späť na prehľad")
  })

  it("renders polished EmptyState components across core list views", () => {
    const histView = fs.readFileSync(path.resolve(__dirname, "../../components/history-panel.tsx"), "utf8")
    expect(histView).toContain("EmptyState")
    expect(histView).toContain("Create First Snapshot")

    const revView = fs.readFileSync(path.resolve(__dirname, "../../components/thesis-review/thesis-review-panel.tsx"), "utf8")
    expect(revView).toContain("EmptyState")
    expect(revView).toContain("Start AI Evaluation")

    const figView = fs.readFileSync(path.resolve(__dirname, "../../components/card-inspector/figures-tab.tsx"), "utf8")
    expect(figView).toContain("EmptyState")
    expect(figView).toContain("Upload Figure")
  })
})
