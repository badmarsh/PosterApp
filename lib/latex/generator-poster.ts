import type { Card, Project, OutputConfig } from "@/lib/poster-types"
import { parseMarkdownToLatex } from "./parser"
import { extractCiteKeys } from "@/lib/bib-parser"
import { getAtlasTemplate, getMinimalTemplate, getGeminiTemplate, getTikzposterTemplate, getA0PosterTemplate } from "./templates"
import type { LatexGenerator } from "./types"
import { indent, assetUrlToLatexPath } from "./helpers"

function generateTable(card: Card): string {
  const rows = card.table.rows
  if (!rows.length) return "% no table rows"
  const cols = rows[0].length
  const colSpec = Array.from({ length: cols }, (_, i) => (i === 0 ? "l" : "c")).join("|")
  const body = rows
    .map((r, idx) => {
      const cells = r.map((c) => parseMarkdownToLatex(c)).join(" & ")
      if (idx === 0 && card.table.hasHeader) {
        return `\\hline\n${cells} \\\\\n\\hline`
      }
      return `${cells} \\\\`
    })
    .join("\n")
  const caption = card.table.caption
    ? `\n{\\small ${parseMarkdownToLatex(card.table.caption)}}`
    : ""
  return `\\resizebox{\\linewidth}{!}{\n\\begin{tabular}{|${colSpec}|}\\hline\n${indent(body)}\n\\hline\n\\end{tabular}\n}${caption}`
}

function generateFigures(card: Card, workspaceId = ""): string {
  const figs = (card.figures ?? []).filter((f): f is NonNullable<typeof f> => Boolean(f?.url?.trim()))
  if (!figs.length) return "% no figures"

  function latexPath(url: string): string {
    return workspaceId ? assetUrlToLatexPath(url, workspaceId) : url
  }

  if (figs.length >= 2) {
    const [a, b] = figs.slice(0, 2)
    const captionA = a.caption ? `\\\\\n  {\\small ${parseMarkdownToLatex(a.caption)}}` : ""
    const captionB = b.caption ? `\\\\\n  {\\small ${parseMarkdownToLatex(b.caption)}}` : ""
    return [
      `\\begin{minipage}[t]{0.495\\linewidth}\n  \\centering\n  \\includegraphics[width=\\linewidth]{${latexPath(a.url)}}${captionA}\n\\end{minipage}%`,
      `\\hfill`,
      `\\begin{minipage}[t]{0.495\\linewidth}\n  \\centering\n  \\includegraphics[width=\\linewidth]{${latexPath(b.url)}}${captionB}\n\\end{minipage}`
    ]
      .filter(Boolean)
      .join("\n")
  }

  const f = figs[0]
  const captionLine = f.caption
    ? `\n{\\small ${parseMarkdownToLatex(f.caption)}}`
    : ""
  return `\\begin{center}\n  \\includegraphics[width=1.0\\linewidth]{${latexPath(f.url)}}\n\\end{center}${captionLine}`
}

export function generateLatexForCard(card: Card, workspaceId = "", usedBibKeys: string[] = [], templateId = ""): string {
  const parts: string[] = []

  if (card.pattern === "references") {
    const nociteCmd = usedBibKeys.length > 0 ? `\\nocite{${usedBibKeys.join(",")}}` : "% no citations used"
    parts.push(`\\begin{center}\n  \\begingroup\n  \\renewcommand{\\section}[2]{} % disable the bibliography section header\n  ${nociteCmd}\n  \\bibliographystyle{plain}\n  \\bibliography{references}\n  \\endgroup\n\\end{center}`)
  } else {
    if (card.pattern !== "image-focused" && card.content.trim()) {
      parts.push(parseMarkdownToLatex(card.content.trim()))
    }
    if (card.pattern === "bullets-table") {
      parts.push(generateTable(card))
    }
    if (
      card.pattern === "bullets-image" ||
      card.pattern === "bullets-two-images" ||
      card.pattern === "image-focused"
    ) {
      parts.push(generateFigures(card, workspaceId))
    }
  }

  const body = parts.join("\n\n")
  const title = parseMarkdownToLatex(card.title)
  if (templateId === "gemini") {
    return `% block id: ${card.id}  (column ${card.column}, order ${card.order})\n\\begin{block}{${title}}\n${body}\n\\end{block}`
  }
  if (templateId === "a0poster") {
    return `% block id: ${card.id}  (column ${card.column}, order ${card.order})\n\\section*{${title}}\n${body}`
  }
  return `% block id: ${card.id}  (column ${card.column}, order ${card.order})\n\\block{${title}}{\n${indent(body)}\n}`
}

export class TikzPosterGenerator implements LatexGenerator {
  outputType = "poster" as const
  templateId: string

  constructor(theme = "atlas") {
    this.templateId = theme
  }

  generateDocument(project: Project, outputConfig: OutputConfig, workspaceId = ""): string {
    const usedKeys = new Set<string>()
    for (const card of (project.outputs?.find(o => o.id === project.activeOutputId)?.cards ?? [])) {
      const textParts = [card.content]
      if (card.table?.caption) textParts.push(card.table.caption)
      if (Array.isArray(card.figures)) card.figures.forEach(f => { if (f?.caption) textParts.push(f.caption) })
      extractCiteKeys(textParts.join("\n")).forEach(k => usedKeys.add(k))
    }
    const usedKeysArray = Array.from(usedKeys)

    const columns = [1, 2, 3]
      .map((col) => {
        const cards = (project.outputs?.find(o => o.id === project.activeOutputId)?.cards ?? [])
          .filter((c) => c.column === col)
          .sort((a, b) => a.order - b.order)
        const blocks = cards
          .map((c) => indent(generateLatexForCard(c, workspaceId, usedKeysArray, this.templateId)))
          .join("\n\n")

        if (this.templateId === "gemini") {
           return `% ===== Column ${col} =====\n\\begin{column}{0.31\\textwidth}\n${blocks}\n\\end{column}`
        }
        if (this.templateId === "a0poster") {
          // a0poster uses \begin{multicols}{3} — no \column{} wrappers needed
          return `% ===== Column ${col} =====\n${blocks}`
        }
        return `% ===== Column ${col} =====\n\\column{0.333}\n\n${blocks}`
      })
      .join("\n\n")

    let templateContent = "";
    let endDocumentContent = "\\end{document}";
    let beginColumns = "\\begin{columns}";
    let endColumns = "\\end{columns}";

    const themeColor = outputConfig.themeColor ?? undefined
    switch (outputConfig.templateId?.toLowerCase()) {
      case "minimal":
        templateContent = getMinimalTemplate(project, themeColor);
        break;
      case "gemini":
        templateContent = getGeminiTemplate(project, themeColor);
        beginColumns = "\\begin{columns}[t]";
        endDocumentContent = "\\end{frame}\n\\end{document}";
        break;
      case "tikzposter":
        templateContent = getTikzposterTemplate(project, themeColor);
        break;
      case "a0poster":
        templateContent = getA0PosterTemplate(project, themeColor);
        beginColumns = "\\begin{multicols}{3}";
        endColumns = "\\end{multicols}";
        break;
      case "atlas":
      default:
        templateContent = getAtlasTemplate(project, themeColor, workspaceId);
        break;
    }

    return `% =============================================================================
${templateContent.trim()}

${beginColumns}

${indent(columns)}

${endColumns}
${endDocumentContent}`
  }
}



