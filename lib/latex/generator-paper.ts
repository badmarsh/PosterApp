import type { Card, Project, OutputConfig } from "@/lib/poster-types"
import { parseMarkdownToLatex } from "./parser"
import { extractCiteKeys } from "@/lib/bib-parser"
import { getTwoColumnTemplate, getSingleColumnTemplate, getIEEEConfTemplate, getACMSigconfTemplate, getSpringerLLNCSTemplate, getJinstProceedingsTemplate, getPosProceedingsTemplate, getElsarticleTemplate, getRevtexTemplate, getEpjWocTemplate, getIopartTemplate, getNeurIPSTemplate, getICMLTemplate, getICLRTemplate, getACLTemplate, getCVPRTemplate, getAAAITemplate } from "./templates"
import type { LatexGenerator } from "./types"
import { assetUrlToLatexPath, normalizeLatexPath } from "./helpers"

function cleanCaption(caption: string | undefined, prefix: "Figure" | "Table"): string {
  if (!caption) return ""
  const regex = prefix === "Figure" ? /^(Figure\s*\d*:?\s*|Fig\.\s*\d*:?\s*)/i : /^(Table\s*\d*:?\s*)/i
  return caption.replace(regex, "").trim()
}

/**
 * Paper templates whose document class is single-column. `figure*`/`table*`
 * only exist in a twocolumn class, so emitting them here is a fatal
 * "Environment figure* undefined" rather than a layout quirk.
 */
const SINGLE_COLUMN_TEMPLATES = new Set([
  "article-single",
  "springer-llncs",
  "jinst-proceedings",
  "pos-proceedings",
  "elsarticle",
  "epj-woc",
  "iopart",
  "neurips",
  "iclr",
])

function generateTable(card: Card, isTwoColumn = false): string {
  if (!card.table || !Array.isArray(card.table.rows) || card.table.rows.length === 0 || !Array.isArray(card.table.rows[0])) return ""

  const rows = card.table.rows
  const cols = rows[0].length
  const colSpec = Array.from({ length: cols }, (_, i) => (i === 0 ? "l" : "c")).join("|")
  const body = rows
    .map((r, idx) => {
      const cells = Array.isArray(r) ? r.map((c) => parseMarkdownToLatex(c)).join(" & ") : ""
      if (idx === 0 && card.table.hasHeader) {
        return `\\hline\n${cells} \\\\\n\\hline`
      }
      return `${cells} \\\\`
    })
    .join("\n")
    
  const rawCaption = cleanCaption(card.table.caption, "Table")
  const caption = rawCaption
    ? `  \\caption{${parseMarkdownToLatex(rawCaption)}}\n`
    : ""
    
  // Wide tables (>3 columns in two-column paper) should span across both columns via table*
  const useTwoColTable = isTwoColumn && cols > 3
  const env = useTwoColTable ? "table*" : "table"
  const maxWidth = useTwoColTable ? "\\textwidth" : "\\linewidth"

  return `\\begin{${env}}[htbp]
  \\centering
${caption}  \\resizebox{${maxWidth}}{!}{%
  \\begin{tabular}{|${colSpec}|}\\hline
${body}
  \\hline
  \\end{tabular}%
  }
\\end{${env}}`
}

function generateFigures(card: Card, workspaceId = "", isTwoColumn = false): string {
  const figs = (card.figures ?? []).filter((f): f is NonNullable<typeof f> => Boolean(f?.url?.trim()))
  if (!figs.length) return "% no figures"

  function latexPath(url: string): string {
    return normalizeLatexPath(workspaceId ? assetUrlToLatexPath(url, workspaceId) : url)
  }

  const env = isTwoColumn ? "figure*" : "figure"

  if (figs.length >= 2) {
    const [a, b] = figs.slice(0, 2)
    const rawCapA = cleanCaption(a.caption, "Figure")
    const rawCapB = cleanCaption(b.caption, "Figure")
    const captionA = rawCapA ? `\\caption{${parseMarkdownToLatex(rawCapA)}}` : ""
    const captionB = rawCapB ? `\\caption{${parseMarkdownToLatex(rawCapB)}}` : ""
    return `\\begin{${env}}[htbp]
  \\centering
  \\begin{minipage}[b]{0.48\\linewidth}
    \\centering
    \\includegraphics[width=\\linewidth,keepaspectratio]{${latexPath(a.url)}}
    ${captionA}
  \\end{minipage}
  \\hfill
  \\begin{minipage}[b]{0.48\\linewidth}
    \\centering
    \\includegraphics[width=\\linewidth,keepaspectratio]{${latexPath(b.url)}}
    ${captionB}
  \\end{minipage}
\\end{${env}}`
  }

  const f = figs[0]
  const rawCap = cleanCaption(f.caption, "Figure")
  const captionLine = rawCap
    ? `  \\caption{${parseMarkdownToLatex(rawCap)}}\n`
    : ""
  return `\\begin{${env}}[htbp]
  \\centering
  \\includegraphics[width=\\linewidth,keepaspectratio]{${latexPath(f.url)}}
${captionLine}\\end{${env}}`
}

