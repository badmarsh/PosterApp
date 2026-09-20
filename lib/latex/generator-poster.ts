import type { Card, Project, OutputConfig } from "@/lib/poster-types"
import { parseMarkdownToLatex } from "./parser"
import { extractCiteKeys } from "@/lib/bib-parser"
import { getAtlasTemplate, getMinimalTemplate, getGeminiTemplate, getTikzposterTemplate, getA0PosterTemplate, getLandscapeTemplate, getBetterPosterTemplate, getConferenceTemplate } from "./templates"
import type { LatexGenerator } from "./types"
import { indent, assetUrlToLatexPath, normalizeLatexPath, cleanCaption } from "./helpers"
import { columnBudgetFor, estimateHeight } from "./layout"

function generateTable(card: Card): string {
  const rows = card.table?.rows
  if (!rows || !rows.length) return "% no table rows"
  const cols = rows[0].length
  // Publication-grade booktabs table: clean alignment, NO vertical rules
  const colSpec = Array.from({ length: cols }, (_, i) => (i === 0 ? "l" : "c")).join("")

  const rawCap = cleanCaption(card.table.caption, "Table")
  const caption = rawCap
    ? "\n\\vspace{0.6ex}\\par\n{\\small\\textit{" + parseMarkdownToLatex(rawCap) + "}}"
    : ""

  const formattedRows = rows.map((r) => r.map((c) => parseMarkdownToLatex(c)).join(" & "))

  let tableBody = ""
  if (card.table.hasHeader && formattedRows.length > 1) {
    const [header, ...rest] = formattedRows
    tableBody = "\\toprule\n" + header + " \\\\\n\\midrule\n" + rest.join(" \\\\\n") + " \\\\\n\\bottomrule"
  } else {
    tableBody = "\\toprule\n" + formattedRows.join(" \\\\\n") + " \\\\\n\\bottomrule"
  }

  return "\\begin{center}\n\\resizebox{\\linewidth}{!}{\n\\begin{tabular}{" + colSpec + "}\n" + indent(tableBody) + "\n\\end{tabular}\n}" + caption + "\n\\end{center}"
}

function generateFigures(card: Card, workspaceId = ""): string {
  const figs = (card.figures ?? []).filter((f): f is NonNullable<typeof f> => Boolean(f?.url?.trim()))
  if (!figs.length) return "% no figures"

  function latexPath(url: string): string {
    return normalizeLatexPath(workspaceId ? assetUrlToLatexPath(url, workspaceId) : url)
  }

  if (figs.length >= 2) {
    const [a, b] = figs.slice(0, 2)
    const rawCapA = cleanCaption(a.caption, "Figure")
    const rawCapB = cleanCaption(b.caption, "Figure")
    const captionA = rawCapA ? "\n  \\vspace{0.4ex}\\par{\\small\\textit{" + parseMarkdownToLatex(rawCapA) + "}}" : ""
    const captionB = rawCapB ? "\n  \\vspace{0.4ex}\\par{\\small\\textit{" + parseMarkdownToLatex(rawCapB) + "}}" : ""
    return [
      "\\begin{minipage}[t]{0.495\\linewidth}\n  \\centering\n  \\includegraphics[width=\\linewidth,keepaspectratio]{" + latexPath(a.url) + "}" + captionA + "\n\\end{minipage}%",
      "\\hfill",
      "\\begin{minipage}[t]{0.495\\linewidth}\n  \\centering\n  \\includegraphics[width=\\linewidth,keepaspectratio]{" + latexPath(b.url) + "}" + captionB + "\n\\end{minipage}"
    ]
      .filter(Boolean)
      .join("\n")
  }

  const f = figs[0]
  const rawCap = cleanCaption(f.caption, "Figure")
  const captionLine = rawCap
    ? "\n\\vspace{0.5ex}\\par\n{\\small\\textit{" + parseMarkdownToLatex(rawCap) + "}}"
    : ""
  return "\\begin{center}\n  \\includegraphics[width=1.0\\linewidth,keepaspectratio]{" + latexPath(f.url) + "}" + captionLine + "\n\\end{center}"
}

