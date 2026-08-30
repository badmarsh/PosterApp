"use client"

/**
 * EvidenceViewer — Left-hand side of the Review Split Workspace.
 *
 * Renders the parsed manuscript text, highlights source sections,
 * and automatically scrolls and highlights the active evidence quote
 * when the reviewer clicks "Zobraziť dôkaz" on any finding card.
 */

import React, { useEffect, useRef, useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  FileText,
  Search,
  Highlighter,
  PlusCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import type { EvidenceReference } from "@/lib/ai/review-types"

interface Props {
  workspaceId: string
  sourceMarkdown?: string
  selectedEvidence: EvidenceReference | null
  onAddFindingFromSelection?: (quote: string, sectionHeading?: string) => void
}

export function EvidenceViewer({
  workspaceId,
  sourceMarkdown = "",
  selectedEvidence,
  onAddFindingFromSelection,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedText, setSelectedText] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const activeHighlightRef = useRef<HTMLSpanElement>(null)

  // Auto-scroll to selected evidence
  useEffect(() => {
    if (selectedEvidence?.quote && activeHighlightRef.current) {
      activeHighlightRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      })
    }
  }, [selectedEvidence])

  const handleMouseUp = () => {
    const selection = window.getSelection()
    if (selection && selection.toString().trim().length > 10) {
      setSelectedText(selection.toString().trim())
    } else {
      setSelectedText("")
    }
  }

  const highlightQuote = (text: string, targetQuote?: string, query?: string) => {
    if (!text) return text

    // If there is an active evidence quote, highlight it with active styling
    const cleanTarget = targetQuote?.trim()
    if (cleanTarget && text.includes(cleanTarget)) {
      const parts = text.split(cleanTarget)
      return (
        <>
          {parts.map((part, i) => (
            <React.Fragment key={i}>
              {part}
              {i < parts.length - 1 && (
                <mark
                  ref={activeHighlightRef}
                  className="bg-primary/20 text-foreground border-b-2 border-primary font-medium px-1 rounded transition-all duration-500 ring-2 ring-primary/40 animate-pulse"
                >
                  {cleanTarget}
                </mark>
              )}
            </React.Fragment>
          ))}
        </>
      )
    }

    // Otherwise if there is a search query
    if (query && query.trim().length > 1) {
      const q = query.trim()
      const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi")
      const parts = text.split(regex)
      return (
        <>
          {parts.map((part, i) =>
            regex.test(part) ? (
              <mark key={i} className="bg-yellow-200 dark:bg-yellow-900/60 text-foreground px-0.5 rounded">
                {part}
              </mark>
            ) : (
              part
            )
          )}
        </>
      )
    }

    return text
  }

  return (
    <div className="flex flex-col h-full w-full border-r bg-background/50 overflow-hidden select-text">
      {/* Top toolbar */}
      <div className="flex items-center justify-between border-b px-4 py-2.5 bg-muted/30 shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider truncate">
            Zdrojový dokument
          </span>
          {selectedEvidence?.sectionHeading && (
            <Badge variant="outline" className="text-[10px] hidden sm:inline-flex truncate max-w-[150px]">
              {selectedEvidence.sectionHeading}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-36 sm:w-48">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Hľadať v texte..."
              className="h-7 text-xs pl-7"
            />
          </div>
        </div>
      </div>

      {/* Floating selection action bar */}
      {selectedText && onAddFindingFromSelection && (
        <div className="bg-primary text-primary-foreground px-3 py-1.5 flex items-center justify-between shadow-md text-xs z-10 animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2 truncate pr-2">
            <Highlighter className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate max-w-xs italic font-serif">&ldquo;{selectedText.slice(0, 50)}...&rdquo;</span>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="h-6 text-[11px] font-semibold gap-1 shrink-0"
            onClick={() => {
              onAddFindingFromSelection(selectedText, selectedEvidence?.sectionHeading)
              setSelectedText("")
            }}
          >
            <PlusCircle className="h-3 w-3" />
            Vytvoriť pripomienku
          </Button>
        </div>
      )}

      {/* Main Document Content */}
      <div
        ref={containerRef}
        onMouseUp={handleMouseUp}
        className="flex-1 overflow-y-auto p-4 sm:p-6 font-serif text-sm leading-relaxed text-foreground/90 space-y-4"
      >
        {sourceMarkdown ? (
          <div className="max-w-2xl mx-auto whitespace-pre-wrap font-sans text-xs sm:text-sm leading-relaxed space-y-3">
            {sourceMarkdown.split("\n\n").map((para, idx) => {
              if (para.startsWith("#")) {
                const level = para.match(/^#+/)?.[0].length || 1
                const title = para.replace(/^#+\s*/, "")
                return (
                  <h3
                    key={idx}
                    className={`font-sans font-bold text-foreground tracking-tight pt-3 border-b pb-1 ${
                      level === 1 ? "text-base sm:text-lg" : "text-sm sm:text-base"
                    }`}
                  >
                    {highlightQuote(title, selectedEvidence?.quote, searchQuery)}
                  </h3>
                )
              }
              return (
                <p key={idx} className="text-muted-foreground leading-normal">
                  {highlightQuote(para, selectedEvidence?.quote, searchQuery)}
                </p>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8 space-y-2">
            <FileText className="h-8 w-8 opacity-40" />
            <p className="text-xs">Žiadny textový náhľad dokumentu.</p>
            <p className="text-[11px] opacity-75">
              Nahrajte PDF/DOCX do workspace a spustite analýzu na extrakciu sekcií.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
