import type { Card } from "@/lib/poster-types"

/**
 * Structured compile-log parser (Error Lens v1).
 *
 * pdflatex in `-interaction=nonstopmode` writes a line-oriented log: errors
 * start with `!`, carry context at `l.NNN`, and warnings arrive as prefixed
 * lines (`LaTeX Warning:`, `Package x Warning:`, `Overfull \hbox ...`).
 * Until now the app only showed this text verbatim; this module turns it into
 * a triage list so the UI can show counts, severity icons and — via
 * `attributeIssuesToCards` — jump-to-card.
 *
 * The parser is deliberately forgiving: compiler upgrades must degrade to
 * "unparsed error line" rather than throwing, and pathological logs are capped
 * so a runaway build can't freeze the sidebar.
 */

export type LatexLogIssueSeverity = "error" | "warning" | "info"

export type LatexLogIssueKind =
  | "latex-error"
  | "package-error"
  | "undefined-control-sequence"
  | "math"
  | "file-not-found"
  | "fatal"
  | "bibtex"
  | "overfull"
  | "underfull"
  | "warning"

export interface LatexLogIssue {
  /** Stable within one parse: `issue-<index>`. */
  id: string
  severity: LatexLogIssueSeverity
  kind: LatexLogIssueKind
  /** Single-line, human-readable message (leading `!` stripped). */
  message: string
  /** Continuation lines from the log, capped. */
  detail: string[]
  /** Source line in main.tex from the `l.NNN` marker, when present. */
  line?: number
  /** The offending source line printed after `l.NNN`, when present. */
  context?: string
  /** Card the issue is attributed to (set by `attributeIssuesToCards`). */
  cardId?: string
}

export interface ParsedCompileLog {
  issues: LatexLogIssue[]
  errorCount: number
  warningCount: number
  /** True when the log contains no error-severity issues. */
  succeeded: boolean
}

/** Hard caps so a pathological log cannot exhaust memory / the React tree. */
const MAX_ISSUES = 200
const MAX_DETAIL_LINES = 6

