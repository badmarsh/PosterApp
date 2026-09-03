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

interface Props {
  workspaceId: string
  sourceMarkdown?: string
  selectedEvidence: EvidenceReference | null
  isLoading?: boolean
  onAddFindingFromSelection?: (quote: string, sectionHeading?: string) => void
}

export function EvidenceViewer({
  workspaceId,
  sourceMarkdown = "",
  selectedEvidence,
  isLoading = false,
  onAddFindingFromSelection,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedText, setSelectedText] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to the first evidence match after rendering.
  useEffect(() => {
    if (!selectedEvidence?.quote) return
    const t = setTimeout(() => {
      const el = containerRef.current?.querySelector("[data-evidence-match]")
      el?.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 60)
    return () => clearTimeout(t)
  }, [selectedEvidence, sourceMarkdown])

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
        <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-500/40 gap-1 bg-emerald-500/10 font-semibold shrink-0">
          <CheckCircle2 className="h-3 w-3" /> Overený dôkaz
        </Badge>
      )
    }
    if (st === "verified-normalized") {
      return (
        <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-500/40 gap-1 bg-emerald-500/10 font-semibold shrink-0">
          <CheckCircle2 className="h-3 w-3" /> Overený (normalizovaný)
        </Badge>
      )
    }
    if (st === "approximate") {
      return (
        <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/40 gap-1 bg-amber-500/10 font-semibold shrink-0">
          <HelpCircle className="h-3 w-3" /> Približná zhoda
        </Badge>
      )
    }
    if (st === "ambiguous") {
      return (
        <Badge variant="outline" className="text-[10px] text-purple-600 dark:text-purple-400 border-purple-500/40 gap-1 bg-purple-500/10 font-semibold shrink-0">
          <HelpCircle className="h-3 w-3" /> Viacnásobný výskyt
        </Badge>
      )
    }
    if (st === "stale") {
      return (
        <Badge variant="outline" className="text-[10px] text-red-600 dark:text-red-400 border-red-500/40 gap-1 bg-red-500/10 font-semibold shrink-0">
          <AlertCircle className="h-3 w-3" /> Zmenený text
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

      {/* Floating selection action bar */}
      {selectedText && onAddFindingFromSelection && (
        <div className="bg-primary text-primary-foreground px-4 py-2 flex items-center justify-between shadow-lg text-xs z-20 animate-in fade-in slide-in-from-top-1 border-b border-primary/20">
          <div className="flex items-center gap-2 truncate pr-2">
            <Highlighter className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate max-w-sm italic font-serif">&ldquo;{selectedText.slice(0, 75)}...&rdquo;</span>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="h-6.5 text-[11px] font-bold gap-1.5 shrink-0 shadow-2xs cursor-pointer"
            onClick={() => {
              onAddFindingFromSelection(selectedText, selectedEvidence?.sectionHeading)
              setSelectedText("")
            }}
          >
            <PlusCircle className="h-3 w-3 text-primary" />
            Vytvoriť pripomienku
          </Button>
        </div>
      )}

      {/* Main Document Content Canvas (Paper Sheet with Shadow) */}
      <div
        ref={containerRef}
        onMouseUp={handleMouseUp}
        className="flex-1 overflow-y-auto no-scrollbar p-3 sm:p-6 bg-muted/40 dark:bg-zinc-950/60"
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
              markdown={sourceMarkdown}
              highlightQuote={selectedEvidence?.quote}
              searchQuery={searchQuery}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8 space-y-3">
            <div className="p-4 rounded-2xl bg-card border shadow-sm">
              <FileText className="h-10 w-10 text-muted-foreground/60 mx-auto mb-2" />
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
}
