"use client"

/**
 * SourceMarkdownView — renders MinerU-extracted manuscript markdown with:
 *  1. Real math typesetting (KaTeX via remark-math/rehype-katex) for inline and block equations.
 *  2. Rich responsive tables (both GFM markdown tables and MinerU raw HTML <table>).
 *  3. Real manuscript figures, diagrams, and image assets resolved from /api/workspaces/[id]/assets/.
 *  4. Interactive image lightbox zoom & open in new tab.
 *  5. Subscripts (<sub>), superscripts (<sup>), and synchronized evidence/query highlighting.
 */

import React, { useEffect, useState, useMemo, useRef, useCallback } from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkMath from "remark-math"
import remarkGfm from "remark-gfm"
import rehypeKaTeX from "rehype-katex"
import rehypeRaw from "rehype-raw"
import rehypeSanitize from "rehype-sanitize"
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

export interface MarkdownChunk {
  id: string
  heading?: string
  rawText: string
}

/**
 * Splits manuscript markdown into logical section chunks (by headings or paragraph breaks)
 * while preserving atomic blocks: display math ($$...$$), code blocks (```), and HTML tables.
 */
export function chunkManuscriptMarkdown(
  markdown: string,
  maxChunkChars = 12000
): MarkdownChunk[] {
  if (!markdown || !markdown.trim()) return []

  const lines = markdown.split(/\r?\n/)
  const chunks: MarkdownChunk[] = []

  let currentLines: string[] = []
  let currentHeading: string | undefined = undefined
  let inCodeBlock = false
  let inMathBlock = false
  let inTableBlock = false
  let chunkIndex = 0

  const flushChunk = () => {
    const text = currentLines.join("\n").trim()
    if (text) {
      chunks.push({
        id: `chunk-${chunkIndex++}`,
        heading: currentHeading,
        rawText: text,
      })
    }
    currentLines = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Track fenced code blocks ``` or ~~~
    if (/^(```|~~~)/.test(trimmed)) {
      inCodeBlock = !inCodeBlock
    }

    // Track $$ display math blocks
    if (/^\$\$/.test(trimmed)) {
      if (trimmed === "$$") {
        inMathBlock = !inMathBlock
      } else if (trimmed.length > 2 && trimmed.endsWith("$$")) {
        // Single-line $$ ... $$
      } else {
        inMathBlock = !inMathBlock
      }
    }

    // Track HTML table blocks
    if (/<table\b/i.test(trimmed)) inTableBlock = true
    if (/<\/table>/i.test(trimmed)) inTableBlock = false

    const isSafeBoundary = !inCodeBlock && !inMathBlock && !inTableBlock

    // Split on Markdown headings (# Heading, ## Heading, ### Heading)
    const isHeading = isSafeBoundary && /^#{1,4}\s+(.+)$/.test(line)

    // Split on large size if empty line / paragraph break
    const currentLength = currentLines.reduce((acc, l) => acc + l.length + 1, 0)
    const isSizeOverflow = isSafeBoundary && currentLength >= maxChunkChars && trimmed === ""

    if ((isHeading && currentLines.length > 0) || isSizeOverflow) {
      flushChunk()
      if (isHeading) {
        const match = line.match(/^#{1,4}\s+(.+)$/)
        currentHeading = match ? match[1].trim() : undefined
      } else {
        currentHeading = undefined
      }
    } else if (isHeading && currentLines.length === 0) {
      const match = line.match(/^#{1,4}\s+(.+)$/)
      currentHeading = match ? match[1].trim() : undefined
    }

    currentLines.push(line)
  }

  flushChunk()

  if (chunks.length === 0 && markdown.trim()) {
    return [{ id: "chunk-0", rawText: markdown.trim() }]
  }

  return chunks
}

interface MarkdownSectionChunkProps {
  chunk: MarkdownChunk
  components: Components
  isVisible: boolean
  onIntersect: (id: string) => void
}

