import type { Card } from "@/lib/poster-types"

/**
 * Deterministic LaTeX quick fixes for card content (Quick Fixes v2).
 *
 * The AI autofix loop is powerful but slow, rate-limited (3/min) and
 * non-deterministic; the classic content breakages below have one obvious
 * mechanical repair each, so we offer them directly in the inspector before
 * escalating to the model. Every fix here is a pure `content -> content`
 * function and is unit-tested — no LLM, no network, no surprises.
 *
 * Content is Markdown (see the autofix prompt in autofix-compile/route.ts):
 * `_ % & # { }` are escaped automatically by the pipeline, so the only
 * breakages a user can author are malformed math, stray braces and unknown
 * commands inside math segments.
 */

export interface LatexQuickFix {
  id: string
  /** Short button label. */
  label: string
  /** One-line explanation shown under the button. */
  description: string
  /** Return the repaired content. */
  apply: (content: string) => string
}

/** Count unescaped `$` delimiters (parity is what matters, not pairs). */
function countDollars(content: string): number {
  let count = 0
  for (let i = 0; i < content.length; i++) {
    if (content[i] === "$" && content[i - 1] !== "\\") count++
  }
  return count
}

/**
 * True when index `i` sits inside a `$...$` / `$$...$$` / `\(...\)` / `\[...\]`
 * span. Used so markdown-level brace counting does not treat math grouping
 * (or typeset `\{x\}`) as document braces.
 */
function inMathSpan(content: string, index: number): boolean {
  MATH_SEGMENT.lastIndex = 0
  for (const match of content.matchAll(MATH_SEGMENT)) {
    if (match.index === undefined) continue
    if (index >= match.index && index < match.index + match[0].length) return true
  }
  return false
}

/** Odd number of preceding backslashes ⇒ the character is escaped. */
function isEscapedAt(content: string, index: number): boolean {
  let n = 0
  for (let j = index - 1; j >= 0 && content[j] === "\\"; j--) n++
  return n % 2 === 1
}

/**
 * Depth of unescaped braces, ignoring escaped `\{`/`\}` AND braces inside math
 * (so `$\{x\}$` is balanced, not an extra `}`). `\\{` (backslash command plus
 * grouping brace) still counts. Mirrors validation.ts.
 */
export function braceBalance(content: string): number {
  let depth = 0
  for (let i = 0; i < content.length; i++) {
    const ch = content[i]
    if (ch !== "{" && ch !== "}") continue
    if (inMathSpan(content, i)) continue
    if (isEscapedAt(content, i)) continue
    if (ch === "{") depth++
    else depth--
  }
  return depth
}

/** Unpaired `$$` display-math opener (not the same as an odd `$` count). */
export function hasOrphanDisplayMath(content: string): boolean {
  let open = false
  for (let i = 0; i < content.length; i++) {
    if (content[i] !== "$" || isEscapedAt(content, i)) continue
    if (content[i + 1] === "$") {
      open = !open
      i++
    }
  }
  return open
}

const TEXT_SPECIALS_IN_MATH = /\\text\{([^{}]*)\}/g

/** `\text{...}` spans inside math whose body has unescaped `% & # _`. */
export function findUnescapedTextSpecials(content: string): string[] {
  const hits: string[] = []
  MATH_SEGMENT.lastIndex = 0
  for (const match of content.matchAll(MATH_SEGMENT)) {
    TEXT_SPECIALS_IN_MATH.lastIndex = 0
    for (const t of match[0].matchAll(TEXT_SPECIALS_IN_MATH)) {
      const inner = t[1]
      for (let i = 0; i < inner.length; i++) {
        if ("%&#_".includes(inner[i]) && (i === 0 || inner[i - 1] !== "\\")) {
          hits.push(inner[i])
        }
      }
    }
  }
  return hits
}

function escapeTextSpecialsInMath(content: string): string {
  return content.replace(MATH_SEGMENT, (segment) =>
    segment.replace(TEXT_SPECIALS_IN_MATH, (_full, inner: string) => {
      let out = ""
      for (let i = 0; i < inner.length; i++) {
        const ch = inner[i]
        if ("%&#_".includes(ch) && (i === 0 || inner[i - 1] !== "\\")) out += `\\${ch}`
        else out += ch
      }
      return `\\text{${out}}`
    })
  )
}

