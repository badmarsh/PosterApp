"use client"

/**
 * SourceMarkdownView — renders MinerU-extracted manuscript markdown with real
 * math typesetting (KaTeX via remark-math/rehype-katex) and GFM tables, instead
 * of showing raw `$$…$$` / `$…$` LaTeX source and plain-text pipe rows.
 *
 * Also:
 *  - widens the readable column,
 *  - converts broken `![…](images/…jpg)` figure markers into captioned blocks,
 *  - supports evidence/query highlighting by walking rendered text nodes.
 */

import React, { useMemo } from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkMath from "remark-math"
import remarkGfm from "remark-gfm"
import rehypeKaTeX from "rehype-katex"
import "katex/dist/katex.min.css"

function normalizeStr(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase()
}

/** Highlight every normalized match of `needle` in a rendered text node. */
function highlightInText(text: string, needle: string | undefined): React.ReactNode {
  if (!needle) return text
  const normNeedle = normalizeStr(needle)
  if (normNeedle.length < 3) return text
  const normText = normalizeStr(text)
  const idx = normText.indexOf(normNeedle)
  if (idx === -1) return text
  // Map the normalized match back approximately onto the original text:
  // walk original chars (non-space) to find the matching span.
  const origChars = [...text]
  let normPos = 0
  let startOrig = -1
  let endOrig = -1
  for (let i = 0; i < origChars.length; i++) {
    if (/\s/.test(origChars[i])) continue
    if (normPos === idx && startOrig === -1) startOrig = i
    normPos++
    if (normPos === idx + normNeedle.length) {
      endOrig = i + 1
      break
    }
  }
  if (startOrig === -1 || endOrig === -1) return text
    return (
      <>
        {text.slice(0, startOrig)}
        <mark
          data-evidence-match="true"
          className="bg-primary/25 text-foreground border-b-2 border-primary font-medium rounded-md px-0.5"
        >
          {text.slice(startOrig, endOrig)}
        </mark>
        {text.slice(endOrig)}
      </>
    )
}

/** A text-node wrapper component that applies highlight across the rendered tree. */
function makeTextComponent(needle: string | undefined): Components["text"] {
  return function Text({ children }) {
    if (typeof children !== "string") return <>{children}</>
    const highlighted = highlightInText(children, needle)
    return <span>{highlighted}</span>
  }
}

interface Props {
  markdown: string
  /** Evidence quote to highlight (whitespace-normalized matching). */
  highlightQuote?: string
  /** Free-text search query to highlight. */
  searchQuery?: string
}

export function SourceMarkdownView({ markdown, highlightQuote, searchQuery }: Props) {
  const components = useMemo<Components>(
    () => ({
      text: makeTextComponent(highlightQuote || searchQuery),
      h1: ({ children }) => (
        <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight pt-6 pb-2 border-b-2 border-border/60">
          {children}
        </h1>
      ),
      h2: ({ children }) => (
        <h2 className="text-lg sm:text-xl font-bold text-foreground tracking-tight pt-5 pb-1.5 border-b border-border/50">
          {children}
        </h2>
      ),
      h3: ({ children }) => (
        <h3 className="text-sm sm:text-base font-bold text-foreground/95 pt-4">{children}</h3>
      ),
      h4: ({ children }) => (
        <h4 className="text-sm font-semibold text-foreground/90 pt-3">{children}</h4>
      ),
      p: ({ children }) => <p className="text-foreground/85 leading-relaxed my-2">{children}</p>,
      blockquote: ({ children }) => (
        <blockquote className="border-l-3 border-primary/60 bg-primary/5 pl-3.5 py-2 my-3 rounded-r-lg text-sm italic font-serif text-foreground/85">
          {children}
        </blockquote>
      ),
      ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1 text-foreground/85">{children}</ul>,
      ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-1 text-foreground/85">{children}</ol>,
      li: ({ children }) => <li className="leading-relaxed">{children}</li>,
      a: ({ href, children }) => (
        <a href={href} className="text-primary underline decoration-primary/40 underline-offset-2" target="_blank" rel="noreferrer">
          {children}
        </a>
      ),
      table: ({ children }) => (
        <div className="my-4 overflow-x-auto rounded-lg border border-border/70 bg-muted/20 p-1 shadow-sm">
          <table className="w-full text-[12px] sm:text-[13px] text-left border-collapse">{children}</table>
        </div>
      ),
      thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
      th: ({ children }) => (
        <th className="p-2 px-3 font-bold text-foreground border-b border-border/60 whitespace-nowrap">{children}</th>
      ),
      td: ({ children }) => (
        <td className="p-2 px-3 border-b border-border/30 align-top text-foreground/85">{children}</td>
      ),
      // Equations: KaTeX already renders; just make blocks scrollable on narrow screens.
      div: ({ className, children, ...rest }) => {
        if (typeof className === "string" && className.includes("math-display")) {
          return (
            <div className="my-4 overflow-x-auto overflow-y-hidden py-2 px-1 rounded-lg bg-muted/20 border border-border/40 [&_.katex-display]:my-0" {...rest}>
              {children}
            </div>
          )
        }
        return <div className={className} {...rest}>{children}</div>
      },
      img: ({ src, alt }) => {
        // MinerU figure markers point at image paths that are not served; show
        // the figure caption placeholder rather than a broken image icon.
        const altText = typeof alt === "string" ? alt : ""
        const srcText = typeof src === "string" ? src : ""
        return (
          <figure className="my-4 flex flex-col items-center justify-center p-3 rounded-lg bg-muted/10 border border-dashed border-border/60">
            <div className="text-muted-foreground/60 text-[11px] font-mono truncate max-w-full">🖼 {altText || srcText}</div>
            {altText && altText !== "Figure" && (
              <figcaption className="text-[11px] text-muted-foreground mt-1 font-medium">{altText}</figcaption>
            )}
          </figure>
        )
      },
    }),
    [highlightQuote, searchQuery]
  )

  return (
    <div className="source-markdown-view text-[13px] sm:text-sm [&_.katex]:text-foreground/90 [&_.katex]:font-normal">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKaTeX]}
        components={components}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
