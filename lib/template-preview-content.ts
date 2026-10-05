/**
 * Content model for a rendered template document (poster page, paper page,
 * slide) plus the pure text helpers the preview artwork uses to lay it out.
 *
 * Kept free of data imports on purpose: `lib/template-preview-art.ts` is part of
 * the client bundle (the template registry renders live SVG previews), so the
 * real demo content arrives through `options.content`, prepared at generation
 * time by `lib/template-demo-content.ts` on the server/script side.
 */

export type PreviewSection = {
  /** Heading as it appears in the demo document (markdown stripped). */
  title: string
  /** Body lines: bullets stay separate, paragraphs are pre-wrapped sentences. */
  lines: string[]
  /** The demo card carried a figure, so the artwork draws a figure block. */
  hasFigure?: boolean
  /** 1-based demo column (posters only), used when it matches the template grid. */
  column?: number
}

export type PreviewDocumentContent = {
  title: string
  authors?: string
  venue?: string
  /** Paper front matter; the gallery's first card is the abstract. */
  abstract?: string
  /** Better Poster's one-sentence take-home, rendered as the hero statement. */
  claim?: string
  sections: PreviewSection[]
}

/** Neutral fallback so a document always renders real typography, never blank bars. */
export const GENERIC_DOCUMENT_CONTENT: PreviewDocumentContent = {
  title: "Template preview document",
  authors: "A. Author, B. Author, and C. Author",
  venue: "Conference 2026 · Session 1A",
  abstract:
    "This placeholder page shows how the template sets its title, section headings and body text. Choose a template to see it filled with the demo workspace document.",
  claim: "Every template preview uses its own demo document.",
  sections: [
    {
      title: "Overview",
      lines: [
        "• The preview renders the template's real typography and page geometry",
        "• Demo workspaces supply the title, authors and section content",
      ],
    },
    {
      title: "Method",
      lines: [
        "• Cards are laid out on the template's own column grid",
        "• Figure cards reserve the space the artwork needs",
      ],
    },
    {
      title: "Results",
      lines: [
        "• Numbers and captions come from the demo document",
        "• Body text is truncated to the space the template actually provides",
      ],
      hasFigure: true,
    },
    {
      title: "Conclusion",
      lines: ["• Pick a template to replace this text with its curated example document"],
    },
  ],
}

const MARKDOWN_LINK = /\[([^\]]*)\]\(([^)]*)\)/g

/**
 * LaTeX symbols worth keeping as glyphs in printed artwork: dropping them
 * outright leaves sentences like "decaying to in 139 fb" behind.
 */
const LATEX_SYMBOLS: Record<string, string> = {
  alpha: "α",
  beta: "β",
  gamma: "γ",
  delta: "δ",
  Delta: "Δ",
  eta: "η",
  theta: "θ",
  lambda: "λ",
  mu: "µ",
  nu: "ν",
  sigma: "σ",
  tau: "τ",
  phi: "φ",
  psi: "ψ",
  omega: "ω",
  pm: "±",
  times: "×",
  cdot: "·",
  leq: "≤",
  le: "≤",
  geq: "≥",
  ge: "≥",
  approx: "≈",
  to: "→",
  propto: "∝",
  langle: "⟨",
  rangle: "⟩",
  sum: "Σ",
  exp: "exp",
}

/**
 * Markdown/LaTeX-lite → plain text, good enough for artwork: emphasis markers,
 * inline math delimiters, backticks and links are unwrapped, list markers become
 * bullets and table pipes become separators.
 */
