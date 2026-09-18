"use client"

/**
 * SourceMarkdownView — renders MinerU-extracted manuscript markdown with:
 *  1. Real math typesetting (KaTeX via remark-math/rehype-katex) for inline and block equations.
 *  2. Rich responsive tables (both GFM markdown tables and MinerU raw HTML <table>).
 *  3. Real manuscript figures, diagrams, and image assets resolved from /api/workspaces/[id]/assets/.
 *  4. Interactive image lightbox zoom & open in new tab.
 *  5. Subscripts (<sub>), superscripts (<sup>), and synchronized evidence/query highlighting.
 */

import React, { useEffect, useState, useMemo } from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkMath from "remark-math"
import remarkGfm from "remark-gfm"
import rehypeKaTeX from "rehype-katex"
import rehypeRaw from "rehype-raw"
import "katex/dist/katex.min.css"
import {
  ExternalLink,
  ZoomIn,
  X,
  Image as ImageIcon,
  AlertCircle,
  FileText,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export function normalizeStr(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase()
}

/**
 * Resolves relative or raw MinerU image paths (e.g. `images/zaverecna_praca_figure_1.jpg`)
 * to the correct workspace asset API endpoint (`/api/workspaces/[id]/assets/[filename]`).
 */
export function resolveManuscriptAssetUrl(
  src: string | undefined,
  workspaceId: string | undefined
): string {
  if (!src) return ""
  if (
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("data:") ||
    src.startsWith("/api/workspaces/")
  ) {
    return src
  }
  // Strip any leading path components like "images/", "./images/", "assets/"
  const filename = src.split(/[/\\]/).pop() || src
  if (workspaceId) {
    return `/api/workspaces/${encodeURIComponent(workspaceId)}/assets/${encodeURIComponent(filename)}`
  }
  return src
}

/**
 * Preprocesses manuscript markdown to ensure KaTeX and table parsers handle
 * MinerU OCR output quirks (e.g. `\[ ... \]`, `\( ... \)`, and tight math blocks).
 */
export function preprocessMathAndHtml(markdown: string): string {
  if (!markdown) return ""

  // 1. Convert LaTeX display brackets \[ ... \] to CommonMark $$ ... $$
  let processed = markdown.replace(/\\\[([\s\S]*?)\\\]/g, (_, p1) => `\n\n$$\n${p1.trim()}\n$$\n\n`)

  // 2. Convert LaTeX inline brackets \( ... \) to CommonMark $ ... $
  processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (_, p1) => `$${p1.trim()}$`)

  // 3. Ensure $$ block equations are separated by empty lines so remark-math parses them as blocks
  processed = processed.replace(/([^\n])\n\$\$([^\$]+)\$\$\n([^\n])/g, (_, p1, p2, p3) => `${p1}\n\n$$\n${p2.trim()}\n$$\n\n${p3}`)

  return processed
}