const MarkdownSectionChunk = React.memo(function MarkdownSectionChunk({
  chunk,
  components,
  isVisible,
  onIntersect,
}: MarkdownSectionChunkProps) {
  const placeholderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isVisible) return
    const el = placeholderRef.current
    if (!el || typeof IntersectionObserver === "undefined") return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onIntersect(chunk.id)
        }
      },
      { rootMargin: "600px 0px" }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [isVisible, chunk.id, onIntersect])

  if (!isVisible) {
    return (
      <div
        ref={placeholderRef}
        data-chunk-id={chunk.id}
        className="my-3 p-3.5 rounded-xl border border-dashed border-border/40 bg-muted/10 min-h-[80px] flex items-center justify-between text-muted-foreground transition-all"
      >
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
          <span className="text-xs font-medium text-foreground/75 truncate">
            {chunk.heading || "Sekcia rukopisu"}
          </span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground/70 shrink-0 ml-2">
          ~{Math.round(chunk.rawText.length / 5)} slov
        </span>
      </div>
    )
  }

  return (
    <div
      data-chunk-id={chunk.id}
      className="markdown-chunk-rendered"
      style={{ contentVisibility: "auto", containIntrinsicSize: "0 350px" }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          rehypeRaw,
          rehypeSanitize,
          [rehypeKaTeX, { throwOnError: false, strict: false, trust: false }],
        ]}
        components={components}
      >
        {chunk.rawText}
      </ReactMarkdown>
    </div>
  )
})

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
  const cleanMarkdown = useMemo(() => preprocessMathAndHtml(markdown), [markdown])
  const chunks = useMemo(() => chunkManuscriptMarkdown(cleanMarkdown), [cleanMarkdown])

  // Initialize first 3 chunks (or all if doc is small)
  const [visibleChunkIds, setVisibleChunkIds] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    const isSmall = cleanMarkdown.length <= 25_000
    for (let i = 0; i < chunks.length; i++) {
      if (isSmall || i < 3) {
        initial.add(chunks[i].id)
      }
    }
    return initial
  })

  // Reset when source text changes completely
  useEffect(() => {
    const isSmall = cleanMarkdown.length <= 25_000
    const initial = new Set<string>()
    for (let i = 0; i < chunks.length; i++) {
      if (isSmall || i < 3) {
        initial.add(chunks[i].id)
      }
    }
    setVisibleChunkIds(initial)
  }, [cleanMarkdown, chunks])

  const handleIntersect = useCallback((id: string) => {
    setVisibleChunkIds((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  // Idle progressive loader to reveal off-screen chunks in background without blocking UI
  useEffect(() => {
    if (visibleChunkIds.size >= chunks.length) return

    let cancelled = false
    let timerId: ReturnType<typeof setTimeout> | null = null
    let idleHandle: number | null = null

    const scheduleNext = () => {
      if (cancelled) return
      if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        idleHandle = (window as any).requestIdleCallback(renderNextBatch, { timeout: 200 })
      } else {
        timerId = setTimeout(renderNextBatch, 80)
      }
    }

    const renderNextBatch = () => {
      if (cancelled) return
      setVisibleChunkIds((prev) => {
        if (prev.size >= chunks.length) return prev
        const next = new Set(prev)
        let added = 0
        for (const chunk of chunks) {
          if (!next.has(chunk.id)) {
            next.add(chunk.id)
            added++
            if (added >= 2) break
          }
        }
        return next
      })
      scheduleNext()
    }

    scheduleNext()

    return () => {
      cancelled = true
      if (timerId) clearTimeout(timerId)
      if (idleHandle && typeof window !== "undefined" && "cancelIdleCallback" in window) {
        (window as any).cancelIdleCallback(idleHandle)
      }
    }
  }, [chunks, visibleChunkIds.size])

  // Immediately reveal chunk matching active quote
  useEffect(() => {
    if (!highlightQuote || highlightQuote.trim().length < 4) return
    const normQuote = highlightQuote.toLowerCase().trim()
    const targetChunk = chunks.find((c) => c.rawText.toLowerCase().includes(normQuote))
    if (targetChunk) {
      setVisibleChunkIds((prev) => {
        if (prev.has(targetChunk.id)) return prev
        const next = new Set(prev)
        next.add(targetChunk.id)
        return next
      })
    }
  }, [highlightQuote, chunks])

  // Immediately reveal chunks matching search query
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 3) return
    const normQ = searchQuery.toLowerCase().trim()
    const matching = chunks.filter((c) => c.rawText.toLowerCase().includes(normQ))
    if (matching.length > 0) {
      setVisibleChunkIds((prev) => {
        let changed = false
        const next = new Set(prev)
        for (const m of matching) {
          if (!next.has(m.id)) {
            next.add(m.id)
            changed = true
          }
        }
        return changed ? next : prev
      })
    }
  }, [searchQuery, chunks])

  // Immediately reveal chunk on source jump event
  useEffect(() => {
    const handleSourceJump = (e: Event) => {
      const detail = (e as CustomEvent<{ quote?: string; sectionHeading?: string }>).detail
      if (!detail) return
      const targetText = (detail.quote || detail.sectionHeading || "").toLowerCase().trim()
      if (targetText.length < 4) return

      const target = chunks.find(
        (c) =>
          c.rawText.toLowerCase().includes(targetText) ||
          (c.heading && c.heading.toLowerCase().includes(targetText))
      )
      if (target) {
        setVisibleChunkIds((prev) => {
          if (prev.has(target.id)) return prev
          const next = new Set(prev)
          next.add(target.id)
          return next
        })
      }
    }
    window.addEventListener("posterapp:source-jump", handleSourceJump)
    return () => window.removeEventListener("posterapp:source-jump", handleSourceJump)
  }, [chunks])

  const components = useMemo<Components>(
    () => ({
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
    [workspaceId]
  )

  return (
    <div className="source-markdown-view text-sm sm:text-sm [&_.katex]:text-foreground/90 [&_.katex]:font-normal space-y-3">
      {chunks.map((chunk) => (
        <MarkdownSectionChunk
          key={chunk.id}
          chunk={chunk}
          components={components}
          isVisible={visibleChunkIds.has(chunk.id)}
          onIntersect={handleIntersect}
        />
      ))}
    </div>
  )
}
