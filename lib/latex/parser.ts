type MathSlot = { placeholder: string; original: string }

export function extractMath(input: string): { text: string; slots: MathSlot[] } {
  if (typeof input !== "string") return { text: "", slots: [] }
  const slots: MathSlot[] = []
  let idx = 0

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
    const math = original.slice(original.startsWith("$$") ? 2 : 1, original.endsWith("$$") ? -2 : -1).trim()
    // Math is opt-in and deliberately small: only common mathematical macros
    // are accepted. Everything else is rendered as ordinary escaped text.
    const allowed = new Set(["alpha", "beta", "gamma", "delta", "epsilon", "theta", "lambda", "mu", "pi", "sigma", "phi", "omega", "Gamma", "Delta", "Sigma", "Omega", "frac", "sqrt", "left", "right", "cdot", "times", "le", "ge", "neq", "approx", "in", "notin", "subset", "subseteq", "cap", "cup", "to", "gets", "rightarrow", "leftarrow", "Rightarrow", "Leftarrow", "text", "mathcal", "mathbb", "log", "exp", "sin", "cos", "tan", "sum", "prod", "int", "infty", "partial"])
    const commands = [...math.matchAll(/\\([A-Za-z]+)/g)].map((match) => match[1])
    const safe = /^[A-Za-z0-9\s+\-*/=<>^_{}()[\]|,.\\]+$/.test(math) && commands.every((command) => allowed.has(command))
    result = result.split(placeholder).join(safe ? original : escapeLatex(original))
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
  let text = escapeLatex(afterMath)

  text = text.replace(/\*\*([^*\n]+)\*\*/g, "\\textbf{$1}")
  text = text.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "\\textit{$1}")
  text = text.replace(/`([^`\n]+)`/g, "\\texttt{$1}")
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, title, url) => {
    if (/^https?:\/\//i.test(url)) {
      return `\\href{${url}}{${title}}`
    }
    return title
  })
  text = text.replace(/\[@([^\]]+)\]/g, (match, keys) => {
    return `\\cite{${keys.replace(/@/g, "")}}`
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
  text = restoreMath(text, mathSlots)

  return text
}