/** Highlight every normalized match of `needle` in a rendered text node. */
function highlightInText(text: string, needle: string | undefined): React.ReactNode {
  if (!needle) return text
  const normNeedle = normalizeStr(needle)
  if (normNeedle.length < 3) return text
  const normText = normalizeStr(text)
  const idx = normText.indexOf(normNeedle)
  if (idx === -1) return text

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

/** Stateful manuscript image component with zoom lightbox and fallback */
function ManuscriptImage({
  src,
  alt,
  workspaceId,
}: {
  src?: string
  alt?: string
  workspaceId?: string
}) {
  const [hasError, setHasError] = useState(false)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)

  const resolvedUrl = resolveManuscriptAssetUrl(src, workspaceId)
  const altText = alt || ""
  const filename = src ? src.split(/[/\\]/).pop() || src : "image"

  if (hasError || !resolvedUrl) {
    return (
      <figure className="my-5 flex flex-col items-center justify-center p-4 rounded-xl bg-muted/20 border border-dashed border-border/80 text-center">
        <div className="flex items-center gap-2 text-muted-foreground text-xs font-mono">
          <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground/70" />
          <span className="truncate max-w-[280px]">{filename}</span>
        </div>
        {altText && altText !== "Figure" && (
          <figcaption className="text-xs text-foreground/85 mt-1 font-medium italic">
            {altText}
          </figcaption>
        )}
        <span className="text-[10px] text-muted-foreground mt-1.5 bg-muted/60 px-2 py-0.5 rounded-md">
          Obrázok nebol extrahovaný alebo sa nenachádza v úložisku
        </span>
      </figure>
    )
  }

  return (
    <>
      <figure className="my-6 flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-card border border-border/70 shadow-xs group transition-all">
        <div className="relative max-w-full flex justify-center items-center overflow-hidden rounded-xl bg-muted/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolvedUrl}
            alt={altText || filename}
            loading="lazy"
            onError={() => setHasError(true)}
            onClick={() => setIsLightboxOpen(true)}
            className="max-h-[520px] w-auto max-w-full rounded-xl object-contain border border-border/40 shadow-2xs transition-all duration-200 hover:scale-[1.01] cursor-zoom-in"
          />

          {/* Hover Action Overlay */}
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-background/85 backdrop-blur-xs p-1 rounded-lg border border-border/60 shadow-sm">
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              onClick={() => setIsLightboxOpen(true)}
              title="Zväčšiť obrázok"
              className="h-6 w-6 text-foreground hover:text-primary cursor-pointer"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <a
              href={resolvedUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Otvoriť v plnej veľkosti na novej karte"
              className="h-6 w-6 flex items-center justify-center text-foreground hover:text-primary rounded-md hover:bg-muted"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {/* Caption */}
        {altText && altText !== "Figure" && (
          <figcaption className="text-xs text-muted-foreground/90 mt-2.5 text-center max-w-2xl italic font-medium px-2">
            {altText}
          </figcaption>
        )}
      </figure>

      {/* Lightbox Modal */}
      {isLightboxOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 sm:p-8 animate-in fade-in duration-150"
          onClick={() => setIsLightboxOpen(false)}
        >
          <div
            className="relative max-w-5xl max-h-[92vh] flex flex-col items-center bg-card rounded-2xl border border-border p-2 sm:p-4 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-2 border-b px-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground truncate max-w-md">
                {altText || filename}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={resolvedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Pôvodná veľkosť
                </a>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => setIsLightboxOpen(false)}
                  className="h-6 w-6 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="overflow-auto p-2 max-h-[80vh] flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolvedUrl}
                alt={altText || filename}
                className="max-h-full max-w-full object-contain rounded-lg shadow-sm"
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

interface Props {
  markdown: string
  workspaceId?: string
  /** Evidence quote to highlight (whitespace-normalized matching). */
  highlightQuote?: string
  /** Free-text search query to highlight. */
  searchQuery?: string
}

export function SourceMarkdownView({
  markdown,
  workspaceId,
  highlightQuote,
  searchQuery,
}: Props) {
  const [jumpQuote, setJumpQuote] = useState<string | undefined>(undefined)
  useEffect(() => {
    const handleSourceJump = (event: Event) => {
      const detail = (event as CustomEvent<{ quote?: string }>).detail
      if (!detail?.quote) return
      setJumpQuote(detail.quote)
      window.setTimeout(() => {
        document.querySelector("[data-evidence-match]")?.scrollIntoView({ behavior: "smooth", block: "center" })
      }, 80)
    }
    window.addEventListener("posterapp:source-jump", handleSourceJump)
    return () => window.removeEventListener("posterapp:source-jump", handleSourceJump)
  }, [])

  const cleanMarkdown = useMemo(() => preprocessMathAndHtml(markdown), [markdown])
  const activeHighlight = jumpQuote || highlightQuote

  const components = useMemo<Components>(
    () => ({
      text: makeTextComponent(activeHighlight || searchQuery),
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
      p: ({ children }) => <div className="text-foreground/85 leading-relaxed my-2.5">{children}</div>,
      blockquote: ({ children }) => (
        <blockquote className="border-l-3 border-primary/60 bg-primary/5 pl-3.5 py-2 my-3 rounded-r-lg text-sm italic font-serif text-foreground/85">
          {children}
        </blockquote>
      ),
      ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1 text-foreground/85">{children}</ul>,
      ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-1 text-foreground/85">{children}</ol>,
      li: ({ children }) => <li className="leading-relaxed">{children}</li>,
      a: ({ href, children }) => (
        <a
          href={href}
          className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
          target="_blank"
          rel="noreferrer"
        >
          {children}
        </a>
      ),

      // Tables: handles both GFM Markdown tables and MinerU raw HTML <table> tags
      table: ({ children }) => (
        <div className="my-5 overflow-x-auto rounded-xl border border-border/70 bg-card/60 shadow-xs">
          <table className="w-full text-xs sm:text-sm text-left border-collapse">{children}</table>
        </div>
      ),
      thead: ({ children }) => (
        <thead className="bg-muted/70 text-foreground font-semibold border-b border-border/80">
          {children}
        </thead>
      ),
      th: ({ children }) => (
        <th className="px-3.5 py-2.5 font-bold text-foreground text-xs uppercase tracking-wider whitespace-nowrap border-r border-border/40 last:border-r-0">
          {children}
        </th>
      ),
      tbody: ({ children }) => <tbody className="divide-y divide-border/40">{children}</tbody>,
      tr: ({ children }) => (
        <tr className="hover:bg-muted/30 transition-colors even:bg-muted/10">{children}</tr>
      ),
      td: ({ children }) => (
        <td className="px-3.5 py-2 text-foreground/90 text-xs sm:text-sm align-top border-r border-border/30 last:border-r-0">
          {children}
        </td>
      ),
      caption: ({ children }) => (
        <caption className="text-xs text-muted-foreground font-medium py-2 px-3.5 text-left italic bg-muted/20 border-b border-border/40">
          {children}
        </caption>
      ),

      // Equations: format display math container with horizontal scrolling and card styling
      div: ({ className, children, ...rest }) => {
        if (typeof className === "string" && (className.includes("math-display") || className.includes("katex-display"))) {
          return (
            <div
              className="my-4 overflow-x-auto overflow-y-hidden py-3 px-4 rounded-xl bg-muted/20 border border-border/50 text-center shadow-2xs flex justify-center items-center [&_.katex-display]:my-0"
              {...rest}
            >
              {children}
            </div>
          )
        }
        return (
          <div className={className} {...rest}>
            {children}
          </div>
        )
      },

      span: ({ className, children, ...rest }) => {
        if (typeof className === "string" && className.includes("katex-display")) {
          return (
            <div className="my-4 overflow-x-auto overflow-y-hidden py-3 px-4 rounded-xl bg-muted/20 border border-border/50 text-center shadow-2xs flex justify-center items-center">
              <span className={className} {...rest}>
                {children}
              </span>
            </div>
          )
        }
        return (
          <span className={className} {...rest}>
            {children}
          </span>
        )
      },

      // Subscripts and Superscripts (supported via rehypeRaw)
      sub: ({ children }) => <sub className="text-[10px] font-normal align-sub">{children}</sub>,
      sup: ({ children }) => <sup className="text-[10px] font-normal align-super">{children}</sup>,

      // Images: full workspace asset resolution, zoom lightbox, and graceful fallback
      img: ({ src, alt }) => (
        <ManuscriptImage
          src={typeof src === "string" ? src : undefined}
          alt={typeof alt === "string" ? alt : undefined}
          workspaceId={workspaceId}
        />
      ),
    }),
    [activeHighlight, searchQuery, workspaceId]
  )

  return (
    <div className="source-markdown-view text-[13px] sm:text-sm [&_.katex]:text-foreground/90 [&_.katex]:font-normal">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, [rehypeKaTeX, { throwOnError: false, strict: false, trust: true }]]}
        components={components}
      >
        {cleanMarkdown}
      </ReactMarkdown>
    </div>
  )
}