export function stripMarkdown(input: string): string {
  if (!input) return ""
  let text = String(input)
  text = text.replace(MARKDOWN_LINK, "$1")
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
  text = text.replace(/\*\*([^*]*)\*\*/g, "$1")
  text = text.replace(/(^|\s)\*([^*\n]+)\*/g, "$1$2")
  text = text.replace(/(^|\s)_([^_\n]+)_/g, "$1$2")
  text = text.replace(/`([^`]*)`/g, "$1")
  text = text.replace(/\$([^$]*)\$/g, "$1")
  // Citations and cross-references carry no meaning on paper: `\cite{key}`,
  // `[@key]`, bare `@key` and `\ref{...}` all disappear with their argument.
  text = text.replace(/\\(?:cite|citep|citet|ref|eqref|label|autoref)\{[^}]*\}/g, "")
  text = text.replace(/\[@[^\]]*\]/g, "")
  text = text.replace(/(^|\s)@[\w.:/-]+/g, "$1")
  // Markdown table rows (`| a | b |`) become separator-joined prose; single
  // pipes elsewhere (absolute values in math) are handled further down.
  text = text.replace(/^\s*\|.*\|\s*$/gm, (row) =>
    row
      .trim()
      .replace(/^\||\|$/g, "")
      .replace(/\s*\|\s*/g, " · ")
      .trim(),
  )
  // LaTeX: unwrap commands that take arguments, then drop command names.
  text = text.replace(/\\sqrt\{([^{}]*)\}/g, "√$1")
  for (let pass = 0; pass < 2; pass++) text = text.replace(/\\[a-zA-Z]+\{([^{}]*)\}/g, "$1")
  text = text.replace(/\\([a-zA-Z]+)/g, (match, name: string) => LATEX_SYMBOLS[name] ?? "")
  // Super/subscripts keep their value (fb^{-1} -> fb-1) rather than losing it.
  text = text.replace(/[_^]\{([^{}]*)\}/g, "$1")
  text = text.replace(/\|([^|\n]{0,30})\|/g, "$1")
  text = text.replace(/[{}]/g, "")
  text = text.replace(/[_^]+(?=\s|$)/g, "")
  text = text.replace(/^\s{0,3}#{1,6}\s+/gm, "")
  text = text.replace(/^\s*[-*•]\s+/gm, "• ")
  text = text.replace(/^\s*\d+[.)]\s+/gm, "• ")
  text = text.replace(/[ \t]{2,}/g, " ")
  text = text.replace(/\s*·\s*·\s*/g, " · ")
  text = text.replace(/[ \t]+$/gm, "")
  return text.replace(/\n{3,}/g, "\n\n").trim()
}

/** Split body text into bullet-ish lines: hard breaks first, then sentences. */
export function splitLines(input: string, maxLines = 6): string[] {
  const cleaned = stripMarkdown(input)
  if (!cleaned) return []
  const hardLines = cleaned
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
  const lines: string[] = []
  for (const hard of hardLines) {
    if (hard.startsWith("• ") || hard.length <= 96) {
      lines.push(hard)
      continue
    }
    // Long paragraph: split into sentences so the artwork can drop the tail.
    const sentences = hard.match(/[^.!?]+[.!?]+/g) ?? [hard]
    let buffer = ""
    for (const sentence of sentences) {
      const candidate = buffer ? `${buffer} ${sentence.trim()}` : sentence.trim()
      if (candidate.length > 96 && buffer) {
        lines.push(buffer)
        buffer = sentence.trim()
      } else {
        buffer = candidate
      }
    }
    if (buffer) lines.push(buffer)
  }
  return lines.slice(0, maxLines)
}

/** Greedy word wrap with a character budget; the final line is ellipsized. */
export function wrapText(input: string, maxChars: number, maxLines: number): string[] {
  const text = String(input ?? "").trim()
  if (!text) return []
  const budget = Math.max(4, Math.floor(maxChars))
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ""

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= budget) {
      current = candidate
      continue
    }
    if (current) lines.push(current)
    current = word
    if (lines.length === maxLines) break
  }
  if (current && lines.length < maxLines) lines.push(current)

  // Anything that did not fit is signalled by an ellipsis on the last line.
  const consumed = lines.join(" ").length
  if (consumed < text.replace(/\s+/g, " ").length && lines.length) {
    const last = lines[lines.length - 1]
    lines[lines.length - 1] = `${last.slice(0, Math.max(1, budget - 1)).trimEnd()}…`
  }
  return lines.slice(0, maxLines)
}

/** Shorten to a character budget without leaving a dangling word. */
export function truncate(input: string, maxChars: number): string {
  const text = String(input ?? "").trim()
  if (text.length <= maxChars) return text
  const cut = text.slice(0, Math.max(1, maxChars - 1))
  const lastSpace = cut.lastIndexOf(" ")
  return `${(lastSpace > maxChars * 0.5 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}
