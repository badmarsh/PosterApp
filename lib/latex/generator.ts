import type { Card, Project } from "@/lib/poster-types"
import { parseMarkdownToLatex } from "./parser"
import { extractCiteKeys } from "@/lib/bib-parser"

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
      templateContent = `
\\documentclass[a0paper,portrait, blockverticalspace=3em, colspace=2em]{tikzposter}
\\tikzposterlatexaffectionproofoff
\\usepackage{graphicx}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{multicol}
\\usetikzlibrary{calc}

\\newcommand{\\looseitems}{\\begin{itemize}\\setlength{\\itemsep}{0.3em}}
\\newcommand{\\tightitems}{\\begin{itemize}\\setlength{\\itemsep}{0.15em}}
\\newcommand{\\captiontext}[1]{#1}

\\usetheme{Default}

\\definecolor{maincolor}{HTML}{2B4B9E}
\\definecolor{secondarycolor}{RGB}{43, 75, 158}
\\definecolor{lightblue}{RGB}{199, 215, 237}

\\definecolorstyle{minimalcolors}{
    \\colorlet{backgroundcolor}{white}
    \\colorlet{titlefgcolor}{white}
    \\colorlet{titlebgcolor}{maincolor}
    \\colorlet{blocktitlefgcolor}{white}
    \\colorlet{blocktitlebgcolor}{maincolor}
    \\colorlet{blockbodyfgcolor}{black}
    \\colorlet{blockbodybgcolor}{lightblue!25}
}{}
\\usecolorstyle{minimalcolors}

\\title{\\parbox{0.74\\linewidth}{\\centering\\huge
    ${parseMarkdownToLatex(project.posterTitle)}\\\\[1mm]
    }}
\\author{\\Large ${parseMarkdownToLatex(project.authors)}}
\\institute{\\normalsize ${parseMarkdownToLatex(project.venue)}}
\\date{}

\\begin{document}
\\maketitle`;
      break;
    case "atlas":
    default:
      templateContent = `
\\documentclass[a0paper,portrait, blockverticalspace=3em, colspace=2em]{tikzposter}
\\tikzposterlatexaffectionproofoff
\\usepackage{graphicx}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{multicol}
\\usetikzlibrary{calc}

\\newcommand{\\looseitems}{\\begin{itemize}\\setlength{\\itemsep}{0.3em}}
\\newcommand{\\tightitems}{\\begin{itemize}\\setlength{\\itemsep}{0.15em}}
\\newcommand{\\captiontext}[1]{#1}

\\usetheme{Default}

\\definecolor{maincolor}{HTML}{9e2b2f}
\\definecolor{secondarycolor}{RGB}{158, 43, 47}
\\definecolor{lightred}{RGB}{237, 199, 201}

\\definecolorstyle{atlascolors}{
    \\colorlet{backgroundcolor}{white}
    \\colorlet{titlefgcolor}{white}
    \\colorlet{titlebgcolor}{maincolor}
    \\colorlet{blocktitlefgcolor}{white}
    \\colorlet{blocktitlebgcolor}{maincolor}
    \\colorlet{blockbodyfgcolor}{black}
    \\colorlet{blockbodybgcolor}{lightred!25}
}{}
\\usecolorstyle{atlascolors}

\\definetitlestyle{sampletitle}{width=760mm, roundedcorners=20, linewidth=2pt,
  innersep=10pt, titletotopverticalspace=6mm, titletoblockverticalspace=8mm}{%
  \\begin{scope}[line width=\\titlelinewidth, rounded corners=\\titleroundedcorners]
    \\draw[color=blocktitlebgcolor, fill=titlebgcolor]
      (\\titleposleft,\\titleposbottom) rectangle (\\titleposright,\\titlepostop);
  \\end{scope}
  \\node[anchor=east, fill=white, rounded corners=10pt, inner sep=10pt, xshift=5mm]
    at ($(\\titleposright,\\titlepostop)!0.5!(\\titleposright,\\titleposbottom)$)
    {\\includegraphics[height=8.6cm]{logos/atlas_transparent.png}};
  \\node[anchor=west, fill=white, rounded corners=10pt, inner sep=10pt, xshift=-45mm, yshift=5mm]
    at ($(\\titleposleft,\\titlepostop)!0.5!(\\titleposleft,\\titleposbottom)$)
    {\\includegraphics[height=15cm]{logos/uk_logo.png}};}
\\usetitlestyle{sampletitle}

\\title{\\parbox{0.74\\linewidth}{\\centering\\huge
    ${parseMarkdownToLatex(project.posterTitle)}\\\\[1mm]
    }}
\\author{\\Large ${parseMarkdownToLatex(project.authors)}}
\\institute{\\normalsize ${parseMarkdownToLatex(project.venue)}}
\\date{}

\\begin{document}
\\maketitle`;
      break;
  }

  return `% =============================================================================
${templateContent.trim()}

\\begin{columns}

${indent(columns)}

\\end{columns}
\\end{document}`
}