interface MetricItem {
  value: string
  label: string
  sub?: string
}

function parseMetricItems(content: string): { intro: string; items: MetricItem[] } {
  const lines = content.split("\n")
  const introLines: string[] = []
  const items: MetricItem[] = []

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    const boldMatch = line.match(/^[-*]?\s*\*\*([^*]+)\*\*\s*(.*)$/)
    if (boldMatch) {
      const val = boldMatch[1].trim()
      const rest = boldMatch[2].trim()

      let label = ""
      let sub = ""

      if (rest.includes("|")) {
        const parts = rest.split("|").map((s) => s.trim()).filter(Boolean)
        label = parts[0] || ""
        sub = parts[1] || ""
      } else if (rest.includes("—") || rest.includes("--")) {
        const parts = rest.split(/—|--/).map((s) => s.trim()).filter(Boolean)
        label = parts[0] || ""
        sub = parts[1] || ""
      } else {
        const parenMatch = rest.match(/^(.*?)\s*\((.*?)\)$/)
        if (parenMatch) {
          label = parenMatch[1].trim().replace(/^[-: ]+/, "")
          sub = parenMatch[2].trim()
        } else {
          label = rest.replace(/^[-: ]+/, "")
        }
      }

      items.push({ value: val, label: label || "Metric", sub })
    } else if (items.length === 0) {
      introLines.push(rawLine)
    }
  }

  return {
    intro: introLines.join("\n").trim(),
    items,
  }
}

function generateMetricHero(card: Card, _templateId = ""): string {
  const { intro, items } = parseMetricItems(card.content)
  const parts: string[] = []

  if (intro) {
    parts.push(parseMarkdownToLatex(intro))
  }

  if (items.length > 0) {
    let tileWidth = "0.94"
    if (items.length === 2) tileWidth = "0.46"
    else if (items.length === 3) tileWidth = "0.29"
    else if (items.length >= 4) tileWidth = "0.46"

    const tileSnippets = items.map((item) => {
      const formattedVal = parseMarkdownToLatex(item.value)
      const formattedLabel = parseMarkdownToLatex(item.label)
      const formattedSub = item.sub ? parseMarkdownToLatex(item.sub) : ""

      const subLine = formattedSub
        ? "\\par\\vspace{0.2ex}\n    {\\small\\color{black!75} " + formattedSub + "}"
        : ""

      return "\\fcolorbox{customaccent!30}{customaccent!6}{%\n  \\begin{minipage}{" + tileWidth + "\\linewidth}\n    \\centering\\vspace{0.4ex}\n    {\\Huge\\bfseries\\color{customaccent} \\fitstat{" + formattedVal + "}}\\par\\vspace{0.3ex}\n    {\\large\\bfseries " + formattedLabel + "}" + subLine + "\\vspace{0.4ex}\n  \\end{minipage}%\n}"
    })

    if (items.length <= 3) {
      parts.push("\\begin{center}\n\\noindent\n" + tileSnippets.join("%\n\\hfill\n") + "\n\\end{center}")
    } else {
      const rows: string[] = []
      for (let i = 0; i < items.length; i += 2) {
        const rowItems = tileSnippets.slice(i, i + 2)
        rows.push(rowItems.join("%\n\\hfill\n"))
      }
      parts.push("\\begin{center}\n\\noindent\n" + rows.join("\n\n\\vspace{1.5ex}\n\n") + "\n\\end{center}")
    }
  }

  return parts.join("\n\n")
}