/** Commands allowed inside `$…$` math (superset of what templates use). */
const KNOWN_MATH_COMMANDS = new Set([
  // Greek + misc letters
  "alpha", "beta", "gamma", "delta", "epsilon", "varepsilon", "zeta", "eta",
  "theta", "vartheta", "iota", "kappa", "lambda", "mu", "nu", "xi", "pi",
  "rho", "sigma", "tau", "upsilon", "phi", "varphi", "chi", "psi", "omega",
  "Gamma", "Delta", "Theta", "Lambda", "Xi", "Pi", "Sigma", "Upsilon", "Phi",
  "Psi", "Omega", "ell", "hbar", "imath", "jmath",
  // Operators & relations
  "times", "div", "pm", "mp", "cdot", "ast", "star", "circ", "bullet", "oplus",
  "ominus", "otimes", "oslash", "odot", "leq", "le", "geq", "ge", "neq", "ne",
  "approx", "equiv", "sim", "simeq", "cong", "propto", "ll", "gg", "subset",
  "subseteq", "supset", "supseteq", "in", "notin", "ni", "cup", "cap", "emptyset",
  "varnothing", "land", "lor", "neg", "rightarrow", "to", "leftarrow", "gets",
  "leftrightarrow", "Rightarrow", "Leftarrow", "Leftrightarrow", "mapsto",
  "longmapsto", "uparrow", "downarrow", "infty", "partial", "nabla", "forall",
  "exists", "top", "bot", "vdash", "models", "perp", "parallel", "angle",
  "triangle", "square", "checkmark",
  // Structures
  "frac", "dfrac", "tfrac", "sqrt", "sum", "prod", "coprod", "int", "oint",
  "iint", "iiint", "bigcup", "bigcap", "bigoplus", "bigotimes", "bigvee",
  "bigwedge", "lim", "limsup", "liminf", "sup", "inf", "max", "min", "log",
  "ln", "lg", "exp", "sin", "cos", "tan", "cot", "sec", "csc", "arcsin",
  "arccos", "arctan", "sinh", "cosh", "tanh", "det", "dim", "ker", "deg",
  "hom", "arg", "gcd", "Pr", "text", "mathrm", "mathbf", "mathit", "mathcal",
  "mathbb", "mathsf", "mathtt", "mathfrak", "boldsymbol", "hat", "bar",
  "overline", "underline", "vec", "tilde", "dot", "ddot", "breve", "check",
  "widehat", "widetilde", "overbrace", "underbrace", "overrightarrow",
  "left", "right", "langle", "rangle", "lVert", "rVert", "vert", "Vert",
  "lbrace", "rbrace", "lbrack", "rbrack", "begin", "end", "operatorname",
  "operatorname*", "textbf", "textit", "textrm", "emph", "quad", "qquad",
  "hspace", "vspace", "notag", "nonumber", "label", "ref", "eqref", "cite",
  "mathrm", "pmod", "bmod", "mod", "cases", "matrix", "pmatrix", "bmatrix",
  "vmatrix", "Vmatrix", "array", "substack", "atop", "choose", "binom",
  "dbinom", "tbinom", "over", "under", "underset", "overset", "stackrel",
  "limits", "nolimits", "displaystyle", "textstyle", "scriptstyle",
  "scriptscriptstyle", "color", "textcolor", "underline", "uline", "degree",
  "circ", "prime", "backslash", "dagger", "ddagger", "S", "P", "copyright",
])

const MATH_SEGMENT = /\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+?\$|\\\([\s\S]+?\\\)/g

/** Unknown `\commands` inside math segments — these are the compile killers. */
export function findUnknownMathCommands(content: string): string[] {
  const unknown = new Set<string>()
  for (const match of content.matchAll(MATH_SEGMENT)) {
    for (const cmdMatch of match[0].matchAll(/\\([A-Za-z]+)\*?/g)) {
      const name = cmdMatch[1]
      if (!KNOWN_MATH_COMMANDS.has(name)) unknown.add(`\\${name}`)
    }
  }
  return [...unknown]
}

/**
 * All mechanical fixes applicable to this card's content, in display order.
 * Returns [] for clean content. Each fix is independent — applying one does
 * not assume another will be applied afterwards.
 */