const FILE_NOT_FOUND = /File `([^']+)' not found/i
const CONTROL_SEQUENCE = /^Undefined control sequence/
const MISSING_MATH = /^Missing \$ inserted|^Display math should end with \$\$|^Extra \}|^Missing \\begin\{document\} in its body|^Paragraph ended before/
const OVERFULL = /^Overfull \\[hv]box \((\d+(?:\.\d+)?)pt too wide\)(?: in paragraph at lines (\d+)--(\d+))?/
const UNDERFULL = /^Underfull \\[hv]box \(badness \d+\)/
const L_LINE = /^l\.(\d+)\s?(.*)$/
const BIBTEX_ERROR = /^I couldn't open|^I found no |^You're missing a field/
const RUNAWAY = /^Runaway (argument|definition|text|preamble)/

function classifyError(message: string): LatexLogIssueKind {
  if (CONTROL_SEQUENCE.test(message)) return "undefined-control-sequence"
  if (MISSING_MATH.test(message)) return "math"
  if (FILE_NOT_FOUND.test(message)) return "file-not-found"
  if (/^Package .* Error/i.test(message)) return "package-error"
  if (/^LaTeX Error:/i.test(message)) return "latex-error"
  if (/^(==>\s*)?Fatal error|^Emergency stop/i.test(message)) return "fatal"
  return "latex-error"
}

function classifyWarning(line: string): LatexLogIssueKind | null {
  if (OVERFULL.test(line)) return "overfull"
  if (UNDERFULL.test(line)) return "underfull"
  if (BIBTEX_ERROR.test(line)) return "bibtex"
  if (/^(LaTeX|Package .*|pdfTeX|Class .*|Citation .*|Reference .*) [Ww]arning|^LaTeX Font Warning/i.test(line))
    return "warning"
  return null
}

function stripPrefix(message: string): string {
  return message.replace(/^!\s*/, "").trim()
}

/** Quoted fragments (`\`name'`) used for card attribution. */
export function extractQuotedNames(text: string): string[] {
  const out: string[] = []
  const re = /`([^']{1,120})'/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) out.push(m[1])
  return out
}

/**
 * Parse a pdflatex/bibtex combined log into structured issues.
 *
 * Unknown error shapes still surface (kind `latex-error`), so new compiler
 * versions can never silently hide failures from the UI.
 */
export function parseCompileLog(log: string | null | undefined): ParsedCompileLog {
  const issues: LatexLogIssue[] = []
  if (!log || typeof log !== "string") {
    return { issues, errorCount: 0, warningCount: 0, succeeded: true }
  }

  const lines = log.split(/\r?\n/)

  for (let i = 0; i < lines.length && issues.length < MAX_ISSUES; i++) {
    const raw = lines[i]

    if (raw.startsWith("!")) {
      let message = stripPrefix(raw)
      if (!message) continue
      const detail: string[] = []
      let line: number | undefined
      let context: string | undefined

      // Multi-line TeX diagnostics often start the block with
      // "Runaway argument?" *before* the `!` line (sometimes with the
      // truncated token sitting on the line in between). Capture it so
      // the UI sees the full error, not just the first `!` sentence.
      for (let k = 1; k <= 3 && i - k >= 0 && detail.length < MAX_DETAIL_LINES; k++) {
        if (RUNAWAY.test(lines[i - k])) {
          detail.push(lines[i - k])
          break
        }
      }

      // Error blocks are noisy: blank lines and boilerplate ("See the LaTeX
      // manual...") sit between the message and the `l.NNN` marker that
      // carries the offending source line. Scan a bounded window, stop at the
      // next error, and keep at most MAX_DETAIL_LINES informative lines.
      const windowEnd = Math.min(lines.length, i + 16)
      for (let j = i + 1; j < windowEnd; j++) {
        const l = lines[j]
        if (l.startsWith("!")) {
          i = j - 1
          break
        }
        const lm = L_LINE.exec(l)
        if (lm) {
          line = parseInt(lm[1], 10)
          context = lm[2].trim() || undefined
          // TeX splits a long control sequence across the `l.NNN` line and
          // the following indented continuation (`\thisisalong` / `command`).
          if (j + 1 < lines.length && /^\s+\S/.test(lines[j + 1]) && detail.length < MAX_DETAIL_LINES) {
            const cont = lines[j + 1].trim()
            if (cont) {
              detail.push(lines[j + 1])
              if (context && /^\\[A-Za-z@]+$/.test(context) && /^[A-Za-z@]+/.test(cont)) {
                context = context + cont.replace(/[^A-Za-z@].*$/, "")
              }
            }
          }
          i = j
          break
        }
        if (l.trim() !== "" && detail.length < MAX_DETAIL_LINES) {
          detail.push(l)
        }
        if (j === windowEnd - 1) i = j
      }

      const kind = classifyError(message)
      if (kind === "undefined-control-sequence") {
        const cmd = extractControlSequenceName(detail, context)
        if (cmd && !message.includes(`\\${cmd}`)) {
          message = `${message.replace(/\.$/, "")} \\${cmd}`
        }
      }

      issues.push({
        id: `issue-${issues.length}`,
        severity: "error",
        kind,
        message,
        detail,
        line,
        context,
      })
      continue
    }

    // Warnings (Overfull/Underfull boxes, package warnings, bibtex noise).
    if (raw.length > 0 && !/^\s/.test(raw)) {
      const kind = classifyWarning(raw)
      if (kind) {
        const isBox = kind === "overfull" || kind === "underfull"
        const detail: string[] = []
        let context: string | undefined
        if (isBox) {
          // The overflowing text is printed on the following line(s), often
          // starting with `[]` and a font selector. Capture it so we can
          // attribute the box to a card.
          for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) {
            const l = lines[j]
            if (!l) break
            if (l.startsWith("!") || classifyWarning(l)) break
            if (/^\s|^\[\]/.test(l) || /\\OT[12]/.test(l) || /\\OMS/.test(l)) {
              detail.push(l)
              i = j
            } else {
              break
            }
          }
          if (detail[0]) context = stripBoxGlyphLine(detail[0]) || undefined
        }
        issues.push({
          id: `issue-${issues.length}`,
          severity: isBox ? "info" : "warning",
          kind,
          message: raw.trim(),
          detail,
          line: isBox ? parseBoxLine(raw) : undefined,
          context,
        })
      }
    }
  }

  const errorCount = issues.filter((it) => it.severity === "error").length
  const warningCount = issues.filter((it) => it.severity === "warning").length
  return { issues, errorCount, warningCount, succeeded: errorCount === 0 }
}

/** Strip TeX's `[]` / `\OT1/lmr/...` glyph dump so the overflowing words remain. */
function stripBoxGlyphLine(line: string): string {
  return line
    .replace(/^\[\]\s*/, "")
    .replace(/^(?:\\[A-Z]+\d*(?:\/\S+)?\s*)+/, "")
    .replace(/^\([^)]*\)\s*/, "")
    .trim()
}

function parseBoxLine(line: string): number | undefined {
  const m = /at lines (\d+)--(\d+)/.exec(line)
  if (m) return parseInt(m[1], 10)
  const over = OVERFULL.exec(line)
  if (over?.[2]) return parseInt(over[2], 10)
  const under = UNDERFULL.exec(line)
  if (under?.[1]) return parseInt(under[1], 10)
  return undefined
}

/** Pull `\foo` out of TeX's many "Undefined control sequence" layouts. */
export function extractControlSequenceName(detail: string[], context?: string): string | undefined {
  const blobs = [...detail, context ?? ""]
  for (const d of blobs) {
    const recent = /<(?:recently read|argument|template|to be read again)>\s*\\([A-Za-z@]+)/.exec(d)
    if (recent) return recent[1]
    const leading = /^\s*\\([A-Za-z@]+)/.exec(d)
    if (leading) return leading[1]
  }
  if (context) {
    const m = /\\([A-Za-z@]+)/.exec(context)
    if (m) return m[1]
  }
  return undefined
}

/**
 * Normalize TeX-ish text so an `l.NNN` context line can be fuzzy-matched
 * against the markdown card content it was generated from: strip escape
 * backslashes, braces and markdown markers, collapse whitespace.
 */
function normalizeForMatch(text: string): string {
  return text
    .replace(/\\([A-Za-z@]+\*?|[{}$%&#_^~])/g, " ")
    .replace(/\\textbackslash\{\}/g, " ")
    .replace(/[{}]/g, " ")
    .replace(/[*_`#]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function cardHaystack(card: Card): string {
  const table = Array.isArray(card.table?.rows)
    ? card.table.rows.map((r) => (Array.isArray(r) ? r.join(" ") : String(r))).join(" ")
    : ""
  const figures = (card.figures ?? []).map((f) => `${f.url ?? ""} ${f.caption ?? ""}`).join(" ")
  return normalizeForMatch(`${card.title} ${card.content} ${table} ${figures}`)
}

