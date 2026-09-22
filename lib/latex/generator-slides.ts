import type { Card, Project, OutputConfig } from "@/lib/poster-types"
import { parseMarkdownToLatex } from "./parser"
import { extractCiteKeys } from "@/lib/bib-parser"
import type { LatexGenerator } from "./types"
import { getMetropolisTemplate, getBeamerAtlasTemplate, getMadridTemplate, getDefaultTemplate, getFocusTemplate, getEditorialTemplate } from "./templates"

import { assetUrlToLatexPath, normalizeLatexPath } from "./helpers"

export class BeamerSlidesGenerator implements LatexGenerator {
  outputType = "slides" as const
  templateId = "beamer-default"

  constructor(templateId = "beamer-default") {
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

    const sortedCards = [...outputConfig.cards].sort((a, b) => (a.column || 1) - (b.column || 1) || a.order - b.order)

    const slides = sortedCards.map((c) => {
      if (c.pattern === "title-slide") {
        if (c.slideNotes) {
          return `\\begin{frame}\n\\titlepage\n\\note{${ parseMarkdownToLatex(c.slideNotes)}}\n\\end{frame}`
        }
        return null
      }

      // ── References slide ──────────────────────────────────────────────────
      if (c.pattern === "references") {
        const nociteCmd = usedKeysArray.length > 0
          ? `\\nocite{${usedKeysArray.join(",")}}`
          : "% no citations used"
        let tex = `\\begin{frame}[allowframebreaks]{${parseMarkdownToLatex(c.title)}}\n`
        tex += `${nociteCmd}\n`
        tex += `\\bibliographystyle{plain}\n`
        tex += `\\bibliography{references}\n`
        if (c.slideNotes) tex += `\\note{${parseMarkdownToLatex(c.slideNotes)}}\n`
        tex += `\\end{frame}`
        return tex
      }

      // ── Two-column slide ──────────────────────────────────────────────────
      if (c.pattern === "two-column") {
        const firstFigure = c.figures?.[0]
        // `normalizeLatexPath` strips `{ } % # ~ $ & ^`, whitespace and control
        // characters, so a URL made only of those collapses to "". graphicx
        // aborts on `\includegraphics{}` ("File `' not found"), so an empty
        // path must count as "no figure" rather than be emitted. The poster
        // generator already guards this; slides did not.
        const firstFigurePath = firstFigure?.url?.trim()
          ? normalizeLatexPath(workspaceId ? assetUrlToLatexPath(firstFigure.url, workspaceId) : firstFigure.url)
          : ""
        const hasFigure = firstFigurePath.length > 0
        let leftContent: string
        let rightContent: string

        if (hasFigure) {
          // Text left, figure right
          leftContent = parseMarkdownToLatex(c.content)
          const f = firstFigure!
          rightContent = `\\includegraphics[width=\\linewidth,keepaspectratio]{${firstFigurePath}}`
          if (f.caption) rightContent += `\n\\\\\n{\\footnotesize ${parseMarkdownToLatex(f.caption)}}`
          rightContent = `\\centering\n${rightContent}`
        } else {
          // Split prose at first blank line
          const paragraphs = c.content.split(/\n\s*\n/)
          const mid = Math.ceil(paragraphs.length / 2)
          leftContent = parseMarkdownToLatex(paragraphs.slice(0, mid).join("\n\n"))
          rightContent = parseMarkdownToLatex(paragraphs.slice(mid).join("\n\n"))
        }

        let tex = `\\begin{frame}{${parseMarkdownToLatex(c.title)}}\n`
        tex += `\\begin{columns}[t]\n`
        tex += `  \\begin{column}{0.48\\textwidth}\n${leftContent}\n  \\end{column}\n`
        tex += `  \\begin{column}{0.48\\textwidth}\n${rightContent}\n  \\end{column}\n`
        tex += `\\end{columns}\n`
        if (c.slideNotes) tex += `\\note{${parseMarkdownToLatex(c.slideNotes)}}\n`
        tex += `\\end{frame}`
        return tex
      }

      if (c.pattern === "stats") {
        const statLines = c.content.split("\n").filter((l: string) => l.trim().length > 0)
        let statsBody = "\\begin{columns}[t]\n"
        statLines.forEach((line: string, i: number) => {
          if (i % 2 === 0) statsBody += "  \\begin{column}{0.48\\textwidth}\n"
          const rendered = parseMarkdownToLatex(line).replace(
            /\\textbf\{([^}]*)\}/g, "{\\color{structure}\\textbf{$1}}"
          )
          statsBody += `    ${rendered}\\\\\n`
          if (i % 2 === 1 || i === statLines.length - 1) statsBody += "  \\end{column}\n"
        })
        statsBody += "\\end{columns}"
        let tex = `\\begin{frame}{${parseMarkdownToLatex(c.title)}}\n${statsBody}\n`
        if (c.slideNotes) tex += `\\note{${parseMarkdownToLatex(c.slideNotes)}}\n`
        tex += "\\end{frame}"
        return tex
      }

      if (c.pattern === "graph") {
        let tex = `\\begin{frame}{${parseMarkdownToLatex(c.title)}}\n`
        tex += parseMarkdownToLatex(c.content) + "\n"
        if (c.figures && c.figures.length > 0) {
          const f = c.figures[0]
          const imgPath = f?.url?.trim()
            ? normalizeLatexPath(workspaceId ? assetUrlToLatexPath(f.url, workspaceId) : f.url)
            : ""
          if (imgPath.length > 0) {
            tex += `\\begin{center}\n\\includegraphics[height=0.62\\textheight,width=0.9\\linewidth,keepaspectratio]{${imgPath}}\n`
            if (f.caption) tex += `\\\\\n{\ \\footnotesize ${parseMarkdownToLatex(f.caption)}}\n`
            tex += "\\end{center}\n"
          }
        }
        if (c.slideNotes) tex += `\\note{${parseMarkdownToLatex(c.slideNotes)}}\n`
        tex += "\\end{frame}"
        return tex
      }

      // ── Standard slide ────────────────────────────────────────────────────
      let content = parseMarkdownToLatex(c.content)
      let tex = `\\begin{frame}{${parseMarkdownToLatex(c.title)}}\n`
      tex += `${content}\n`

      if (c.pattern === "bullets-image" || c.pattern === "figure-slide" || c.pattern === "image-focused") {
        if (c.figures && c.figures.length > 0) {
          const f = c.figures[0]
          // See the note on the two-column branch: a path that normalises to ""
          // must not reach \includegraphics.
          const imgPath = f?.url?.trim()
            ? normalizeLatexPath(workspaceId ? assetUrlToLatexPath(f.url, workspaceId) : f.url)
            : ""
          if (imgPath.length > 0) {
            const hasBullets = c.pattern === "bullets-image" && c.content.trim().length > 0
            const bulletLines = c.content.split("\n").filter(l => l.trim().length > 0).length
            // Scale down image height if there are many bullets or long captions
            const imgHeight = hasBullets 
              ? (bulletLines > 3 ? "0.32\\textheight" : bulletLines > 1 ? "0.36\\textheight" : "0.42\\textheight")
              : "0.62\\textheight"
            tex += `\\begin{center}\n\\includegraphics[height=${imgHeight},width=0.9\\linewidth,keepaspectratio]{${imgPath}}\n`
            if (f.caption) tex += `\\\\\n{\\footnotesize ${parseMarkdownToLatex(f.caption)}}\n`
            tex += `\\end{center}\n`
          }
        }
      } else if (c.pattern === "bullets-table") {
        if (c.table && Array.isArray(c.table.rows) && c.table.rows.length > 0 && Array.isArray(c.table.rows[0])) {
          const rows = Array.isArray(c.table.rows) ? c.table.rows : []
          const cols = rows[0].length
          const colSpec = Array.from({ length: cols }, () => "c").join("|")
          const body = rows.map(r => r.map(cell => parseMarkdownToLatex(cell)).join(" & ")).join(" \\\\\n")
          tex += `\\begin{table}\n\\centering\n\\resizebox{\\linewidth}{!}{\n\\begin{tabular}{|${colSpec}|}\\hline\n${body} \\\\\\hline\n\\end{tabular}\n}\n\\end{table}\n`
        }
      }

      if (c.slideNotes) {
        tex += `\\note{${parseMarkdownToLatex(c.slideNotes)}}\n`
      }

      tex += `\\end{frame}`
      return tex
    }).filter(Boolean).join("\n\n")

    let templateContent = "";
    const themeColor = outputConfig.themeColor ?? undefined
    switch (this.templateId) {
      case "beamer-metropolis":
        templateContent = getMetropolisTemplate(project, themeColor);
        break;
      case "beamer-madrid":
        templateContent = getMadridTemplate(project, themeColor);
        break;
      case "beamer-default":
        templateContent = getDefaultTemplate(project, themeColor);
        break;
      case "beamer-focus":
        templateContent = getFocusTemplate(project, themeColor);
        break;
      case "beamer-editorial":
        templateContent = getEditorialTemplate(project, themeColor);
        break;
      case "beamer-atlas":
      default:
        templateContent = getBeamerAtlasTemplate(project, themeColor);
        break;
    }

    return `% =============================================================================
% Generated by PosterApp - Beamer Slides
% =============================================================================
${templateContent.trim()}

${slides}

\\end{document}`
  }
}




