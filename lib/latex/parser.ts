import { decodeHtmlEntities } from "@/lib/utils"

type Slot = { placeholder: string; original: string }

export function extractMath(input: string): { text: string; slots: Slot[] } {
  if (typeof input !== "string") return { text: "", slots: [] }
  const slots: Slot[] = []
  let idx = 0

  const text = input
    .replace(/\$\$([\s\S]+?)\$\$/g, (match) => {
      const placeholder = `\x00MATH${idx++}\x00`
      slots.push({ placeholder, original: match })
      return placeholder
    })
    .replace(/\\\[([\s\S]+?)\\\]/g, (match) => {
      const placeholder = `\x00MATH${idx++}\x00`
      slots.push({ placeholder, original: match })
      return placeholder
    })
    .replace(/\\\(([\s\S]+?)\\\)/g, (match) => {
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

function restoreMath(text: string, slots: Slot[]): string {
  let result = text
  const dangerousCommands = new Set([
    "input", "include", "write", "openout", "immediate", "catcode", "csname",
    "def", "let", "gdef", "edef", "xdef", "loop", "repeat", "read", "special",
    "shell", "exec", "openin", "closein", "closeout", "batchmode", "nonstopmode",
    "scrollmode", "errorstopmode", "primitive", "escapechar"
  ])

  for (const { placeholder, original } of slots) {
    const math = original
      .replace(/^(\$\$|\\\[|\$|\\\()/, "")
      .replace(/(\$\$|\\\]|\$|\\\))$/, "")
      .trim()

    const commands = [...math.matchAll(/\\([A-Za-z]+)/g)].map((match) => match[1])
    const safe = !commands.some((cmd) => dangerousCommands.has(cmd))
    if (!safe) {
      result = result.split(placeholder).join(escapeLatex(original))
    } else if (original.startsWith("$$") || original.startsWith("\\[")) {
      result = result.split(placeholder).join(`\\begin{equation*}\\fitmath{${math}}\\end{equation*}`)
    } else {
      result = result.split(placeholder).join(original)
    }
  }
  return result
}

function extractCitations(input: string): { text: string; slots: Slot[] } {
  if (typeof input !== "string") return { text: "", slots: [] }
  const slots: Slot[] = []
  let idx = 0

  const text = input
    .replace(/\\(?:cite[pt]?|nocite|autocite)\{([A-Za-z0-9_:\-,\s]+)\}/g, (match) => {
      const placeholder = `\x00CITE${idx++}\x00`
      slots.push({ placeholder, original: match })
      return placeholder
    })
    .replace(/\[@([A-Za-z0-9_:\-,\s@;]+)\]/g, (_match: string, keys: string) => {
      const placeholder = `\x00CITE${idx++}\x00`
      const cleanKeys = keys
        .split(/[,;]/)
        .map((k: string) => k.replace(/@/g, "").trim())
        .filter(Boolean)
        .join(", ")
      slots.push({ placeholder, original: `\\cite{${cleanKeys}}` })
      return placeholder
    })

  return { text, slots }
}

function restoreCitations(text: string, slots: Slot[]): string {
  let result = text
  for (const { placeholder, original } of slots) {
    result = result.split(placeholder).join(original)
  }
  return result
}

/**
 * Markdown links must be pulled out *before* escapeLatex runs, exactly like
 * math and citations. `\href`'s first argument is a URL, not typeset text:
 * `_` must stay literal (an escaped `\_` produces a dead DOI), but `%`, `#`
 * and `&` are still TeX catcodes even inside `\href` and must be escaped.
 * The link *text* is escaped normally, so the raw title is stashed and
 * re-parsed on restore.
 */
function extractLinks(input: string): { text: string; slots: Slot[] } {
  if (typeof input !== "string") return { text: "", slots: [] }
  const slots: Slot[] = []
  let idx = 0
  const text = input.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (match, _title: string, url: string) => {
    if (!/^https?:\/\//i.test(url)) return match
    const placeholder = `\x00LINK${idx++}\x00`
    slots.push({ placeholder, original: match })
    return placeholder
  })
  return { text, slots }
}

/** Escape TeX catcode specials inside an `\\href` URL; leave `_` literal. */
export function escapeHrefUrl(url: string): string {
  return url.replace(/[%#&]/g, (ch) => `\\${ch}`)
}

function restoreLinks(text: string, slots: Slot[]): string {
  let result = text
  for (const { placeholder, original } of slots) {
    const parsed = original.replace(/^\[([^\]\n]+)\]\(([^)\s]+)\)$/, (_m, title: string, url: string) =>
      `\\href{${escapeHrefUrl(url)}}{${escapeLatex(title)}}`
    )
    result = result.split(placeholder).join(parsed)
  }
  return result
}

/**
 * Single-pass escaper. Every special character is consumed exactly once by a
 * single regex, so replacements are never re-scanned: a literal backslash maps
 * straight to `\textbackslash{}` and the braces the replacement itself
 * introduces cannot be escaped again into the corrupt `\textbackslash\{\}`
 * the previous chained `.replace()` sequence produced (`\\` is escaped before
 * `[{}]` — chained passes always re-scan their own output).
 * `<`/`>` are included because they typeset as inverted ¡/¿ glyphs in T1 text
 * fonts, silently mangling math written outside $...$.
 */
const LATEX_SPECIALS: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "{": "\\{",
  "}": "\\}",
  $: "\\$",
  "&": "\\&",
  "%": "\\%",
  "#": "\\#",
  _: "\\_",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}",
  "<": "\\textless{}",
  ">": "\\textgreater{}",
}

export function escapeLatex(input: string): string {
  const decoded = decodeHtmlEntities(input)
  const text = decoded.replace(/[\\{}$&%#_~^<>]/g, (char) => LATEX_SPECIALS[char])
  return mapUnicodeToLatex(text)
}

/**
 * Unicode -> LaTeX-safe replacements. Single source of truth for the whole
 * pipeline.
 *
 * Under `inputenc[utf8]` + `fontenc[T1]` with no `newunicodechar` — which is
 * what every template in this repo emits — an unmapped character here is a
 * hard `Package inputenc Error: Unicode character ... not set up` compile
 * failure, not a cosmetic degradation. The thesis-review generator therefore
 * shares this exact function instead of keeping a second table that can drift.
 *
 * Must run *after* the special-character escape, so the `$...$` wrappers it
 * introduces are not themselves escaped.
 */
export function mapUnicodeToLatex(input: string): string {
  // Emoji and pictographs have no pdflatex representation at all; leaving one
  // in is a hard inputenc compile failure, so strip them outright.
  let text = input.replace(/([\u{1F000}-\u{1FAFF}]|[\u2600-\u26FF]|[\u2700-\u27BF]|\uFE0F|\u200D)/gu, "")
  const unicodeMap: Record<string, string> = {
    "⁰": "$^0$", "¹": "$^1$", "²": "$^2$", "³": "$^3$", "⁴": "$^4$",
    "⁵": "$^5$", "⁶": "$^6$", "⁷": "$^7$", "⁸": "$^8$", "⁹": "$^9$",
    "⁺": "$^+$", "⁻": "$^-$", "⁼": "$^=$", "⁽": "$^($", "⁾": "$^)$",
    "₀": "$_0$", "₁": "$_1$", "₂": "$_2$", "₃": "$_3$", "₄": "$_4$",
    "₅": "$_5$", "₆": "$_6$", "₇": "$_7$", "₈": "$_8$", "₉": "$_9$",
    "°": "$^\\circ$", "–": "--", "—": "---", "’": "'", "‘": "`", "“": "``", "”": "''",
    "≤": "$\\le$", "≥": "$\\ge$", "×": "$\\times$", "÷": "$\\div$", "±": "$\\pm$", "≈": "$\\approx$", "≠": "$\\neq$",
    "µ": "$\\mu$", "α": "$\\alpha$", "β": "$\\beta$", "γ": "$\\gamma$", "δ": "$\\delta$",
    "ε": "$\\epsilon$", "ϵ": "$\\epsilon$", "ζ": "$\\zeta$", "η": "$\\eta$", "θ": "$\\theta$", "κ": "$\\kappa$",
    "λ": "$\\lambda$", "μ": "$\\mu$", "ν": "$\\nu$", "ξ": "$\\xi$", "π": "$\\pi$", "ρ": "$\\rho$", "σ": "$\\sigma$",
    "τ": "$\\tau$", "φ": "$\\phi$", "ϕ": "$\\phi$", "χ": "$\\chi$", "ψ": "$\\psi$", "ω": "$\\omega$",
    "Γ": "$\\Gamma$", "Δ": "$\\Delta$", "Θ": "$\\Theta$", "Λ": "$\\Lambda$", "Ξ": "$\\Xi$", "Π": "$\\Pi$",
    "Σ": "$\\Sigma$", "Φ": "$\\Phi$", "Ψ": "$\\Psi$", "Ω": "$\\Omega$",
    "→": "$\\to$", "←": "$\\gets$", "↔": "$\\leftrightarrow$", "⇒": "$\\Rightarrow$", "⇐": "$\\Leftarrow$",
    "↑": "$\\uparrow$", "↓": "$\\downarrow$", "↕": "$\\updownarrow$",
    "↦": "$\\mapsto$", "⟶": "$\\longrightarrow$", "⟵": "$\\longleftarrow$",
    "∈": "$\\in$", "∉": "$\\notin$", "⊂": "$\\subset$", "⊆": "$\\subseteq$", "∩": "$\\cap$", "∪": "$\\cup$",
    // Operators & relations extended in 2026-09 audit fixes (F-02).
    // Every command here is available in base LaTeX math mode — deliberately
    // nothing from amssymb/esint/etc., because symbols shared across all 25
    // templates must not depend on packages individual classes may clash with.
    "∑": "$\\sum$", "∏": "$\\prod$", "∫": "$\\int$", "∮": "$\\oint$", "∞": "$\\infty$",
    "∂": "$\\partial$", "∇": "$\\nabla$", "√": "$\\sqrt{}$", "ℏ": "$\\hbar$", "ℓ": "$\\ell$",
    "⊕": "$\\oplus$", "⊗": "$\\otimes$", "⊖": "$\\ominus$", "⊘": "$\\oslash$",
    "≪": "$\\ll$", "≫": "$\\gg$", "·": "$\\cdot$", "∝": "$\\propto$",
    "∘": "$\\circ$", "∼": "$\\sim$", "≃": "$\\simeq$", "≅": "$\\cong$", "≡": "$\\equiv$",
    "⊥": "$\\perp$", "∥": "$\\parallel$",
    "⌊": "$\\lfloor$", "⌋": "$\\rfloor$", "⌈": "$\\lceil$", "⌉": "$\\rceil$",
    "⟨": "$\\langle$", "⟩": "$\\rangle$",
    "∀": "$\\forall$", "∃": "$\\exists$", "∅": "$\\emptyset$",
    // Text-mode symbols available via kernel-included textcomp (T1). Note:
    // § and ¶ are deliberately NOT mapped — inputenc[utf8] typesets them
    // correctly and users/tests expect them to pass through verbatim.
    "†": "\\textdagger{}", "‡": "\\textdaggerdbl{}",
    "©": "\\textcopyright{}", "®": "\\textregistered{}", "™": "\\texttrademark{}", "€": "\\texteuro{}",
  }
  for (const [char, repl] of Object.entries(unicodeMap)) {
    text = text.split(char).join(repl)
  }
  return text
}

export function parseMarkdownToLatex(input: string): string {
  const { text: afterMath, slots: mathSlots } = extractMath(input)
  const { text: afterCites, slots: citeSlots } = extractCitations(afterMath)
  const { text: afterLinks, slots: linkSlots } = extractLinks(afterCites)
  let text = escapeLatex(afterLinks)

  // Bold first so nested `**foo *bar* baz**` becomes `\textbf{foo \textit{bar} baz}`
  // rather than a leftover `**` pair. Inner single-stars are allowed; a second
  // `**` still terminates the span.
  text = text.replace(/\*\*((?:[^*]|\*(?!\*))+?)\*\*/g, "\\textbf{$1}")
  text = text.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "\\textit{$1}")
  text = text.replace(/`([^`\n]+)`/g, "\\texttt{$1}")
  // http(s) links were placeheld before escaping (see extractLinks); anything
  // still bracketed here has a non-web target, so keep the text and drop it.
  text = text.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_match, title: string) => title)

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
  text = restoreLinks(text, linkSlots)
  text = restoreCitations(text, citeSlots)
  text = restoreMath(text, mathSlots)

  return text
}
