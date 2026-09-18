/**
 * Shared (server + client) LaTeX → plain-text utilities.
 *
 * This module is intentionally free of any "use client" directive, React
 * imports, or browser-only dependencies so it can be safely used in:
 *  - Next.js API routes (DOCX / PDF export)
 *  - LaTeX template generators
 *  - Test suites
 *  - Client components (via re-export in evidence-quote-viewer.tsx)
 */

const GREEK: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε",
  zeta: "ζ", eta: "η", theta: "θ", iota: "ι", kappa: "κ",
  lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π",
  rho: "ρ", sigma: "σ", tau: "τ", upsilon: "υ", phi: "φ",
  chi: "χ", psi: "ψ", omega: "ω",
  Alpha: "Α", Beta: "Β", Gamma: "Γ", Delta: "Δ", Epsilon: "Ε",
  Zeta: "Ζ", Eta: "Η", Theta: "Θ", Iota: "Ι", Kappa: "Κ",
  Lambda: "Λ", Mu: "Μ", Nu: "Ν", Xi: "Ξ", Pi: "Π",
  Rho: "Ρ", Sigma: "Σ", Tau: "Τ", Upsilon: "Υ", Phi: "Φ",
  Chi: "Χ", Psi: "Ψ", Omega: "Ω",
  varepsilon: "ε", varphi: "φ", varrho: "ρ",
}

const OPS: Record<string, string> = {
  pm: "±", mp: "∓", times: "×", div: "÷",
  leq: "≤", geq: "≥", neq: "≠", approx: "≈", sim: "∼",
  equiv: "≡", propto: "∝", infty: "∞",
  cdot: "·", ldots: "…", cdots: "…",
  sqrt: "√", sum: "Σ", prod: "Π",
  rightarrow: "→", leftarrow: "←", Rightarrow: "⇒", Leftarrow: "⇐",
}

function processLatexInner(inner: string): string {
  let s = inner.trim()
  // Unwrap \text{...}, \mathrm{...}, \mathbf{...}, \mathit{...}, \mbox{...}
  s = s.replace(/\\(?:text|mathrm|mathbf|mathit|mbox|hbox)\{([^}]*)\}/g, "$1")
  // Replace known Greek letters and operators
  s = s.replace(/\\([A-Za-z]+)/g, (_, cmd) => GREEK[cmd] ?? OPS[cmd] ?? `\\${cmd}`)
  // Strip remaining lone backslash commands
  s = s.replace(/\\([A-Za-z]+)/g, "$1")
  // Superscripts: ^{abc} → ^abc
  s = s.replace(/\^\{([^}]*)\}/g, "^$1")
  // Subscripts: _{abc} → _abc (keep for readability)
  s = s.replace(/_\{([^}]*)\}/g, "_$1")
  // Strip remaining curly braces
  s = s.replace(/[{}]/g, "")
  return s
}

/**
 * Converts a LaTeX-heavy string into readable plain text suitable for DOCX /
 * PDF contexts where KaTeX cannot render.
 *
 * Examples:
 *  - `$\alpha \pm 0.01$`          → `α ± 0.01`
 *  - `$R_2(Q)$ parameter`         → `R_2(Q) parameter`
 *  - `$\chi^2/\text{ndf}$`        → `χ^2/ndf`
 *  - `$$\lambda = 0.302 \pm 0.002$$` → `λ = 0.302 ± 0.002`
 *  - `\(E = mc^2\)`               → `E = mc^2`
 */
export function stripLatexForPlainText(text: string): string {
  if (!text) return ""

  let result = text
  // 1. Display math: $$...$$ → processed
  result = result.replace(/\$\$([\s\S]+?)\$\$/g, (_, inner) => processLatexInner(inner))
  // 2. Display math: \[...\] → processed
  result = result.replace(/\\\[([\s\S]+?)\\\]/g, (_, inner) => processLatexInner(inner))
  // 3. Inline math: $...$ → processed
  result = result.replace(/\$([^$]+)\$/g, (_, inner) => processLatexInner(inner))
  // 4. Inline math: \(...\) → processed
  result = result.replace(/\\\(([^)]+)\\\)/g, (_, inner) => processLatexInner(inner))
  // 5. Remaining lone backslash commands at the text level
  result = result.replace(/\\([A-Za-z]+)/g, (_, cmd) => GREEK[cmd] ?? OPS[cmd] ?? "")
  // 6. Strip stray curly braces
  result = result.replace(/[{}]/g, "")
  // 7. Normalize whitespace
  result = result.replace(/\s+/g, " ").trim()

  return result
}
