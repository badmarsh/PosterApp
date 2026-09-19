import { describe, it, expect } from "vitest"
import fs from "fs"
import path from "path"

describe("PdfSidebar & Global Loading Animations", () => {
  it("preserves exact 'Compiling with pdflatex…' string for Playwright test compatibility", () => {
    const sidebarPath = path.resolve(__dirname, "../../components/pdf-sidebar.tsx")
    const content = fs.readFileSync(sidebarPath, "utf8")
    expect(content).toContain("Compiling with pdflatex…")
  })

  it("promotes compile loading animation to GPU composited layer to bypass backdrop-filter repaint freeze", () => {
    const sidebarPath = path.resolve(__dirname, "../../components/pdf-sidebar.tsx")
    const content = fs.readFileSync(sidebarPath, "utf8")
    expect(content).toContain('willChange: "transform"')
    expect(content).toContain('transform: "translateZ(0)"')
    expect(content).toContain('role="status"')
    expect(content).toContain('aria-live="polite"')
  })

  it("renders a dual spinning ring and indeterminate progress shimmer bar in compile overlay", () => {
    const sidebarPath = path.resolve(__dirname, "../../components/pdf-sidebar.tsx")
    const content = fs.readFileSync(sidebarPath, "utf8")
    expect(content).toContain("compile-shimmer")
    expect(content).toContain("border-t-primary animate-spin")
  })

  it("exempts loading spinners and status indicators from prefers-reduced-motion suppression in globals.css", () => {
    const cssPath = path.resolve(__dirname, "../../app/globals.css")
    const content = fs.readFileSync(cssPath, "utf8")
    expect(content).toContain("*:not(.animate-spin, .animate-spin *, [role=\"status\"], [role=\"status\"] *, .preserve-motion, .preserve-motion *)")
  })

  it("defines explicit @keyframes spin and centered transform-origin for rock-solid cross-browser rotation", () => {
    const cssPath = path.resolve(__dirname, "../../app/globals.css")
    const content = fs.readFileSync(cssPath, "utf8")
    expect(content).toContain("@keyframes spin")
    expect(content).toContain("@keyframes compile-shimmer")
    expect(content).toContain("transform-origin: center !important")
  })
})
