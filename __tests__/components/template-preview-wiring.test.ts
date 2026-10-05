import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { TEMPLATE_REGISTRY } from "@/lib/output-types"

const read = (...segments: string[]) => fs.readFileSync(path.join(process.cwd(), ...segments), "utf8")

describe("template previews are wired into list and detail", () => {
  const component = read("components", "template-preview-image.tsx")
  const picker = read("components", "poster-preview.tsx")

  it("renders the generated mockup asset, preferring PNG and degrading to SVG then a placeholder", () => {
    expect(component).toContain("src={`/template-previews/${templateId}.${format}`}")
    expect(component).toContain('useState<PreviewFormat>("png")')
    expect(component).toContain('format === "png"')
    expect(component).toContain('setFormat("svg")')
    expect(component).toContain('setFormat("fallback")')
    expect(component).toContain("Preview unavailable")
  })

  it("keeps the shared 4:3 canvas and accessible labelling", () => {
    expect(component).toContain("aspect-[4/3]")
    expect(component).toContain('data-testid="template-preview-image"')
    expect(component).toContain("data-template-id={templateId}")
    expect(component).toContain("aria-busy={isLoading || undefined}")
    expect(component).toContain("const accessibleLabel = `${label} template preview`")
    // Decorative thumbnails must not be announced twice next to their label.
    expect(component).toContain('alt={decorative ? "" : accessibleLabel}')
    expect(component).toContain("aria-hidden={decorative || undefined}")
  })

  it("shows a preview for every option in the template list", () => {
    expect(picker).toContain('import { TemplatePreviewImage } from "@/components/template-preview-image"')
    const list = picker.slice(picker.indexOf('data-testid="template-option"'))
    const listItem = list.slice(0, list.indexOf("</button>"))
    expect(listItem, "list options render the template mockup").toContain("<TemplatePreviewImage")
    expect(listItem).toContain("templateId={tmpl.id}")
    expect(listItem).toContain("decorative")
    // A missing asset still shows a schematic instead of an empty box.
    expect(listItem).toContain("<LayoutDiagram")
  })

  it("shows the same mockup, larger, in the selected-template detail panel", () => {
    const detail = picker.slice(picker.indexOf("function TemplatePreview("))
    const detailBody = detail.slice(0, detail.indexOf("function AddOutputDialog"))
    expect(detailBody).toContain("<TemplatePreviewImage")
    expect(detailBody).toContain("templateId={template.id}")
    expect(detailBody).toContain('loading="eager"')
    expect(detailBody).toContain("fallback={")

    const dialog = picker.slice(picker.indexOf("function AddOutputDialog"))
    expect(dialog, "detail panel renders the large preview").toContain("<TemplatePreview template={activeTmpl} />")
  })

  it("resolves every registered template to an asset that exists", () => {
    for (const template of TEMPLATE_REGISTRY) {
      expect(fs.existsSync(path.join(process.cwd(), "public", "template-previews", `${template.id}.png`)), `${template.id}.png`).toBe(true)
      expect(fs.existsSync(path.join(process.cwd(), "public", "template-previews", `${template.id}.svg`)), `${template.id}.svg`).toBe(true)
    }
  })
})
