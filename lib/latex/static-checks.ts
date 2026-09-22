/**
 * Static structural checks for generated LaTeX documents.
 *
 * Why this exists
 * ---------------
 * A real compile is the only complete oracle, but the compile path here is a
 * sandboxed pdflatex inside a Docker image that unit tests cannot reach. The
 * failure modes that actually break a user's PDF export are, however, almost
 * all *structural* and detectable before TeX ever runs:
 *
 *   - an environment opened but never closed
 *   - `\usepackage` emitted after `\begin{document}`
 *   - a colour name used that nothing ever defined (`Undefined color`)
 *   - a command whose package was never loaded (`Undefined control sequence`)
 *   - `\includegraphics{}` with an empty path (fatal "File '' not found")
 *   - display-scale inline math that will overrun the column
 *
 * Each of those maps to a specific TeX error message, so the checks below are
 * written against the *error TeX would produce*, not against a vague notion of
 * "looks valid". Findings carry a `texHint` naming that error so a future
 * reader can tell why a rule exists.
 *
 * This module is deliberately dependency-free and side-effect-free so it can be
 * used both from vitest (see `__tests__/template-static-audit.test.ts`) and, if
 * ever wanted, from the compile API as a pre-flight gate.
 */

import { isWideInlineMath } from "./parser"

export type LatexIssueSeverity = "error" | "warning"

export type LatexIssueCode =
  | "missing-documentclass"
  | "multiple-documentclass"
  | "missing-begin-document"
  | "missing-end-document"
  | "package-after-begin-document"
  | "unbalanced-environment"
  | "unbalanced-braces"
  | "undefined-color"
  | "missing-package"
  | "empty-graphics-path"
  | "unprotected-wide-math"

export interface LatexIssue {
  code: LatexIssueCode
  severity: LatexIssueSeverity
  message: string
  /** 1-based line number, when the check is line-oriented. */
  line?: number
  /** The TeX error this finding stands in for. */
  texHint?: string
}

/**
 * Colours TeX knows without any `\definecolor`: xcolor's base set plus the
 * ones the `color` package always provides. Anything else must be defined in
 * the document (or by the class — see `CLASS_DEFINED_COLORS`).
 */
const XCOLOR_BASE_COLORS = new Set([
  "black", "white", "red", "green", "blue", "cyan", "magenta", "yellow",
  "darkgray", "gray", "lightgray", "brown", "lime", "olive", "orange",
  "pink", "purple", "teal", "violet",
  // xcolor aliases
  "cyan", "darkgrey", "grey", "lightgrey",
])

/**
 * tikz accepts these as colour *keywords* rather than resolving them through
 * xcolor, so `draw=none` / `fill=transparent` are legal without any
 * `\definecolor`.
 */
const TIKZ_COLOR_KEYWORDS = new Set(["none", "transparent"])

/**
 * Colour names a document class defines for you, so using them is not an
 * "Undefined color" error. Kept per-class because the sets are unrelated.
 *
 * tikzposter's `\definecolorstyle`/`\usecolorstyle` machinery always installs
 * these seven names; beamer installs its palette through `\setbeamercolor`
 * (which defines the colour at use time, not a global macro we can see), so
 * beamer colour lookups are skipped entirely.
 */
const CLASS_DEFINED_COLORS: Record<string, string[]> = {
  tikzposter: [
    "backgroundcolor", "titlefgcolor", "titlebgcolor",
    "blocktitlefgcolor", "blocktitlebgcolor",
    "blockbodyfgcolor", "blockbodybgcolor",
    "blocklinewidth", "innerblocktitlefgcolor", "innerblocktitlebgcolor",
  ],
}

/**
 * Packages that `\RequirePackage` other packages internally, so a document
 * loading `jinstpub` gets `graphicx` for free. Verified against the vendored
 * copies in `public/latex-styles/` (e.g. `jinstpub.sty:41`, `pos.sty:11`,
 * `webofc.cls`, `iopart.cls`) — not assumed from the class name.
 */
const PACKAGE_PROVIDES: Record<string, string[]> = {
  jinstpub: ["graphicx", "amsmath", "hyperref"],
  pos: ["graphicx", "amsmath", "hyperref"],
  acl: ["amsmath", "hyperref", "url", "xcolor"],
  cvpr: ["graphicx", "amsmath", "hyperref", "xcolor"],
  icml2026: ["xcolor", "hyperref"],
  aaai2026: ["url"],
  webofc: ["amsmath", "graphicx"],
}

