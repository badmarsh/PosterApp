import type { Card, Project, OutputConfig } from "@/lib/poster-types"
import { parseMarkdownToLatex } from "./parser"
import { extractCiteKeys } from "@/lib/bib-parser"
import { getTwoColumnTemplate, getSingleColumnTemplate, getIEEEConfTemplate, getACMSigconfTemplate, getSpringerLLNCSTemplate } from "./templates"
import type { LatexGenerator } from "./types"
import { assetUrlToLatexPath } from "./helpers"

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
    ? `  \\caption{${parseMarkdownToLatex(card.table.caption)}}\n`
    : ""
    
  return `\\begin{table}[htbp]
  \\centering
${caption}  \\begin{tabular}{|${colSpec}|}\\hline
${body}
  \\hline
  \\end{tabular}
\\end{table}`
}

function generateFigures(card: Card, workspaceId = "", isTwoColumn = false): string {
  const figs = card.figures.filter((f) => f.url.trim())
  if (!figs.length) return "% no figures"

  function latexPath(url: string): string {
    return workspaceId ? assetUrlToLatexPath(url, workspaceId) : url
  }

  const env = isTwoColumn ? "figure*" : "figure"

  if (figs.length >= 2) {
    const [a, b] = figs.slice(0, 2)
    const captionA = a.caption ? `\\caption{${parseMarkdownToLatex(a.caption)}}` : ""
    const captionB = b.caption ? `\\caption{${parseMarkdownToLatex(b.caption)}}` : ""
    return `\\begin{${env}}[htbp]
  \\centering
  \\begin{minipage}[b]{0.48\\textwidth}
    \\centering
    \\includegraphics[width=\\textwidth]{${latexPath(a.url)}}
    ${captionA}
  \\end{minipage}
  \\hfill
  \\begin{minipage}[b]{0.48\\textwidth}
    \\centering
    \\includegraphics[width=\\textwidth]{${latexPath(b.url)}}
    ${captionB}
  \\end{minipage}
\\end{${env}}`
  }

  const f = figs[0]
  const captionLine = f.caption
    ? `  \\caption{${parseMarkdownToLatex(f.caption)}}\n`
    : ""
  return `\\begin{${env}}[htbp]
  \\centering
  \\includegraphics[width=0.8\\textwidth]{${latexPath(f.url)}}
${captionLine}\\end{${env}}`
}

function generateLatexForCard(card: Card, workspaceId = "", usedBibKeys: string[] = [], isTwoColumn = false): string {
  const parts: string[] = []

  if (card.pattern === "references") {
    const nociteCmd = usedBibKeys.length > 0 ? `\\nocite{${usedBibKeys.join(",")}}` : "% no citations used"
    parts.push(`\\begingroup\n${nociteCmd}\n\\bibliographystyle{plain}\n\\bibliography{references}\n\\endgroup`)
    // Notice we do NOT output a \section for references here, it's usually automatic in article class
    return parts.join("\n\n")
  } 

  // Output standard section
  const sectionTitle = parseMarkdownToLatex(card.title)
  parts.push(`\\section{${sectionTitle}}`)

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
    parts.push(generateFigures(card, workspaceId, isTwoColumn))
  }

  return parts.join("\n\n")
}

export class StandardPaperGenerator implements LatexGenerator {
  outputType = "paper" as const
  templateId = "article-twocol"

  constructor(templateId = "article-twocol") {
    this.templateId = templateId
  }

  generateDocument(project: Project, outputConfig: OutputConfig, workspaceId = ""): string {
    const usedKeys = new Set<string>()
    for (const card of outputConfig.cards) {
      const textParts = [card.content]
      if (card.table?.caption) textParts.push(card.table.caption)
      if (card.figures) card.figures.forEach(f => { if (f.caption) textParts.push(f.caption) })
      extractCiteKeys(textParts.join("\n")).forEach(k => usedKeys.add(k))
    }
    const usedKeysArray = Array.from(usedKeys)

    // In a paper, we just want all cards sequentially.
    // Order by column then order, to match the reading flow of the poster.
    const sortedCards = [...outputConfig.cards].sort((a, b) => (a.column || 1) - (b.column || 1) || a.order - b.order)

    const isTwoColumn = this.templateId !== "article-single";

    const contentBlocks = sortedCards
      .map((c) => generateLatexForCard(c, workspaceId, usedKeysArray, isTwoColumn))
      .join("\n\n")

    let templateContent = "";
    switch (this.templateId) {
      case "article-single":
        templateContent = getSingleColumnTemplate(project);
        break;
      case "ieee-conf":
        templateContent = getIEEEConfTemplate(project);
        break;
      case "acm-sigconf":
        templateContent = getACMSigconfTemplate(project);
        break;
      case "springer-llncs":
        templateContent = getSpringerLLNCSTemplate(project);
        break;
      case "article-twocol":
      default:
        templateContent = getTwoColumnTemplate(project);
        break;
    }

    return `% =============================================================================
${templateContent.trim()}

${contentBlocks}

\\end{document}`
  }
}
