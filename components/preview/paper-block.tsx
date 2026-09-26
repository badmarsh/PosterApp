"use client"

import { memo, useEffect, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import "katex/dist/katex.min.css"
import type { BibEntry } from "@/lib/bib-types"
import { cn } from "@/lib/utils"
import type { PaperBlock, PaperGeometry } from "@/lib/preview/paper-layout"

// ---------------------------------------------------------------------------
// Shared prose renderer
// ---------------------------------------------------------------------------

/**
 * Markdown + KaTeX with paper typography. Kept deliberately close to
 * `parseMarkdownToLatex` in what it understands: paragraphs, bullet lists,
 * `**bold**`, `*italic*`, inline/display math and `[text](url)` links. Styling
 * is expressed in `em` so the canvas can scale a block by changing only the
 * root font size.
 */
export const PaperProse = memo(function PaperProse({
  markdown,
  className,
  dropCapFirst,
}: {
  markdown: string
  className?: string
  dropCapFirst?: boolean
}) {
  const text = markdown.replace(/\\cite\{([^}]+)\}/g, "[$1]").replace(/\\ref\{([^}]+)\}/g, "$1")
  return (
    <div
      className={cn(
        "paper-prose",
        "[&_p]:mb-[0.55em] [&_p]:mt-0 [&_p:last-child]:mb-0",
        "[&_strong]:font-semibold [&_a]:text-[#1a4f9c] [&_a]:underline [&_a]:decoration-dotted",
        "[&_code]:rounded [&_code]:bg-black/5 [&_code]:px-[0.25em] [&_code]:font-mono [&_code]:text-[0.88em]",
        "[&_ul]:my-[0.35em] [&_ul]:list-disc [&_ul]:pl-[1.1em] [&_ol]:my-[0.35em] [&_ol]:list-decimal [&_ol]:pl-[1.3em]",
        "[&_li]:mb-[0.2em] [&_li]:pl-[0.1em]",
        "[&_.katex-display]:my-[0.5em] [&_.katex]:text-[1em]",
        dropCapFirst && "[&>p:first-child]:first-letter:float-left [&>p:first-child]:first-letter:mr-[0.06em] [&>p:first-child]:first-letter:text-[2.6em] [&>p:first-child]:first-letter:leading-[0.85]",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false, trust: false, output: "html" }]]}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
})

// ---------------------------------------------------------------------------
// Figures
// ---------------------------------------------------------------------------

function FigureImage({ url, className }: { url: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [url])

  if (!url || failed) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-[0.25em] bg-black/[0.04] text-black/35", className)}>
        <svg viewBox="0 0 24 24" className="h-[1.6em] w-[1.6em]" fill="none" stroke="currentColor" strokeWidth={1.4} aria-hidden>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="9" cy="10" r="1.6" />
          <path d="M4 18l5-5 3.5 3.5L16 13l4 4" />
        </svg>
        <span className="text-[0.62em] uppercase tracking-wide">figure unavailable</span>
      </div>
    )
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" loading="lazy" onError={() => setFailed(true)} className={cn("object-contain", className)} />
}

const PaperFigure = memo(function PaperFigure({ block }: { block: PaperBlock }) {
  const caption = (block.caption ?? "").replace(/^\s*(Figure|Fig\.?)\s*\d*\s*:?\s*/i, "")
  return (
    <figure className="my-[0.4em]">
      <div className="flex items-start justify-center gap-[0.5em]">
        <FigureImage url={block.url ?? ""} className="w-full" />
        {block.alt ? <FigureImage url={block.alt} className="w-full" /> : null}
      </div>
      {(caption || block.number) && (
        <figcaption className="mt-[0.35em] text-[0.82em] leading-[1.3] text-black/80">
          <span className="font-semibold">Figure {block.number}.</span> {caption}
          {block.continues ? <span className="italic"> (continued)</span> : null}
        </figcaption>
      )}
    </figure>
  )
})

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