/**
 * Commands and the package that must be loaded for them to exist.
 *
 * The value may list alternatives (`["xcolor", "color"]`) — any one of them
 * satisfies the requirement. `CLASS_PROVIDES` records classes that load a
 * package implicitly, so a template does not have to spell it out.
 */
const COMMAND_REQUIRES: Record<string, string[]> = {
  includegraphics: ["graphicx"],
  resizebox: ["graphicx"],
  scalebox: ["graphicx"],
  rotatebox: ["graphicx"],
  toprule: ["booktabs"],
  midrule: ["booktabs"],
  bottomrule: ["booktabs"],
  definecolor: ["xcolor", "color"],
  colorlet: ["xcolor"],
  rowcolor: ["xcolor", "colortbl"],
  cellcolor: ["xcolor", "colortbl"],
  fitmath: ["__macro_fitmath__"],
  fitstat: ["__macro_fitmath__"],
  fitinline: ["__macro_fitmath__"],
}

const ENV_REQUIRES: Record<string, string[]> = {
  multicols: ["multicol"],
  tabularx: ["tabularx"],
  tikzpicture: ["tikz"],
  align: ["amsmath"],
  "align*": ["amsmath"],
  "equation*": ["amsmath"],
  gather: ["amsmath"],
  "gather*": ["amsmath"],
  cases: ["amsmath"],
  pmatrix: ["amsmath"],
  bmatrix: ["amsmath"],
}

/** Packages a document class loads on its own. */
const CLASS_PROVIDES: Record<string, string[]> = {
  beamer: ["graphicx", "xcolor", "hyperref", "amsmath", "tikz", "color"],
  tikzposter: ["tikz", "xcolor", "color", "graphicx"],
  revtex42: ["amsmath", "amssymb", "graphicx", "hyperref"],
  acmart: ["amsmath", "graphicx", "hyperref", "booktabs", "xcolor", "color", "balance"],
  elsarticle: ["graphicx", "amsmath"],
  // a0poster.cls is a bare article-derived class: it loads neither xcolor nor
  // colour, so `\definecolor` there really is undefined.
  a0poster: [],
  article: [],
  llncs: [],
  iopart: [],
  webofc: ["amsmath", "graphicx"],
}

/** Classes that always install hyperref for you. */
const CLASS_LOADS_HYPERREF = new Set(["beamer", "acmart", "revtex42"])

const PREAMBLE_ONLY_COMMANDS = new Set(["usepackage", "RequirePackage", "documentclass"])

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

/**
 * Remove comments, respecting `\%`.
 *
 * Trailing `%` is load-bearing in this codebase (it suppresses the space at a
 * line break inside metric tiles), so the *stripped* form is only ever used
 * for analysis — the original text is returned separately.
 */
export function stripComments(tex: string): string {
  return tex
    .split("\n")
    .map((line) => {
      let out = ""
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === "%") {
          // `\%` is a literal percent, not a comment start. A preceding run of
          // backslashes must be counted: `\\%` is a newline then a comment.
          let backslashes = 0
          for (let j = i - 1; j >= 0 && line[j] === "\\"; j--) backslashes++
          if (backslashes % 2 === 1) {
            out += ch
            continue
          }
          break
        }
        out += ch
      }
      return out
    })
    .join("\n")
}

function documentClass(tex: string): string | null {
  const m = stripComments(tex).match(/\\documentclass(?:\[[^\]]*\])?\{([^}]+)\}/)
  return m ? m[1] : null
}

/** Commands whose `{...}` argument bodies are *templates*, not live text. */
const DEFINITION_COMMANDS = [
  "newcommand", "providecommand", "renewcommand",
  "newenvironment", "renewenvironment", "provideenvironment",
  "DeclareRobustCommand", "edef", "gdef", "xdef",
]

/**
 * Blank out the `{...}` argument bodies of macro-definition commands.
 *
 * A definition is a *template*: `\newcommand{\looseitems}{\begin{itemize}}` is
 * perfectly legal LaTeX even though the body opens an environment it never
 * closes — the caller closes it. Counting those `\begin`s as live document
 * structure produces a false "unbalanced environment" for every template that
 * defines a list helper, so they are removed before structure is checked.
 *
 * Braces are matched properly (respecting `\{`) so a nested group cannot end
 * the scan early.
 */
