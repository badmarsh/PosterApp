import type { Card, Project, ValidationMessage } from "./poster-types"

// ---------------------------------------------------------------------------
// Math region protection
// ---------------------------------------------------------------------------
// Before any markdown parsing, we extract all math regions ($...$ and $$...$$)
// and replace them with placeholders. After parsing we restore them.
// This prevents `_`, `*`, `\`, `{`, `}` inside math from being touched.

type MathSlot = { placeholder: string; original: string }

function extractMath(input: string): { text: string; slots: MathSlot[] } {
  const slots: MathSlot[] = []
  let idx = 0

  // Replace $$...$$ first (must come before $...$ to avoid partial matches)
  const text = input
    .replace(/\$\$([\s\S]+?)\$\$/g, (match) => {
      const placeholder = `\x00MATH${idx++}\x00`
      slots.push({ placeholder, original: match })
      return placeholder
    })
    .replace(/\$([^$\n]+?)\$/g, (match) => {
      const placeholder = `\x00MATH${idx++}\x00`
      slots.push({ placeholder, original: match })
      return placeholder
    })

  return { text, slots }
}

function restoreMath(text: string, slots: MathSlot[]): string {
  let result = text
  for (const { placeholder, original } of slots) {
    result = result.split(placeholder).join(original)
  }
  return result
}

// ---------------------------------------------------------------------------
// LaTeX macro passthrough
// ---------------------------------------------------------------------------
// Any token of the form \commandName (with optional {args}) that appears in
// the input is a LaTeX macro and must never be escaped. We protect them with
// the same placeholder strategy.

type MacroSlot = { placeholder: string; original: string }

function extractMacros(input: string): { text: string; slots: MacroSlot[] } {
  const slots: MacroSlot[] = []
  let idx = 0

  // Match \command optionally followed by one or more {arg} groups
  // e.g. \textcolor{tid}{TID}, \looseitems, \MET, \sqrt{s}
  const text = input.replace(
    /\\[a-zA-Z@]+(\{[^}]*\})*/g,
    (match) => {
      const placeholder = `\x00MACRO${idx++}\x00`
      slots.push({ placeholder, original: match })
      return placeholder
    }
  )

  return { text, slots }
}

function restoreMacros(text: string, slots: MacroSlot[]): string {
  let result = text
  for (const { placeholder, original } of slots) {
    result = result.split(placeholder).join(original)
  }
  return result
}

// ---------------------------------------------------------------------------
// Escape only the non-math, non-macro portion of text
// ---------------------------------------------------------------------------

/** Escape LaTeX special characters that are NOT inside math or macro regions. */
export function escapeLatex(input: string): string {
  // Standard specials — but NOT $ (math delimiter) and NOT \ (macro leader)
  // Those are handled by the extraction pipeline above.
  let text = input
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}")

  // Handle common unicode replacements that trip up pdflatex
  const unicodeMap: Record<string, string> = {
    "⁰": "$^0$", "¹": "$^1$", "²": "$^2$", "³": "$^3$", "⁴": "$^4$",
    "⁵": "$^5$", "⁶": "$^6$", "⁷": "$^7$", "⁸": "$^8$", "⁹": "$^9$",
    "⁺": "$^+$", "⁻": "$^-$", "⁼": "$^=$", "⁽": "$^($", "⁾": "$^)$",
    "°": "$^\\circ$", "–": "--", "—": "---", "’": "'", "‘": "`", "“": "``", "”": "''",
    "≤": "$\\le$", "≥": "$\\ge$", "×": "$\\times$", "±": "$\\pm$", "≈": "$\\approx$", "≠": "$\\neq$",
    "µ": "$\\mu$", "Ω": "$\\Omega$", "α": "$\\alpha$", "β": "$\\beta$", "γ": "$\\gamma$",
    "Δ": "$\\Delta$", "λ": "$\\lambda$", "θ": "$\\theta$", "π": "$\\pi$", "σ": "$\\sigma$", "τ": "$\\tau$"
  }
  for (const [char, repl] of Object.entries(unicodeMap)) {
    text = text.split(char).join(repl)
  }
  return text
}

// ---------------------------------------------------------------------------
// Main Markdown → LaTeX converter
// ---------------------------------------------------------------------------
// Pipeline:
//   1. Extract math regions        → placeholders
//   2. Extract LaTeX macros        → placeholders
//   3. escapeLatex the remainder
//   4. Apply markdown rules (bold, italic, code, link, lists)
//   5. Restore macros
//   6. Restore math

