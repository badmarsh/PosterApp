"use client"

import React, { useMemo, useState } from "react"
import katex from "katex"
import "katex/dist/katex.min.css"
import { ChevronDown, ChevronUp } from "lucide-react"

interface Props {
  quote: string
  className?: string
  /** Maximum rows to preview in table mode before truncating (default: 6) */
  maxTableRows?: number
}

/**
 * Pure function to split text on inline math ($...$ or \(...\)).
 */
export function parseInlineMath(text: string): { kind: "text" | "math"; value: string }[] {
  if (!text) return []
  const result: { kind: "text" | "math"; value: string }[] = []
  const re = /\$([^$]+)\$|\\\(([^)]+)\\\)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      result.push({ kind: "text", value: text.slice(last, m.index) })
    }
    result.push({ kind: "math", value: m[1] ?? m[2] ?? "" })
    last = m.index + m[0].length
  }
  if (last < text.length) {
    result.push({ kind: "text", value: text.slice(last) })
  }
  return result
}

/**
 * Re-export from shared (server + client safe) module so callers only need
 * to import from this file. The implementation lives in latex-utils.ts to
 * keep it usable in Next.js API routes and DOCX generators.
 */
export { stripLatexForPlainText } from "@/lib/thesis-review/latex-utils"

// In-memory bounded cache for KaTeX rendering to prevent re-parsing identical formulas
const katexRenderCache = new Map<string, string>()
const MAX_KATEX_CACHE = 1000

function renderKatexCached(formula: string, displayMode = false): string {
  const key = `${displayMode ? "D:" : "I:"}${formula}`
  const hit = katexRenderCache.get(key)
  if (hit !== undefined) return hit

  try {
    const html = katex.renderToString(formula, {
      throwOnError: false,
      displayMode,
    })
    if (katexRenderCache.size >= MAX_KATEX_CACHE) {
      const firstKey = katexRenderCache.keys().next().value
      if (firstKey) katexRenderCache.delete(firstKey)
    }
    katexRenderCache.set(key, html)
    return html
  } catch {
    return formula
  }
}

/**
 * Parses inline math ($...$ or \(...\)) and renders mixed text and KaTeX.
 */