export function blankDefinitionBodies(clean: string): string {
  let out = ""
  let i = 0
  while (i < clean.length) {
    if (clean[i] === "\\") {
      const nameMatch = /^\\([A-Za-z]+)/.exec(clean.slice(i))
      if (nameMatch && DEFINITION_COMMANDS.includes(nameMatch[1])) {
        out += clean.slice(i, i + nameMatch[0].length)
        i += nameMatch[0].length
        // Optional `[n]` / `[default]` and the macro name `\foo` stay visible.
        while (i < clean.length && (clean[i] === " " || clean[i] === "\n")) { out += clean[i]; i++ }
        if (clean[i] === "[") {
          const close = clean.indexOf("]", i)
          if (close >= 0) { out += clean.slice(i, close + 1); i = close + 1 }
        }
        if (clean[i] === "{") {
          // The macro name group of \newcommand{\foo}
          const end = matchBrace(clean, i)
          if (end > i) { out += clean.slice(i, end + 1); i = end + 1 }
        }
        // Blank every following `{...}` group: the replacement text, and for
        // \newenvironment the begin- and end-code.
        for (let groups = 0; groups < 2; groups++) {
          if (clean[i] !== "{") break
          const end = matchBrace(clean, i)
          if (end <= i) break
          // Blank the body but keep newlines so line numbers stay meaningful.
          out += clean.slice(i, end + 1).replace(/[^\n]/g, " ")
          i = end + 1
        }
        continue
      }
    }
    out += clean[i]
    i++
  }
  return out
}

/** Index of the `}` matching the `{` at `start`, or -1. Respects `\{`. */
function matchBrace(s: string, start: number): number {
  let depth = 0
  for (let i = start; i < s.length; i++) {
    if (s[i] === "\\") { i++; continue }
    if (s[i] === "{") depth++
    else if (s[i] === "}") {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/** All `\usepackage{...}` package names, comma-lists expanded. */
function loadedPackages(tex: string): Set<string> {
  const clean = stripComments(tex)
  const out = new Set<string>()
  const re = /\\(?:usepackage|RequirePackage)(?:\[[^\]]*\])?\{([^}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(clean))) {
    for (const name of m[1].split(",")) {
      const trimmed = name.trim()
      if (trimmed) out.add(trimmed)
    }
  }
  return out
}

/** Names introduced by `\definecolor`, `\colorlet`, `\definecolorset`. */
function definedColors(tex: string): Set<string> {
  const clean = stripComments(tex)
  const out = new Set<string>()
  const re = /\\(?:definecolor|colorlet|providecolor|preparecolor|preparecolorset)\s*\{([^}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(clean))) {
    const name = m[1].trim()
    if (name) out.add(name)
  }
  return out
}

/** Normalise a colour reference: `maincolor!20` -> `maincolor`. */
function baseColorName(ref: string): string {
  return ref.split("!")[0].trim()
}

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

function checkStructure(clean: string): LatexIssue[] {
  const issues: LatexIssue[] = []

  const classMatches = [...clean.matchAll(/\\documentclass(?:\[[^\]]*\])?\{([^}]+)\}/g)]
  if (classMatches.length === 0) {
    issues.push({
      code: "missing-documentclass", severity: "error",
      message: "Document has no \\documentclass — pdflatex aborts immediately.",
      texHint: "Missing \\begin{document}",
    })
  } else if (classMatches.length > 1) {
    issues.push({
      code: "multiple-documentclass", severity: "error",
      message: `Document declares ${classMatches.length} \\documentclass commands; only the first is honoured, the rest are errors.`,
      texHint: "Two \\documentclass commands",
    })
  }

  if (!/^\s*\\begin\{document\}/m.test(clean)) {
    issues.push({
      code: "missing-begin-document", severity: "error",
      message: "No \\begin{document}.", texHint: "Missing \\begin{document}",
    })
  }
  if (!/\\end\{document\}/.test(clean)) {
    issues.push({
      code: "missing-end-document", severity: "error",
      message: "No \\end{document} — pdflatex hangs waiting for more input.",
      texHint: "Emergency stop / File ended while scanning",
    })
  }

  // \usepackage after \begin{document} is a hard error, and the generator
  // composes preambles by string concatenation, so a stray template can
  // easily land one in the body.
  const bodyStart = clean.search(/^\s*\\begin\{document\}/m)
  if (bodyStart >= 0) {
    const body = clean.slice(bodyStart)
    for (const cmd of PREAMBLE_ONLY_COMMANDS) {
      const re = new RegExp(`\\\\${cmd}\\b`)
      if (re.test(body)) {
        issues.push({
          code: "package-after-begin-document", severity: "error",
          message: `\\${cmd} appears after \\begin{document}.`,
          texHint: "LaTeX Error: Can be used only in the preamble",
        })
      }
    }
  }

  return issues
}