export function generateLatexForCard(
  card: Card,
  workspaceId = "",
  usedBibKeys: string[] = [],
  templateId = "",
  isUnderBudget = false
): string {
  const parts: string[] = []

  if (card.pattern === "references") {
    const nociteCmd = usedBibKeys.length > 0 ? "\\nocite{" + usedBibKeys.join(",") + "}" : "% no citations used"
    parts.push("\\begin{center}\n  \\begingroup\n  \\renewcommand{\\section}[2]{} % disable the bibliography section header\n  " + nociteCmd + "\n  \\bibliographystyle{plain}\n  \\bibliography{references}\n  \\endgroup\n\\end{center}")
  } else if (card.pattern === "stats" || card.pattern === "metric-card") {
    parts.push(generateMetricHero(card, templateId))
    if (card.table?.rows?.length) {
      parts.push(generateTable(card))
    }
    if (card.figures?.length) {
      parts.push(generateFigures(card, workspaceId))
    }
  } else {
    if (card.pattern !== "image-focused" && card.content.trim()) {
      parts.push(parseMarkdownToLatex(card.content.trim()))
    }
    if (card.pattern === "bullets-table" || card.pattern === "table") {
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

  if (isUnderBudget) {
    parts.push("\\vspace{1.2ex}")
  }

  const body = parts.join("\n\n")
  const title = parseMarkdownToLatex(card.title)
  if (templateId === "gemini") {
    return "% block id: " + card.id + "  (column " + card.column + ", order " + card.order + ")\n\\begin{block}{" + title + "}\n" + body + "\n\\end{block}"
  }
  if (templateId === "a0poster") {
    return "% block id: " + card.id + "  (column " + card.column + ", order " + card.order + ")\n\\section*{" + title + "}\n" + body
  }
  return "% block id: " + card.id + "  (column " + card.column + ", order " + card.order + ")\n\\block{" + title + "}{\n" + indent(body) + "\n}"
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

    const budget = columnBudgetFor(this.templateId)
    const activeCards = project.outputs?.find(o => o.id === project.activeOutputId)?.cards ?? []

    const columns = [1, 2, 3]
      .map((col) => {
        const cards = activeCards
          .filter((c) => c.column === col)
          .sort((a, b) => a.order - b.order)

        const colHeight = cards.reduce((sum, c) => sum + estimateHeight(c), 0)
        // Adaptive vertical space budgeting: if below 75% of budget, expand vertical separation
        const isUnderBudget = cards.length > 0 && colHeight < 0.75 * budget

        const blocks = cards
          .map((c) => indent(generateLatexForCard(c, workspaceId, usedKeysArray, this.templateId, isUnderBudget)))
          .join(this.templateId === "gemini" && isUnderBudget ? "\n\n\\vfill\n\n" : "\n\n")

        if (this.templateId === "gemini") {
          const trailingVfill = isUnderBudget ? "\n\\vfill" : ""
          return "% ===== Column " + col + " =====\n\\begin{column}{0.31\\textwidth}\n" + blocks + trailingVfill + "\n\\end{column}"
        }
        if (this.templateId === "a0poster") {
          return "% ===== Column " + col + " =====\n" + blocks
        }
        if (this.templateId === "betterposter") {
          const width = col === 2 ? "0.42" : "0.28"
          return "% ===== Column " + col + " =====\n\\column{" + width + "}\n\n" + blocks
        }
        return "% ===== Column " + col + " =====\n\\column{0.333}\n\n" + blocks
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
      case "conference":
        templateContent = getConferenceTemplate(project, themeColor);
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
      case "landscape":
        templateContent = getLandscapeTemplate(project, themeColor);
        break;
      case "betterposter":
        templateContent = getBetterPosterTemplate(project, themeColor);
        break;
      case "atlas":
      default:
        templateContent = getAtlasTemplate(project, themeColor, workspaceId);
        break;
    }

    return "% =============================================================================\n" +
      templateContent.trim() + "\n\n" +
      beginColumns + "\n\n" +
      indent(columns) + "\n\n" +
      endColumns + "\n" +
      endDocumentContent
  }
}
