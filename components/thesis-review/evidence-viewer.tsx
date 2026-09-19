"use client"

/**
 * EvidenceViewer — Master Document & Manuscript Viewer.
 *
 * Renders the full parsed manuscript text inside a paper-sheet canvas with realistic
 * elevation shadow, typography hierarchy, markdown table support, and auto-scrolling
 * synchronized evidence quote highlighting.
 */

import React, { useEffect, useRef, useState, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  FileText,
  Search,
  Highlighter,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  X,
  BookOpen,
  Quote,
} from "lucide-react"
import type { EvidenceReference } from "@/lib/ai/review-types"
import { formatDocumentDisplayName } from "@/lib/ingestion"
import { SourceMarkdownView } from "./source-markdown-view"
import {
  locateAndHighlightEvidence,
  highlightSearchQuery,
} from "@/lib/thesis-review/evidence-dom-locator"
import {
  InlineMathRenderer,
  formatPreviewSnippet,
  parseTableFromText,
} from "./evidence-quote-viewer"

interface Props {
  workspaceId: string
  sourceMarkdown?: string
  selectedEvidence: EvidenceReference | null
  isLoading?: boolean
  onAddFindingFromSelection?: (quote: string, sectionHeading?: string) => void
}

export const EvidenceViewer = React.memo(function EvidenceViewer({
  workspaceId,
  sourceMarkdown = "",
  selectedEvidence,
  isLoading = false,
  onAddFindingFromSelection,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedText, setSelectedText] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll and highlight the evidence match after rendering.
  useEffect(() => {
    if (!selectedEvidence?.quote || !containerRef.current) return

    let active = true
    let t2: ReturnType<typeof setTimeout> | null = null
    let t3: ReturnType<typeof setTimeout> | null = null

    const runLocate = () => {
      if (!active || !containerRef.current) return false
      const matched = locateAndHighlightEvidence(
        containerRef.current,
        selectedEvidence.quote,
        selectedEvidence.sectionHeading
      )
      if (matched) {
        if (t2) clearTimeout(t2)
        if (t3) clearTimeout(t3)
        return true
      }
      return false
    }

    // Try at staggered intervals only if earlier attempts failed to find the target element
    const t1 = setTimeout(() => {
      const found = runLocate()
      if (!found && active) {
        t2 = setTimeout(() => {
          const found2 = runLocate()
          if (!found2 && active) {
            t3 = setTimeout(runLocate, 400)
          }
        }, 150)
      }
    }, 50)

    return () => {
      active = false
      clearTimeout(t1)
      if (t2) clearTimeout(t2)
      if (t3) clearTimeout(t3)
    }
  }, [selectedEvidence?.quote, selectedEvidence?.sectionHeading, sourceMarkdown])

  // Listen to custom source-jump event
  useEffect(() => {
    const handleSourceJump = (event: Event) => {
      const detail = (event as CustomEvent<{ quote?: string; sectionHeading?: string }>).detail
      if (!detail?.quote || !containerRef.current) return
      locateAndHighlightEvidence(containerRef.current, detail.quote, detail.sectionHeading)
    }
    window.addEventListener("posterapp:source-jump", handleSourceJump)
    return () => window.removeEventListener("posterapp:source-jump", handleSourceJump)
  }, [])

  // Handle free-text search inside manuscript
  useEffect(() => {
    if (!containerRef.current) return
    const t = setTimeout(() => {
      if (containerRef.current) {
        highlightSearchQuery(containerRef.current, searchQuery)
      }
    }, 150)
    return () => clearTimeout(t)
  }, [searchQuery, sourceMarkdown])

  const handleMouseUp = () => {
    const selection = window.getSelection()
    if (selection && selection.toString().trim().length > 8) {
      setSelectedText(selection.toString().trim())
    } else {
      setSelectedText("")
    }
  }

  // Highlight helper handling exact and normalized quotes

  const evidenceStatusBadge = useMemo(() => {
    if (!selectedEvidence) return null
    const st = selectedEvidence.state || (selectedEvidence.verified ? "verified-exact" : "unverified")

    if (st === "verified-exact" || st === "verified") {
      return (
        <Badge variant="outline" className="text-[10px] text-success dark:text-success border-success/40 gap-1 bg-success/10 font-semibold shrink-0">
          <CheckCircle2 className="h-3 w-3" /> Overený dôkaz
        </Badge>
      )
    }
    if (st === "verified-normalized") {
      return (
        <Badge variant="outline" className="text-[10px] text-success dark:text-success border-success/40 gap-1 bg-success/10 font-semibold shrink-0">
          <CheckCircle2 className="h-3 w-3" /> Overený (normalizovaný)
        </Badge>
      )
    }
    if (st === "approximate") {
      return (
        <Badge variant="outline" className="text-[10px] text-warning dark:text-warning border-warning/40 gap-1 bg-warning/10 font-semibold shrink-0">
          <HelpCircle className="h-3 w-3" /> Približná zhoda
        </Badge>
      )
    }
    if (st === "ambiguous") {
      return (
        <Badge variant="outline" className="text-[10px] text-status-ambiguous dark:text-status-ambiguous border-status-ambiguous/40 gap-1 bg-status-ambiguous/10 font-semibold shrink-0">
          <HelpCircle className="h-3 w-3" /> Viacnásobný výskyt
        </Badge>
      )
    }
    if (st === "stale") {
      return (
        <Badge variant="outline" className="text-[10px] text-destructive dark:text-destructive border-destructive/40 gap-1 bg-destructive/10 font-semibold shrink-0">
          <AlertCircle className="h-3 w-3" /> Zmenený text
        </Badge>
      )
    }
    if (st === "context-only") {
      return (
        <Badge variant="outline" className="text-[10px] text-muted-foreground border-border gap-1 bg-muted/40 font-semibold shrink-0">
          <HelpCircle className="h-3 w-3" /> Kontextový úryvok (neoveruje absenciu)
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="text-[10px] text-muted-foreground gap-1 shrink-0">
        <AlertCircle className="h-3 w-3" /> Neoverený
      </Badge>
    )
  }, [selectedEvidence])

  return (
    <div className="flex flex-col h-full w-full border-r bg-muted/20 overflow-hidden select-text">
      {/* Top toolbar */}
      <div className="flex items-center justify-between border-b px-4 py-2.5 bg-card/90 backdrop-blur-xs shrink-0 gap-2 shadow-2xs z-10">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <FileText className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-foreground truncate">
            Zdrojový text
          </span>
          {selectedEvidence?.sectionHeading && (
            <Badge variant="secondary" className="text-[10px] hidden sm:inline-flex truncate max-w-[160px] font-medium">
              {selectedEvidence.sectionHeading}
            </Badge>
          )}
          {evidenceStatusBadge}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="relative w-36 sm:w-52">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Hľadať v texte..."
              className="h-7.5 text-xs pl-8 pr-7 rounded-lg bg-background"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-2 p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Floating selection action bar with live math & table typesetting */}
      {selectedText && onAddFindingFromSelection && (() => {
        const { snippet, isTruncated } = formatPreviewSnippet(selectedText, 95)
        const isTable = parseTableFromText(selectedText) !== null

        return (
          <div className="bg-primary text-primary-foreground px-3.5 py-2 flex items-center justify-between shadow-xl text-xs z-20 animate-in fade-in slide-in-from-top-1 border-b border-primary/20 gap-3">
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <Highlighter className="h-3.5 w-3.5 shrink-0 text-primary-foreground/80" />
              {isTable && (
                <Badge
                  variant="secondary"
                  className="h-4.5 text-[9px] px-1.5 py-0 font-bold uppercase tracking-wider bg-primary-foreground/15 text-primary-foreground border-primary-foreground/20 shrink-0"
                >
                  Tabuľka
                </Badge>
              )}
              <span className="truncate max-w-xs sm:max-w-md md:max-w-lg lg:max-w-xl italic font-serif inline-flex items-center gap-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] sm:text-xs text-primary-foreground">
                <span className="shrink-0 font-sans font-normal">&ldquo;</span>
                <span className="truncate inline-block max-w-full">
                  <InlineMathRenderer text={snippet} />
                </span>
                <span className="shrink-0 font-sans font-normal">{isTruncated ? "…&rdquo;" : "&rdquo;"}</span>
              </span>
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="h-6.5 text-[11px] font-bold gap-1.5 shrink-0 shadow-2xs cursor-pointer hover:bg-secondary/90 transition-all"
              onClick={() => {
                onAddFindingFromSelection(selectedText, selectedEvidence?.sectionHeading)
                setSelectedText("")
              }}
            >
              <PlusCircle className="h-3 w-3 text-primary" />
              Vytvoriť pripomienku
            </Button>
          </div>
        )
      })()}

      {/* Main Document Content Canvas (Paper Sheet with Shadow) */}
      <div
        ref={containerRef}
        onMouseUp={handleMouseUp}
        className="flex-1 overflow-y-auto no-scrollbar p-3 sm:p-6 bg-muted/40 dark:bg-background/60"
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8 space-y-3">
            <RefreshCw className="h-7 w-7 animate-spin text-primary opacity-80" />
            <p className="text-xs font-semibold text-foreground">Načítavam text rukopisu z workspace…</p>
          </div>
        ) : sourceMarkdown ? (
          /* Elevated Paper Canvas — wide sheet with rendered math & tables */
          <div className="max-w-5xl mx-auto bg-card dark:bg-card/95 rounded-2xl border border-border/80 shadow-xl ring-1 ring-black/5 dark:ring-white/10 p-6 sm:p-10 my-2 transition-all">
            {/* Document Sheet Header */}
            <div className="flex items-center justify-between border-b pb-3 text-xs text-muted-foreground mb-4">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <span className="font-semibold text-foreground text-xs">Originálny rukopis práce</span>
              </div>
              <span className="text-[10px] font-mono">
                {sourceMarkdown.split("\n\n").length} sekcií / odsekov
              </span>
            </div>

            <SourceMarkdownView
              workspaceId={workspaceId}
              markdown={sourceMarkdown}
              highlightQuote={selectedEvidence?.quote}
              searchQuery={searchQuery}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8 space-y-3">
            <div className="p-4 rounded-2xl bg-card border shadow-sm">
              <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
              <h4 className="text-sm font-semibold text-foreground">Žiadny textový náhľad dokumentu</h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Nahrajte PDF práce a spustite analýzu pre extrakciu textu a dôkazov.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})
