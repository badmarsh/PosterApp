import type { Card, Project } from "@/lib/poster-types"
import { parseMarkdownToLatex } from "./parser"
import { extractCiteKeys } from "@/lib/bib-parser"
import { getAtlasTemplate, getMinimalTemplate } from "./templates"

function indent(s: string, n = 2): string {
  const pad = " ".repeat(n)
  return s
    .split("\n")
    .map((l) => (l ? pad + l : l))
    .join("\n")
}

export function assetUrlToLatexPath(apiUrl: string, workspaceId: string): string {
  const prefix = `/api/workspaces/${workspaceId}/assets/`
  if (apiUrl.startsWith(prefix)) {
    return `assets/${apiUrl.slice(prefix.length)}`
  }
  return apiUrl
}

export function generateTable(card: Card): string {
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

export function generateFigures(card: Card, workspaceId = ""): string {
  const figs = card.figures.filter((f) => f.url.trim())
  if (!figs.length) return "% no figures"

  function latexPath(url: string): string {
    return workspaceId ? assetUrlToLatexPath(url, workspaceId) : url
  }

  if (card.figureLayout === "two-up" || figs.length >= 2) {
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

export function generateLatexForCard(card: Card, workspaceId = "", usedBibKeys: string[] = []): string {
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
  return `% block id: ${card.id}  (column ${card.column}, order ${card.order})\n\\block{${parseMarkdownToLatex(card.title)}}{\n${indent(body)}\n}`
}

export function generateFullTemplate(project: Project, workspaceId = ""): string {
  const usedKeys = new Set<string>()
  for (const card of project.cards) {
    const textParts = [card.content]
    if (card.table?.caption) textParts.push(card.table.caption)
    if (card.figures) card.figures.forEach(f => { if (f.caption) textParts.push(f.caption) })
    extractCiteKeys(textParts.join("\n")).forEach(k => usedKeys.add(k))
  }
  const usedKeysArray = Array.from(usedKeys)

  const columns = [1, 2, 3]
    .map((col) => {
      const cards = project.cards
        .filter((c) => c.column === col)
        .sort((a, b) => a.order - b.order)
      const blocks = cards
        .map((c) => indent(generateLatexForCard(c, workspaceId, usedKeysArray)))
        .join("\n\n")
      return `% ===== Column ${col} =====\n\\column{0.333}\n\n${blocks}`
    })
    .join("\n\n")

  let templateContent = "";

  switch (project.templateName?.toLowerCase()) {
    case "minimal":
      templateContent = getMinimalTemplate(project);
      break;
    case "atlas":
    default:
      templateContent = getAtlasTemplate(project);
      break;
  }

  return `% =============================================================================
${templateContent.trim()}

\\begin{columns}

${indent(columns)}

\\end{columns}
\\end{document}`
}