function generateLatexForCard(card: Card, workspaceId = "", usedBibKeys: string[] = [], isTwoColumn = false): string {
  const parts: string[] = []

  if (card.pattern === "references") {
    const nociteCmd = usedBibKeys.length > 0 ? `\\nocite{${usedBibKeys.join(",")}}` : "\\nocite{*}"
    parts.push(`\\begingroup\n${nociteCmd}\n\\bibliographystyle{plain}\n\\bibliography{references}\n\\endgroup`)
    return parts.join("\n\n")
  }

  const isAbstract = card.title.trim().toLowerCase() === "abstract" || (card.pattern as string) === "abstract"

  if (isAbstract) {
    parts.push(`\\begin{abstract}\n${parseMarkdownToLatex(card.content.trim())}\n\\end{abstract}`)
    return parts.join("\n\n")
  }

  // Strip leading redundant section number prefix (e.g. "1 Introduction" -> "Introduction")
  const cleanTitle = card.title.replace(/^(\d+\.?\s*)/, "")
  const sectionTitle = parseMarkdownToLatex(cleanTitle)
  parts.push(`\\section{${sectionTitle}}`)

  if (card.pattern !== "image-focused" && card.content.trim()) {
    parts.push(parseMarkdownToLatex(card.content.trim()))
  }
  
  if (card.pattern === "bullets-table" || card.pattern === "section-table") {
    parts.push(generateTable(card, isTwoColumn))
  }

  if (
    card.pattern === "bullets-image" ||
    card.pattern === "bullets-two-images" ||
    card.pattern === "image-focused" ||
    card.pattern === "section-figure" ||
    card.pattern === "section-two-figures"
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
      if (Array.isArray(card.figures)) card.figures.forEach(f => { if (f?.caption) textParts.push(f.caption) })
      extractCiteKeys(textParts.join("\n")).forEach(k => usedKeys.add(k))
    }
    const usedKeysArray = Array.from(usedKeys)

    // In a paper, we just want all cards sequentially.
    // Order by column then order, to match the reading flow of the poster.
    const sortedCards = [...outputConfig.cards].sort((a, b) => (a.column || 1) - (b.column || 1) || a.order - b.order)

    // Single-column venues must never emit figure*/table*: those environments
    // are undefined outside a twocolumn class and abort the compile.
    const isTwoColumn = !SINGLE_COLUMN_TEMPLATES.has(this.templateId)

    let contentBlocks = ""
    if (this.templateId === "acm-sigconf") {
      const abstractCard = sortedCards.find(c => c.title.trim().toLowerCase() === "abstract" || (c.pattern as string) === "abstract")
      const otherCards = sortedCards.filter(c => c !== abstractCard)
      const abstractTex = abstractCard ? generateLatexForCard(abstractCard, workspaceId, usedKeysArray, isTwoColumn) : ""
      const otherTex = otherCards.map(c => generateLatexForCard(c, workspaceId, usedKeysArray, isTwoColumn)).join("\n\n")
      contentBlocks = [abstractTex, "\\maketitle", otherTex].filter(Boolean).join("\n\n")
    } else {
      contentBlocks = sortedCards
        .map((c) => generateLatexForCard(c, workspaceId, usedKeysArray, isTwoColumn))
        .join("\n\n")
    }

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
      case "jinst-proceedings":
        templateContent = getJinstProceedingsTemplate(project);
        break;
      case "pos-proceedings":
        templateContent = getPosProceedingsTemplate(project);
        break;
      case "elsarticle":
        templateContent = getElsarticleTemplate(project);
        break;
      case "revtex-aps":
        templateContent = getRevtexTemplate(project);
        break;
      case "epj-woc":
        templateContent = getEpjWocTemplate(project);
        break;
      case "iopart":
        templateContent = getIopartTemplate(project);
        break;
      case "neurips":
        templateContent = getNeurIPSTemplate(project);
        break;
      case "icml":
        templateContent = getICMLTemplate(project);
        break;
      case "iclr":
        templateContent = getICLRTemplate(project);
        break;
      case "acl":
        templateContent = getACLTemplate(project);
        break;
      case "cvpr":
        templateContent = getCVPRTemplate(project);
        break;
      case "aaai":
        templateContent = getAAAITemplate(project);
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