export const InlineMathRenderer = React.memo(function InlineMathRenderer({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const parts = useMemo(() => parseInlineMath(text), [text])

  if (parts.length === 0) return null
  if (parts.length === 1 && parts[0].kind === "text") {
    return <span className={className}>{text}</span>
  }

  return (
    <span className={className}>
      {parts.map((p, i) => {
        if (p.kind === "text") return <span key={i}>{p.value}</span>
        const html = renderKatexCached(p.value.trim(), false)
        return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />
      })}
    </span>
  )
})

/**
 * Formats a text snippet for compact single-line previews (e.g. in selection bars or tooltips),
 * normalizing whitespace and preventing awkward cuts inside inline math ($...$ or \\(...\\)).
 */
export function formatPreviewSnippet(
  text: string,
  maxLength = 85
): { snippet: string; isTruncated: boolean } {
  if (!text) return { snippet: "", isTruncated: false }

  const clean = text.replace(/^["'`„“”’‘»«]+|["'`„“”’‘»«]+$/g, "").trim()
  const normalized = clean.replace(/\s+/g, " ")

  if (normalized.length <= maxLength) {
    return { snippet: normalized, isTruncated: false }
  }

  let snippet = normalized.slice(0, maxLength)

  // 1. Handle unclosed $...$
  const dollarMatches = snippet.match(/(?<!\\)\$/g) || []
  if (dollarMatches.length % 2 !== 0) {
    const nextDollar = normalized.indexOf("$", maxLength)
    if (nextDollar !== -1 && nextDollar - maxLength < 35) {
      snippet = normalized.slice(0, nextDollar + 1)
    } else {
      const lastDollar = snippet.lastIndexOf("$")
      if (lastDollar > 15) {
        snippet = snippet.slice(0, lastDollar).trim()
      } else {
        snippet += "$"
      }
    }
  }

  // 2. Handle unclosed \\( ... \\)
  const openParenCount = (snippet.match(/\\\(/g) || []).length
  const closeParenCount = (snippet.match(/\\\)/g) || []).length
  if (openParenCount > closeParenCount) {
    const nextClose = normalized.indexOf("\\)", maxLength)
    if (nextClose !== -1 && nextClose - maxLength < 35) {
      snippet = normalized.slice(0, nextClose + 2)
    } else {
      const lastOpen = snippet.lastIndexOf("\\(")
      if (lastOpen > 15) {
        snippet = snippet.slice(0, lastOpen).trim()
      } else {
        snippet += "\\)"
      }
    }
  }

  return { snippet, isTruncated: true }
}

function isHeaderRow(row: string[]): boolean {
  if (!row || row.length === 0) return false
  const text = row.join(" ").toLowerCase()

  const headerWords = [
    "fit", "experiment", "xperiment", "parameter", "param", "gaussian", "exponential",
    "lévy", "levy", "sample", "function", "pairs", "collision", "colliding", "value",
    "ratio", "multiplicity", "energy", "dataset", "detector", "ndf", "bins", "source"
  ]
  for (const w of headerWords) {
    if (text.includes(w)) return true
  }

  // Brackets with units like [GeV], [fm], [MeV], [%]
  if (/\[(?:gev|mev|tev|fm|%|rad|deg)\]/i.test(text)) {
    return true
  }

  // If none of the cells contain numbers with decimal points or \pm, but contain text labels
  const hasNumbers = /\d+\.\d+|\d+\s*\\pm|\d+\s*±/.test(text)
  if (!hasNumbers && row.every((c) => c.length > 0 && !/^\d+$/.test(c))) {
    return true
  }

  return false
}

function alignTableRow(row: string[], maxCols: number): string[] {
  if (row.length >= maxCols) return row.slice(0, maxCols)
  const copy = [...row]
  const lastItem = copy[copy.length - 1] || ""

  // If the last item looks like a measurement (contains \pm, ±, decimals, or slash counts like 5932/95):
  // missing columns are leading columns (e.g. repeated experiment name/energy omitted in the paper)
  const isLastMeasurement = /\d+\.\d+|\\pm|±|\d+\s*\/|\d+/.test(lastItem)
  if (isLastMeasurement) {
    while (copy.length < maxCols) {
      copy.unshift("")
    }
  } else {
    while (copy.length < maxCols) {
      copy.push("")
    }
  }
  return copy
}

/**
 * Parses tables from raw text:
 * 1. Markdown tables with pipes (| col | col |)
 * 2. LaTeX tabular format (& separated)
 * 3. Space-delimited / Tab-separated text tables (e.g. 2+ spaces or \t separating columns)
 */
export function parseTableFromText(text: string): { headers: string[]; rows: string[][] } | null {
  if (!text || text.trim().length < 5) return null

  // Strip outer quotation marks and common prefixes
  let cleanText = text
    .trim()
    .replace(/^["'`„“”’‘»«]+|["'`„“”’‘»«]+$/g, "")
    .replace(/^(?:renderuj|renderovanie|tabulka|table|dôkaz|dokaz)\s*:\s*/i, "")
    .replace(/^(?:renderuj|renderovanie)\s+/i, "")
    .trim()

  // 1. Pipe-separated Markdown table
  if (cleanText.includes("|")) {
    const normalized = cleanText.replace(/\|\s*\|\s*/g, "|\n|").trim()
    const rawLines = normalized.split("\n").map((l) => l.trim()).filter(Boolean)
    const tableLines = rawLines.filter((l) => l.startsWith("|") && l.endsWith("|"))

    if (tableLines.length >= 2) {
      const dividerIdx = tableLines.findIndex((l) => /^\|(?:\s*:?-+:?\s*\|)+$/.test(l))
      const parsePipeRow = (line: string): string[] => {
        const inner = line.replace(/^\|/, "").replace(/\|$/, "")
        return inner.split("|").map((cell) => cell.trim())
      }

      if (dividerIdx > 0) {
        const headers = parsePipeRow(tableLines[0])
        const dataRows = tableLines
          .slice(dividerIdx + 1)
          .map(parsePipeRow)
          .filter((r) => r.length > 0 && !r.every((c) => /^:?-+:?$/.test(c)))
        if (headers.length > 0 && dataRows.length > 0) {
          return { headers, rows: dataRows }
        }
      } else {
        const allRows = tableLines.map(parsePipeRow).filter((r) => r.length >= 2)
        if (allRows.length >= 2) {
          return { headers: allRows[0], rows: allRows.slice(1) }
        }
      }
    }
  }

  // 2. LaTeX tabular (& separated)
  if (cleanText.includes("&")) {
    const rawLines = cleanText.split("\n").map((l) => l.trim()).filter(Boolean)
    const ampLines = rawLines.filter((l) => l.includes("&"))
    if (ampLines.length >= 2) {
      const rows = ampLines
        .map((line) => {
          const cleanLine = line.replace(/\\\\.*$/, "").trim()
          return cleanLine.split("&").map((c) => c.trim())
        })
        .filter((r) => r.length >= 2)

      if (rows.length >= 2) {
        return { headers: rows[0], rows: rows.slice(1) }
      }
    }
  }

  // 3. Multi-space (2+ spaces) or Tab-separated table (e.g. ASCII / OCR aligned table)
  const rawLines = cleanText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (rawLines.length >= 2) {
    const parsedRows = rawLines.map((line) => {
      return line.split(/\t+|\s{2,}/).map((c) => c.trim()).filter(Boolean)
    })

    const multiColRows = parsedRows.filter((r) => r.length >= 2)
    // If at least 60% of lines have multiple columns
    if (multiColRows.length >= 2 && multiColRows.length >= Math.ceil(rawLines.length * 0.6)) {
      const colCounts = multiColRows.map((r) => r.length)
      const maxCols = Math.max(...colCounts)
      if (maxCols >= 2) {
        const firstIsHeader = isHeaderRow(multiColRows[0])
        let headers: string[] = []
        let rawDataRows: string[][] = []

        if (firstIsHeader) {
          headers = alignTableRow(multiColRows[0], maxCols)
          rawDataRows = multiColRows.slice(1)
        } else {
          rawDataRows = multiColRows
        }

        const normalizedRows = rawDataRows.map((r) => alignTableRow(r, maxCols))

        return {
          headers,
          rows: normalizedRows,
        }
      }
    }
  }

  return null
}

export const EvidenceQuoteViewer = React.memo(function EvidenceQuoteViewer({
  quote,
  className = "",
  maxTableRows = 6,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false)

  // 1. Check if the quote is a table (pipe, LaTeX, or space/tab separated)
  const tableData = useMemo(() => parseTableFromText(quote), [quote])

  if (tableData) {
    const { headers, rows } = tableData
    const visibleRows = isExpanded ? rows : rows.slice(0, maxTableRows)
    const canToggle = rows.length > maxTableRows

    return (
      <div className="my-1.5 overflow-hidden rounded-lg border border-border/80 bg-card/80 shadow-2xs">
        <div className="overflow-x-auto max-w-full">
          <table className="w-full text-[10px] text-left border-collapse">
            {headers.length > 0 && (
              <thead className="bg-muted/70 text-foreground font-semibold border-b border-border/70">
                <tr>
                  {headers.map((h, i) => (
                    <th
                      key={i}
                      className="px-2.5 py-1.5 border-r border-border/30 last:border-r-0 whitespace-nowrap"
                    >
                      <InlineMathRenderer text={h} />
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody className="divide-y divide-border/30">
              {visibleRows.map((row, ri) => (
                <tr key={ri} className="hover:bg-muted/30 transition-colors even:bg-muted/10">
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className={`px-2.5 py-1 border-r border-border/20 last:border-r-0 whitespace-nowrap text-foreground/90 ${
                        headers.length === 0 && ci === 0
                          ? "font-semibold text-foreground bg-muted/25"
                          : headers.length > 0 && ci === 0 && cell
                          ? "font-medium text-foreground"
                          : ""
                      }`}
                    >
                      {cell ? <InlineMathRenderer text={cell} /> : <span className="text-muted-foreground/30">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canToggle && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setIsExpanded((prev) => !prev)
            }}
            className="w-full px-2 py-1 text-[9px] font-medium text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-muted/60 border-t border-border/40 flex items-center justify-center gap-1 transition-colors cursor-pointer"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-3 w-3 text-primary" />
                Zobraziť menej
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 text-primary" />
                Zobraziť celú tabuľku ({rows.length} riadkov)
              </>
            )}
          </button>
        )}
      </div>
    )
  }

  // 2. Check if display math ($$...$$ or \[...\])
  const displayMathMatch = quote.trim().match(/^\$\$([\s\S]+)\$\$$|^\\\[([\s\S]+)\\\]$/)
  if (displayMathMatch) {
    const formula = (displayMathMatch[1] || displayMathMatch[2] || "").trim()
    const html = renderKatexCached(formula, true)
    return (
      <div
        className="my-1 overflow-x-auto rounded-lg border border-border/60 bg-muted/20 px-2 py-1.5 text-center text-foreground [&_.katex-display]:my-0 select-all"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }

  // 3. Regular text with possible inline math formulas
  return (
    <p className={className}>
      &ldquo;<InlineMathRenderer text={quote.replace(/^["'`„“”’‘»«]+|["'`„“”’‘»«]+$/g, "").trim()} />&rdquo;
    </p>
  )
})