export function parseMarkdownToLatex(input: string): string {
  // Step 1: protect math
  const { text: afterMath, slots: mathSlots } = extractMath(input)

  // Step 2: protect existing LaTeX macros (user may have typed \textcolor etc.)
  const { text: afterMacros, slots: macroSlots } = extractMacros(afterMath)

  // Step 3: escape remaining special characters
  let text = escapeLatex(afterMacros)

  // Step 4a: inline markdown
  // Bold: **text**
  text = text.replace(/\*\*([^*\n]+)\*\*/g, "\\textbf{$1}")

  // Italic: *text* (single star, not double)
  text = text.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "\\textit{$1}")

  // Code: `text`
  text = text.replace(/`([^`\n]+)`/g, "\\texttt{$1}")

  // Link: [text](url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "\\href{$2}{$1}")

  // Step 4b: bullet lists — detect lines starting with - or *
  const lines = text.split("\n")
  const outLines: string[] = []
  let inList = false

  for (const line of lines) {
    const bullet = line.match(/^(\s*)[-*]\s+(.+)$/)
    if (bullet) {
      if (!inList) {
        outLines.push("\\begin{itemize}\\setlength{\\itemsep}{0.3em}")
        inList = true
      }
      outLines.push(`  \\item ${bullet[2]}`)
    } else {
      if (inList) {
        outLines.push("\\end{itemize}")
        inList = false
      }
      outLines.push(line)
    }
  }
  if (inList) outLines.push("\\end{itemize}")

  text = outLines.join("\n")

  // Step 5 & 6: restore in reverse order
  text = restoreMacros(text, macroSlots)
  text = restoreMath(text, mathSlots)

  return text
}

// ---------------------------------------------------------------------------
// Unsafe LaTeX checker
// ---------------------------------------------------------------------------
// After the new pipeline, warn only about things that could still cause issues:
// unbalanced braces, bare % or & that weren't escaped (shouldn't happen, but
// useful as a sanity check). Math and macros are now safe.

export function hasUnsafeLatex(input: string): string[] {
  const found = new Set<string>()

  // Unbalanced braces
  let depth = 0
  for (const ch of input) {
    if (ch === "{") depth++
    else if (ch === "}") depth--
    if (depth < 0) { found.add("unbalanced {}"); break }
  }
  if (depth !== 0) found.add("unbalanced {}")

  return [...found]
}

// ---------------------------------------------------------------------------
// Asset path resolution
// ---------------------------------------------------------------------------
// LaTeX generator uses relative paths (for pdflatex in the workspace dir).
// Preview UI uses /api/workspaces/[id]/assets/... for HTTP serving.
// These are explicitly kept separate — never mix them.

export function assetUrlToLatexPath(apiUrl: string, workspaceId: string): string {
  // /api/workspaces/tilecal-irid-2026/assets/plot1.pdf → assets/plot1.pdf
  const prefix = `/api/workspaces/${workspaceId}/assets/`
  if (apiUrl.startsWith(prefix)) {
    return `assets/${apiUrl.slice(prefix.length)}`
  }
  // Already a relative path or unknown — return as-is
  return apiUrl
}

// ---------------------------------------------------------------------------
// Height estimation
// ---------------------------------------------------------------------------

export function estimateHeight(card: Card): number {
  let h = 70 // title + chrome
  h += Math.floor(card.content.length / 60) * 14
  const bulletCount = (card.content.match(/^[-*]\s/gm) || []).length
  h += bulletCount * 10

  if (card.pattern === "bullets-table") {
    h += 30 + card.table.rows.length * 26
  }
  if (card.pattern === "bullets-image" || card.pattern === "image-focused") {
    h += card.pattern === "image-focused" ? 260 : 190
  }
  if (card.pattern === "bullets-two-images") h += 150
  return h
}

export const COLUMN_BUDGET = 900

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateCard(card: Card): ValidationMessage[] {
  const msgs: ValidationMessage[] = []

  if (!card.title.trim()) {
    msgs.push({ level: "error", field: "title", message: "Card title is required." })
  }
  if (!/^blk_[a-z0-9_]+$/.test(card.id)) {
    msgs.push({
      level: "error",
      field: "id",
      message: "Block ID must match blk_[a-z0-9_].",
    })
  }

  const needsContent = card.pattern !== "image-focused"
  if (needsContent && !card.content.trim()) {
    msgs.push({
      level: "error",
      field: "content",
      message: "This block pattern requires content.",
    })
  }

  const unsafe = hasUnsafeLatex(card.content)
  if (unsafe.length) {
    msgs.push({
      level: "warning",
      field: "content",
      message: `Potential LaTeX issue: ${unsafe.join(" ")}`,
    })
  }

  const needsTable = card.pattern === "bullets-table"
  if (needsTable) {
    if (card.table.rows.length < 1) {
      msgs.push({ level: "error", field: "table", message: "Table has no rows." })
    }
    const widths = new Set(card.table.rows.map((r) => r.length))
    if (widths.size > 1) {
      msgs.push({
        level: "error",
        field: "table",
        message: "All table rows must have the same number of columns.",
      })
    }
  }

  const figureCount =
    card.pattern === "bullets-image" || card.pattern === "image-focused"
      ? 1
      : card.pattern === "bullets-two-images"
        ? 2
        : 0
  const presentFigures = card.figures.filter((f) => f.url.trim()).length
  if (figureCount > 0 && presentFigures < figureCount) {
    msgs.push({
      level: "error",
      field: "figures",
      message: `Pattern expects ${figureCount} image${figureCount > 1 ? "s" : ""}, found ${presentFigures}.`,
    })
  }

  const height = estimateHeight(card)
  if (height > COLUMN_BUDGET) {
    msgs.push({
      level: "warning",
      field: "content",
      message: `Estimated height ${height}u exceeds column budget ${COLUMN_BUDGET}u — likely overflow.`,
    })
  } else if (height > COLUMN_BUDGET * 0.85) {
    msgs.push({
      level: "info",
      field: "content",
      message: `Estimated height ${height}u is close to the column budget.`,
    })
  }

  return msgs
}

export function levelFromMessages(
  msgs: ValidationMessage[],
): "valid" | "warning" | "invalid" {
  if (msgs.some((m) => m.level === "error")) return "invalid"
  if (msgs.some((m) => m.level === "warning")) return "warning"
  return "valid"
}

// ---------------------------------------------------------------------------
// LaTeX block generators
// ---------------------------------------------------------------------------

function indent(s: string, n = 2): string {
  const pad = " ".repeat(n)
  return s
    .split("\n")
    .map((l) => (l ? pad + l : l))
    .join("\n")
}

export function generateTable(card: Card): string {
  const rows = card.table.rows
  if (!rows.length) return "% no table rows"
  const cols = rows[0].length
  const colSpec = Array.from({ length: cols }, (_, i) => (i === 0 ? "l" : "c")).join("|")
  const body = rows
    .map((r, idx) => {
      // Table cells: escape but preserve math/macros
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
  // \resizebox ensures the table always fits the block width — matches ATLAS template
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
    const captionLine = a.caption
      ? `\n  {\\small ${parseMarkdownToLatex(a.caption)}}`
      : ""
    return [
      `\\begin{minipage}{0.495\\linewidth}\n  \\includegraphics[width=\\linewidth]{${latexPath(a.url)}}\n\\end{minipage}%`,
      `\\hfill`,
      `\\begin{minipage}{0.495\\linewidth}\n  \\includegraphics[width=\\linewidth]{${latexPath(b.url)}}\n\\end{minipage}`,
      captionLine,
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

export function generateLatexForCard(card: Card, workspaceId = ""): string {
  const parts: string[] = []

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

  const body = parts.join("\n\n")
  return `% block id: ${card.id}  (column ${card.column}, order ${card.order})\n\\block{${parseMarkdownToLatex(card.title)}}{\n${indent(body)}\n}`
}

// ---------------------------------------------------------------------------
// Full template generator
// ---------------------------------------------------------------------------

export function generateFullTemplate(project: Project, workspaceId = ""): string {
  const columns = [1, 2, 3]
    .map((col) => {
      const cards = project.cards
        .filter((c) => c.column === col)
        .sort((a, b) => a.order - b.order)
      const blocks = cards
        .map((c) => indent(generateLatexForCard(c, workspaceId)))
        .join("\n\n")
      return `% ===== Column ${col} =====\n\\column{0.333}\n\n${blocks}`
    })
    .join("\n\n")

  return `% =============================================================================
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
\\maketitle

\\begin{columns}

${indent(columns)}

\\end{columns}
\\end{document}`
}