/**
 * Environments that are not really `\begin/\end` pairs from the parser's point
 * of view — `\\` inside a tabular is not an environment, but `document`,
 * `frame`, `column(s)`, `block`, `minipage`, `center`, `itemize`, `equation*`
 * all are.
 */
function checkEnvironments(clean: string): LatexIssue[] {
  const issues: LatexIssue[] = []
  const structural = blankDefinitionBodies(clean)
  const stack: { name: string; line: number }[] = []
  const lines = structural.split("\n")

  lines.forEach((line, idx) => {
    const re = /\\(begin|end)\{([^}]+)\}/g
    let m: RegExpExecArray | null
    while ((m = re.exec(line))) {
      const [, kind, name] = m
      if (kind === "begin") stack.push({ name, line: idx + 1 })
      else {
        const top = stack[stack.length - 1]
        if (!top || top.name !== name) {
          issues.push({
            code: "unbalanced-environment", severity: "error", line: idx + 1,
            message: top
              ? `\\end{${name}} on line ${idx + 1} closes \\begin{${top.name}} opened on line ${top.line}.`
              : `\\end{${name}} on line ${idx + 1} has no matching \\begin{${name}}.`,
            texHint: `\\begin{${name}} ended by \\end{document}`,
          })
          // Drop the innermost open env so one mismatch does not cascade into
          // a report of every enclosing environment.
          if (top) stack.pop()
        } else {
          stack.pop()
        }
      }
    }
  })

  for (const open of stack) {
    issues.push({
      code: "unbalanced-environment", severity: "error", line: open.line,
      message: `\\begin{${open.name}} on line ${open.line} is never closed.`,
      texHint: `\\begin{${open.name}} ended by \\end{document}`,
    })
  }

  return issues
}

function checkBraces(clean: string): LatexIssue[] {
  let depth = 0
  let line = 1
  let worstLine: number | undefined
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (ch === "\n") { line++; continue }
    if (ch === "\\") { i++; continue } // skip the escaped char
    if (ch === "{") depth++
    else if (ch === "}") {
      depth--
      if (depth < 0 && worstLine === undefined) worstLine = line
    }
  }
  if (depth !== 0) {
    return [{
      code: "unbalanced-braces", severity: "error", line: worstLine,
      message: `Unbalanced braces: ${depth > 0 ? depth + " unclosed" : -depth + " extra closing"} at end of document.`,
      texHint: "Missing } inserted / Extra }, or forgotten \\endgroup",
    }]
  }
  return []
}

/**
 * Every colour name referenced anywhere in the document must resolve.
 *
 * Collects references from the places a colour name can legally appear:
 * `\color{}`, `\textcolor{}{}`, `\fcolorbox{}{}{}`, `\pagecolor{}`,
 * `\definecolor{X}{MODEL}{}` value, tikz `color=`/`fill=`/`draw=` keys and
 * `\setbeamercolor` `fg=`/`bg=` values.
 */