function issueNeedles(issue: LatexLogIssue): string[] {
  const needles: string[] = []
  if (issue.kind === "undefined-control-sequence") {
    const cmd = extractControlSequenceName(issue.detail, issue.context)
    if (cmd) needles.push(`\\${cmd}`)
    const fromMsg = /\\([A-Za-z@]+)/.exec(issue.message)
    if (fromMsg && !needles.includes(`\\${fromMsg[1]}`)) needles.push(`\\${fromMsg[1]}`)
  }
  for (const name of extractQuotedNames(issue.message)) {
    if (name.length >= 4) needles.push(name)
  }
  const boxKind = issue.kind === "overfull" || issue.kind === "underfull"
  const minLen = boxKind ? 8 : 15
  const contextBlob = issue.context
    || (boxKind ? issue.detail.map(stripBoxGlyphLine).filter(Boolean).join(" ") : "")
  if (contextBlob && contextBlob.length >= minLen) {
    const norm = normalizeForMatch(contextBlob)
    if (norm.length >= minLen) {
      needles.push(norm.slice(0, Math.max(boxKind ? 16 : 24, Math.min(60, norm.length))))
    }
  }
  return needles
}

/**
 * Heuristically attach each issue to the card most likely responsible.
 *
 * Signals (in order): quoted file/command names appearing verbatim in the
 * card, and a normalized-prefix match of the `l.NNN` context line against the
 * card text. Returns a new array (input untouched); issues without a match
 * keep `cardId === undefined` — the UI must treat attribution as a hint, not
 * proof.
 */
export function attributeIssuesToCards<T extends LatexLogIssue>(
  issues: T[],
  cards: Card[],
): T[] {
  if (!cards.length) return issues.map((it) => ({ ...it }))

  const haystacks = cards.map((c) => ({ id: c.id, text: cardHaystack(c), raw: `${c.title}\n${c.content}` }))

  return issues.map((issue) => {
    const needles = issueNeedles(issue)
    if (!needles.length) return { ...issue }

    let best: { cardId: string; score: number } | null = null
    for (const h of haystacks) {
      let score = 0
      for (const nRaw of needles) {
        const isCommand = nRaw.startsWith("\\")
        const n = isCommand ? nRaw : normalizeForMatch(nRaw)
        if (!n) continue
        if (isCommand) {
          if (h.raw.includes(nRaw)) score += 3
        } else if (h.text.includes(n)) {
          score += n.length >= 24 ? 3 : 2
        }
      }
      if (score > 0 && (!best || score > best.score)) {
        best = { cardId: h.id, score }
      }
    }
    return best ? { ...issue, cardId: best.cardId } : { ...issue }
  })
}