export function deriveQuickFixes(card: Card): LatexQuickFix[] {
  const content = typeof card.content === "string" ? card.content : ""
  if (!content.trim()) return []
  const fixes: LatexQuickFix[] = []

  if (countDollars(content) % 2 === 1) {
    fixes.push({
      id: "close-math",
      label: "Close unclosed $…$",
      description: "The content has an odd number of $ delimiters — the compiler fails with “Missing $ inserted”. Appends the missing $ at the end.",
      apply: (c) => {
        const trimmed = c.replace(/\s+$/, "")
        return `${trimmed}$${c.slice(trimmed.length)}`
      },
    })
  } else if (hasOrphanDisplayMath(content)) {
    fixes.push({
      id: "close-display-math",
      label: "Close unclosed $$…$$",
      description: "An opening $$ display-math delimiter has no matching closer — the compiler fails with “Display math should end with $$”. Appends the missing $$.",
      apply: (c) => {
        const trimmed = c.replace(/\s+$/, "")
        return `${trimmed}$$${c.slice(trimmed.length)}`
      },
    })
  }

  const depth = braceBalance(content)
  if (depth > 0) {
    fixes.push({
      id: "balance-braces",
      label: `Add ${depth} missing }`,
      description: `${depth} unclosed { — append${depth === 1 ? "s" : ""} the missing closing brace${depth === 1 ? "" : "s"}.`,
      apply: (c) => c + "}".repeat(depth),
    })
  } else if (depth < 0) {
    fixes.push({
      id: "balance-braces",
      label: `Remove ${-depth} extra }`,
      description: `${-depth} unopened } — remove${depth === -1 ? "s" : ""} the surplus closing brace${depth === -1 ? "" : "s"} from the end.`,
      apply: (c) => {
        let toRemove = -depth
        const chars = [...c]
        for (let i = chars.length - 1; i >= 0 && toRemove > 0; i--) {
          if (chars[i] === "}" && chars[i - 1] !== "\\") {
            chars.splice(i, 1)
            toRemove--
          }
        }
        return chars.join("")
      },
    })
  }

  const unknown = findUnknownMathCommands(content)
  if (unknown.length > 0) {
    fixes.push({
      id: "escape-unknown-commands",
      label: `Neutralise ${unknown.length} unknown command${unknown.length === 1 ? "" : "s"}`,
      description: `${unknown.join(", ")} ${unknown.length === 1 ? "is" : "are"} not valid LaTeX math commands (“Undefined control sequence”). Replace${unknown.length === 1 ? "s" : ""} ${unknown.length === 1 ? "it" : "them"} with plain text.`,
      apply: (c) =>
        c.replace(MATH_SEGMENT, (segment) =>
          segment.replace(/\\([A-Za-z]+)\*?/g, (full, name: string) =>
            KNOWN_MATH_COMMANDS.has(name) ? full : name
          )
        ),
    })
  }

  if (findUnescapedTextSpecials(content).length > 0) {
    fixes.push({
      id: "escape-text-specials",
      label: "Escape specials inside \\text{}",
      description: "Unescaped %, &, # or _ inside \\text{...} in math become TeX specials and abort the compile. Escapes them.",
      apply: escapeTextSpecialsInMath,
    })
  }

  return fixes
}

/** `\cite`/`[@key]` keys in this card that are missing from the bibliography. */
export function findDanglingCiteKeys(content: string, bibKeys: readonly string[]): string[] {
  if (!content) return []
  const known = new Set(bibKeys)
  const used = new Set<string>()
  for (const m of content.matchAll(/\\(?:cite[pt]?\*?|nocite|autocite)\{([^}]*)\}/g)) {
    for (const key of m[1].split(",")) {
      const k = key.trim()
      if (k) used.add(k)
    }
  }
  for (const m of content.matchAll(/\[@([A-Za-z0-9_:\-]+)/g)) {
    used.add(m[1])
  }
  return [...used].filter((k) => !known.has(k)).sort()
}

/** `\ref`/`\eqref` targets in this card that no card defines via `\label`. */
export function findDanglingRefKeys(content: string, allCardContents: readonly string[]): string[] {
  if (!content) return []
  const defined = new Set<string>()
  for (const src of allCardContents) {
    for (const m of (src ?? "").matchAll(/\\label\{([^}]*)\}/g)) defined.add(m[1].trim())
  }
  const used = new Set<string>()
  for (const m of content.matchAll(/\\(?:ref|eqref|autoref|cref|Cref)\{([^}]*)\}/g)) {
    const k = m[1].trim()
    if (k) used.add(k)
  }
  return [...used].filter((k) => !defined.has(k)).sort()
}