function checkColors(clean: string, cls: string | null): LatexIssue[] {
  const defined = definedColors(clean)
  for (const name of XCOLOR_BASE_COLORS) defined.add(name)
  if (cls && CLASS_DEFINED_COLORS[cls]) for (const name of CLASS_DEFINED_COLORS[cls]) defined.add(name)

  // Beamer palettes are resolved through `\setbeamercolor` at typeset time and
  // include names like `structure`, `block title`, `palette primary`; none of
  // those are `\definecolor`'d in the document. Checking them produces only
  // false positives, so beamer documents are exempt.
  if (cls === "beamer") return []

  const refs = new Set<string>()
  const patterns: RegExp[] = [
    /\\(?:text)?color(?:\[[^\]]*\])?\{([^}]*)\}/g,
    /\\pagecolor(?:\[[^\]]*\])?\{([^}]*)\}/g,
    /\\fcolorbox(?:\[[^\]]*\])?\{([^}]*)\}\{([^}]*)\}/g,
    // `\colorlet{newname}{existing}` — the second argument is a reference, and
    // an undefined source colour is the same fatal xcolor error.
    /\\colorlet\s*\{[^}]*\}\s*\{([^}]*)\}/g,
    /(?:^|[,\s\[])(?:color|fill|draw|fill\s*draw)\s*=\s*([A-Za-z][A-Za-z0-9_.!-]*)/gm,
  ]
  for (const re of patterns) {
    let m: RegExpExecArray | null
    while ((m = re.exec(clean))) {
      for (let g = 1; g < m.length; g++) {
        const raw = m[g]
        if (!raw) continue
        for (const part of raw.split(",")) {
          // `fg=white,bg=maincolor` and `maincolor!20!white` both reduce to the
          // base names on either side of a `!` mix.
          for (const seg of part.split("=")) {
            const name = baseColorName(seg)
            if (/^[A-Za-z][A-Za-z0-9_.]*$/.test(name)) refs.add(name)
          }
        }
      }
    }
  }

  const issues: LatexIssue[] = []
  for (const name of [...refs].sort()) {
    if (defined.has(name)) continue
    if (TIKZ_COLOR_KEYWORDS.has(name)) continue
    issues.push({
      code: "undefined-color", severity: "error",
      message: `Colour "${name}" is used but never defined in this document.`,
      texHint: `Package xcolor Error: Undefined color '${name}'`,
    })
  }
  return issues
}

function checkPackages(clean: string, cls: string | null): LatexIssue[] {
  const loaded = loadedPackages(clean)
  const provided = new Set<string>(loaded)
  if (cls) {
    const key = cls.replace(/[^a-z0-9]/gi, "")
    for (const p of CLASS_PROVIDES[key] ?? []) provided.add(p)
  }
  // Transitively required packages: `\usepackage{jinstpub}` brings graphicx
  // with it (public/latex-styles/jinstpub.sty:41).
  for (const pkg of [...provided]) {
    for (const p of PACKAGE_PROVIDES[pkg] ?? []) provided.add(p)
  }
  // The shared FITMATH_MACRO defines \fitmath/\fitstat; its presence is the
  // marker we look for rather than a package name.
  const hasFitMathMacro = /\\providecommand\{\\fitmath\}/.test(clean)
  if (hasFitMathMacro) provided.add("__macro_fitmath__")

  const issues: LatexIssue[] = []
  const reported = new Set<string>()

  for (const [cmd, options] of Object.entries(COMMAND_REQUIRES)) {
    const re = new RegExp(`\\\\${cmd}(?![A-Za-z])`)
    if (!re.test(clean)) continue
    if (options.some((o) => provided.has(o))) continue
    const label = `\\${cmd}`
    if (reported.has(label)) continue
    reported.add(label)
    issues.push({
      code: "missing-package", severity: "error",
      message: `\\${cmd} is used but none of ${options.map((o) => (o.startsWith("__") ? "the FITMATH_MACRO definition" : "`" + o + "`")).join(" / ")} is loaded.`,
      texHint: `Undefined control sequence. \\${cmd}`,
    })
  }

  // `\href` is what the markdown parser emits for [text](url) links. hyperref
  // supplies it, but several venues forbid hyperref outright
  // (public/latex-styles/aaai2026.sty:239 raises a \PackageError if it is
  // loaded) and others simply do not load it, so a document-level
  // `\providecommand{\href}` fallback also satisfies the requirement.
  if (/\\href(?![A-Za-z])/.test(clean)) {
    const hasFallback = /\\(?:provide|re|new)command\s*\{?\\href/.test(clean)
    if (!provided.has("hyperref") && !hasFallback && !reported.has("href")) {
      reported.add("href")
      issues.push({
        code: "missing-package", severity: "error",
        message: "\\href is used but hyperref is not loaded and no \\href fallback is defined.",
        texHint: "Undefined control sequence. \\href",
      })
    }
  }

  for (const [env, options] of Object.entries(ENV_REQUIRES)) {
    const re = new RegExp(`\\\\begin\\{${env.replace("*", "\\*")}\\}`)
    if (!re.test(clean)) continue
    if (options.some((o) => provided.has(o))) continue
    if (reported.has(env)) continue
    reported.add(env)
    issues.push({
      code: "missing-package", severity: "error",
      message: `Environment ${env} is used but ${options.map((o) => "`" + o + "`").join(" / ")} is not loaded.`,
      texHint: `Environment ${env} undefined`,
    })
  }

  return issues
}

/**
 * `\includegraphics` with an empty mandatory argument.
 *
 * `normalizeLatexPath` strips `{ } % # ~ $ & ^`, whitespace and control
 * characters from asset URLs; a URL made only of those characters collapses to
 * the empty string and graphicx then dies on `File '' not found`.
 */
function checkGraphicsPaths(clean: string): LatexIssue[] {
  const issues: LatexIssue[] = []
  const re = /\\includegraphics(?:\[[^\]]*\])?\{([^}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(clean))) {
    if (m[1].trim().length === 0) {
      const line = clean.slice(0, m.index).split("\n").length
      issues.push({
        code: "empty-graphics-path", severity: "error", line,
        message: "\\includegraphics has an empty file path.",
        texHint: "File `' not found",
      })
    }
  }
  return issues
}

