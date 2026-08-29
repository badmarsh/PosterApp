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

export function escapeLatex(input: string): string {
  let text = input
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/[{}]/g, (char) => char === "{" ? "\\{" : "\\}")
    .replace(/\$/g, "\\$")
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}")

  const unicodeMap: Record<string, string> = {
    "⁰": "$^0$", "¹": "$^1$", "²": "$^2$", "³": "$^3$", "⁴": "$^4$",
    "⁵": "$^5$", "⁶": "$^6$", "⁷": "$^7$", "⁸": "$^8$", "⁹": "$^9$",
    "⁺": "$^+$", "⁻": "$^-$", "⁼": "$^=$", "⁽": "$^($", "⁾": "$^)$",
    "°": "$^\\circ$", "–": "--", "—": "---", "’": "'", "‘": "`", "“": "``", "”": "''",
    "≤": "$\\le$", "≥": "$\\ge$", "×": "$\\times$", "±": "$\\pm$", "≈": "$\\approx$", "≠": "$\\neq$",
    "µ": "$\\mu$", "α": "$\\alpha$", "β": "$\\beta$", "γ": "$\\gamma$", "δ": "$\\delta$",
    "ε": "$\\epsilon$", "ϵ": "$\\epsilon$", "ζ": "$\\zeta$", "η": "$\\eta$", "θ": "$\\theta$", "κ": "$\\kappa$",
    "λ": "$\\lambda$", "μ": "$\\mu$", "ν": "$\\nu$", "ξ": "$\\xi$", "π": "$\\pi$", "ρ": "$\\rho$", "σ": "$\\sigma$",
    "τ": "$\\tau$", "φ": "$\\phi$", "ϕ": "$\\phi$", "χ": "$\\chi$", "ψ": "$\\psi$", "ω": "$\\omega$",
    "Γ": "$\\Gamma$", "Δ": "$\\Delta$", "Θ": "$\\Theta$", "Λ": "$\\Lambda$", "Ξ": "$\\Xi$", "Π": "$\\Pi$",
    "Σ": "$\\Sigma$", "Φ": "$\\Phi$", "Ψ": "$\\Psi$", "Ω": "$\\Omega$",
    "→": "$\\to$", "←": "$\\gets$", "↔": "$\\leftrightarrow$", "⇒": "$\\Rightarrow$", "⇐": "$\\Leftarrow$",
    "∈": "$\\in$", "∉": "$\\notin$", "⊂": "$\\subset$", "⊆": "$\\subseteq$", "∩": "$\\cap$", "∪": "$\\cup$"
  }
  for (const [char, repl] of Object.entries(unicodeMap)) {
    text = text.split(char).join(repl)
  }
  return text
}

export function parseMarkdownToLatex(input: string): string {
  const { text: afterMath, slots: mathSlots } = extractMath(input)
  const { text: afterCites, slots: citeSlots } = extractCitations(afterMath)
  let text = escapeLatex(afterCites)

  text = text.replace(/\*\*([^*\n]+)\*\*/g, "\\textbf{$1}")
  text = text.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "\\textit{$1}")
  text = text.replace(/`([^`\n]+)`/g, "\\texttt{$1}")
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, title, url) => {
    if (/^https?:\/\//i.test(url)) {
      return `\\href{${url}}{${title}}`
    }
    return title
  })

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
  text = restoreCitations(text, citeSlots)
  text = restoreMath(text, mathSlots)

  return text
}