const PaperTable = memo(function PaperTable({ block }: { block: PaperBlock }) {
  const rows = block.rows ?? []
  if (!rows.length) return null
  const header = block.hasHeader ? rows[0] : null
  const body = block.hasHeader ? rows.slice(1) : rows
  const caption = (block.caption ?? "").replace(/^\s*(Table)\s*\d*\s*:?\s*/i, "")

  return (
    <figure className="my-[0.5em]">
      {caption && block.number !== undefined && (
        <figcaption className="mb-[0.3em] text-center text-[0.82em] leading-[1.3] text-black/80">
          <span className="font-semibold">Table {block.number}.</span> {caption}
        </figcaption>
      )}
      <table className="w-full border-collapse text-[0.86em] tabular-nums">
        {header && (
          <thead>
            <tr className="border-b border-black/70 border-t-2 border-t-black">
              {header.map((cell, i) => (
                <th key={i} className="px-[0.35em] py-[0.22em] text-left font-semibold">
                  <PaperProse markdown={cell} className="[&_p]:mb-0" />
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody className={cn(!header && "border-t-2 border-t-black")}>
          {body.map((row, r) => (
            <tr key={r} className={cn("border-b border-black/15", r === body.length - 1 && "border-b-2 border-b-black")}>
              {row.map((cell, c) => (
                <td key={c} className="px-[0.35em] py-[0.22em] align-top">
                  <PaperProse markdown={cell} className="[&_p]:mb-0" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {block.continues && <div className="mt-[0.2em] text-[0.75em] italic text-black/60">continued on next column</div>}
    </figure>
  )
})

// ---------------------------------------------------------------------------
// References
// ---------------------------------------------------------------------------

function formatReference(entry: BibEntry, index: number): string {
  const authors = entry.authors?.length ? entry.authors.join(", ") : "Anonymous"
  const bits = [authors, entry.title, entry.journal, entry.year].filter(Boolean)
  const doi = entry.doi ? ` doi:${entry.doi}` : ""
  return `${bits.join(". ")}.${doi}`.replace(/\.\./g, ".").replace(/^\s*\[?\d+\]?\s*/, "")
}

const PaperReferences = memo(function PaperReferences({ block }: { block: PaperBlock }) {
  const entries = block.entries ?? []
  const start = block.split?.part === 2 ? undefined : 1
  return (
    <div className="my-[0.3em]">
      <ol className="space-y-[0.22em] text-[0.82em] leading-[1.25]">
        {entries.map((entry, i) => (
          <li key={entry.id} className="flex gap-[0.4em]">
            <span className="shrink-0 tabular-nums text-black/70">[{typeof start === "number" ? i + 1 : entry.id}]</span>
            <span>
              <PaperProse markdown={formatReference(entry, i)} className="[&_p]:mb-0 [&_p]:inline" />
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
})

// ---------------------------------------------------------------------------
// Headings / title / abstract
// ---------------------------------------------------------------------------

const PaperHeading = memo(function PaperHeading({ block }: { block: PaperBlock }) {
  const label = block.number !== undefined ? `${block.number}. ${block.text ?? ""}` : block.text ?? ""
  if (block.level === 2) {
    return (
      <h3 className="mb-[0.25em] mt-[0.55em] text-[1.02em] font-bold italic">
        <PaperProse markdown={label} className="[&_p]:mb-0" />
      </h3>
    )
  }
  return (
    <h2 className="mb-[0.25em] mt-[0.6em] text-[1.06em] font-bold uppercase tracking-[0.02em]">
      <PaperProse markdown={label} className="[&_p]:mb-0" />
    </h2>
  )
})

export const PaperTitleBlock = memo(function PaperTitleBlock({
  title,
  authors,
  venue,
  abstract,
  accent,
  abstractLabel,
}: {
  title: string
  authors: string
  venue: string
  abstract?: string
  accent: string
  abstractLabel: string
}) {
  return (
    <header className="mb-[0.6em] text-center">
      <h1 className="text-[1.75em] font-bold leading-[1.12] text-black">
        <PaperProse markdown={title} className="[&_p]:mb-0" />
      </h1>
      {authors && (
        <div className="mt-[0.45em] text-[1.02em] leading-[1.25] text-black/90">
          <PaperProse markdown={authors} className="[&_p]:mb-0" />
        </div>
      )}
      {venue && (
        <div className="mt-[0.2em] text-[0.9em] italic text-black/70">
          <PaperProse markdown={venue} className="[&_p]:mb-0" />
        </div>
      )}
      <div className="mx-auto mt-[0.5em] h-[2px] w-[38%] rounded-full" style={{ background: accent }} aria-hidden />
      {abstract ? (
        <div className="mx-auto mt-[0.6em] max-w-[86%] text-left">
          <div className="mb-[0.25em] text-center text-[0.95em] font-bold uppercase tracking-[0.12em]" style={{ color: accent }}>
            {abstractLabel}
          </div>
          <div className="text-[0.92em] leading-[1.35] text-black/90">
            <PaperProse markdown={abstract} />
          </div>
        </div>
      ) : null}
    </header>
  )
})

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

/**
 * One rendered block. `geometry` only matters for the measurement pass (the
 * canvas applies the measured pixel height explicitly), which keeps the probe
 * and the final render byte-for-byte identical.
 */
export const PaperBlockView = memo(function PaperBlockView({
  block,
  geometry,
  accent,
  showGuides,
  interactive,
  selected,
  onSelect,
  onEdit,
}: {
  block: PaperBlock
  geometry: PaperGeometry
  accent: string
  showGuides?: boolean
  interactive?: boolean
  selected?: boolean
  onSelect?: () => void
  onEdit?: () => void
}) {
  const body = (() => {
    switch (block.kind) {
      case "heading":
        return <PaperHeading block={block} />
      case "paragraph":
        return <PaperProse markdown={block.text ?? ""} dropCapFirst={block.split?.part !== 2 && block.continues !== true && block.id.includes("#p0")} />
      case "bullets":
        return <PaperProse markdown={(block.items ?? []).map((i) => `- ${i}`).join("\n")} />
      case "equation":
        return (
          <div className="my-[0.45em] text-center">
            <PaperProse markdown={`$$${block.text ?? ""}$$`} />
          </div>
        )
      case "figure":
        return <PaperFigure block={block} />
      case "table":
        return <PaperTable block={block} />
      case "references":
        return <PaperReferences block={block} />
      case "abstract":
        return (
          <div>
            <div className="mb-[0.2em] text-center text-[0.95em] font-bold uppercase tracking-[0.1em]" style={{ color: accent }}>
              Abstract
            </div>
            <PaperProse markdown={block.text ?? ""} className="text-[0.93em] leading-[1.35]" />
          </div>
        )
      case "title":
        return null
      default:
        return null
    }
  })()

  if (!body) return null

  return (
    <div
      data-paper-block={block.id}
      data-card-id={block.cardId}
      onClick={interactive ? onSelect : undefined}
      onDoubleClick={interactive && onEdit ? onEdit : undefined}
      className={cn(
        "relative transition-shadow",
        interactive && "cursor-pointer",
        showGuides && "outline outline-1 outline-dashed outline-sky-400/30",
        selected && "outline outline-2 outline-offset-[2px] outline-sky-500/70",
        block.continues && block.split?.part === 2 && "-mt-[0.15em]",
      )}
      title={interactive ? `${block.kind} · ${block.cardId}` : undefined}
    >
      {body}
    </div>
  )
})