/**
 * Inline math wide enough to overrun the column.
 *
 * Poster columns are ~26 cm wide at `\normalsize`, so an inline run carrying a
 * `\frac`, a large operator or a nested environment will overflow. The parser
 * wraps `$$...$$`/`\[...\]` in `\fitmath` and wide inline `$...$`/`\(...\)` in
 * `\fitinline`; this check catches the ones that slipped through, using the
 * exact same predicate the generator uses (`isWideInlineMath`) so the two can
 * never disagree.
 */
/**
 * `$...$` inside a tikz picture is *coordinate arithmetic*, not TeX math:
 * `$(\titleposright,\titlepostop)!0.5!(\titleposright,\titlepostop)$` is the
 * tikz "partway between two points" operator. The ATLAS poster title bar uses
 * exactly this to centre the logos. It must not be read as a 66-character
 * inline formula.
 */
const TIKZ_INTERPOLATION = /^\([^)]*\)\s*!.*\(/

export function checkWideInlineMath(clean: string): LatexIssue[] {
  const issues: LatexIssue[] = []
  const re = /(?<!\\)\$([^$\n]+?)\$(?!\\)|\\\(((?:.|\n)+?)\\\)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(clean))) {
    const body = (m[1] ?? m[2] ?? "").trim()
    if (TIKZ_INTERPOLATION.test(body)) continue
    if (!isWideInlineMath(body)) continue
    // Already protected.
    const before = clean.slice(Math.max(0, m.index - 40), m.index)
    if (/\\(?:fitmath|fitinline|resizebox|scalebox)\{[^{}]*$/.test(before)) continue
    const line = clean.slice(0, m.index).split("\n").length
    issues.push({
      code: "unprotected-wide-math", severity: "warning", line,
      message: `Inline math of ${body.length} characters is not wrapped in \\fitmath/\\fitinline and will overrun the column.`,
      texHint: "Overfull \\hbox in paragraph",
    })
  }
  return issues
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export interface StaticCheckOptions {
  /** Report `unprotected-wide-math` warnings. On by default. */
  wideMath?: boolean
  /** Extra package names known to be available (e.g. copied into the stage dir). */
  extraPackages?: string[]
}

/**
 * Run every structural check over a generated document and return the
 * findings, errors first. An empty array means the document passes the same
 * structural bar the compile would hold it to.
 */
export function checkLatexDocument(tex: string, options: StaticCheckOptions = {}): LatexIssue[] {
  const clean = stripComments(tex)
  const cls = documentClass(clean)

  const issues: LatexIssue[] = [
    ...checkStructure(clean),
    ...checkEnvironments(clean),
    ...checkBraces(clean),
    ...checkColors(clean, cls),
    ...checkPackages(clean, cls),
    ...checkGraphicsPaths(clean),
    ...(options.wideMath === false ? [] : checkWideInlineMath(clean)),
  ]

  if (options.extraPackages?.length) {
    const allow = new Set(options.extraPackages)
    return issues.filter((i) => !(i.code === "missing-package" && [...allow].some((p) => i.message.includes(`\`${p}\``))))
  }

  const rank: Record<LatexIssueSeverity, number> = { error: 0, warning: 1 }
  return issues.sort((a, b) => rank[a.severity] - rank[b.severity])
}

/** Convenience: only the findings that would abort a compile. */
export function latexErrors(tex: string, options: StaticCheckOptions = {}): LatexIssue[] {
  return checkLatexDocument(tex, options).filter((i) => i.severity === "error")
}

/** True when the class is one that already guarantees hyperref. */
export function classProvidesHyperref(tex: string): boolean {
  const cls = documentClass(stripComments(tex))
  if (cls && CLASS_LOADS_HYPERREF.has(cls)) return true
  return loadedPackages(tex).has("hyperref")
}
