"use client"

import React, { useState, useMemo } from "react"
import {
  Sparkles,
  Search,
  Atom,
  Cpu,
  Dna,
  Layers,
  GraduationCap,
  Copy,
  ExternalLink,
  Check,
  FileText,
  Presentation,
  FileSpreadsheet,
  Award
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { ALL_SHOWCASE_PROJECTS, SHOWCASE_CATEGORIES } from "@/lib/showcases-data"
import type { Project } from "@/lib/poster-types"

interface ShowcaseGalleryProps {
  onSelectShowcase: (id: string) => void
  onDuplicateShowcase?: (project: Project) => void
  isDuplicating?: boolean
}

export function ShowcaseGallery({
  onSelectShowcase,
  onDuplicateShowcase,
  isDuplicating = false,
}: ShowcaseGalleryProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")

  const filteredShowcases = useMemo(() => {
    return ALL_SHOWCASE_PROJECTS.filter((showcase) => {
      // Category filter
      if (selectedCategory === "ai-foundations") {
        const aiIds = ["attention-is-all-you-need", "resnet-deep-residual-learning", "bert-pre-training", "gans-goodfellow-2014", "vla-autonomous-surgery", "speculative-decoding-guarantees"]
        if (!aiIds.includes(showcase.id)) return false
      } else if (selectedCategory === "physics") {
        if (!["atlas-bose-einstein-correlations", "neural-wavefunction-superconductors", "jwst-gravitational-lensing"].includes(showcase.id)) return false
      } else if (selectedCategory === "quantum") {
        if (!["quantum-supremacy-sycamore", "neural-wavefunction-superconductors"].includes(showcase.id)) return false
      } else if (selectedCategory === "biology") {
        if (!["alphafold-protein-folding", "cas13-panviral-immunity"].includes(showcase.id)) return false
      } else if (selectedCategory === "thesis-review") {
        if (!["posudok-diplomovka-ai", "vla-autonomous-surgery", "jwst-gravitational-lensing"].includes(showcase.id)) return false
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchTitle = showcase.name.toLowerCase().includes(q) || (showcase.posterTitle || showcase.name).toLowerCase().includes(q)
        const matchAuthors = showcase.authors.toLowerCase().includes(q)
        const matchVenue = showcase.venue.toLowerCase().includes(q)
        const matchTemplate = (showcase.templateName || "").toLowerCase().includes(q)
        return matchTitle || matchAuthors || matchVenue || matchTemplate
      }

      return true
    })
  }, [selectedCategory, searchQuery])

  const getCategoryIcon = (id: string) => {
    switch (id) {
      case "atlas-bose-einstein-correlations":
      case "neural-wavefunction-superconductors":
        return <Atom className="size-4 text-rose-500" />
      case "jwst-gravitational-lensing":
        return <Atom className="size-4 text-sky-500" />
      case "quantum-supremacy-sycamore":
      case "speculative-decoding-guarantees":
        return <Cpu className="size-4 text-indigo-500" />
      case "alphafold-protein-folding":
      case "cas13-panviral-immunity":
        return <Dna className="size-4 text-emerald-500" />
      case "posudok-diplomovka-ai":
        return <GraduationCap className="size-4 text-sky-500" />
      default:
        return <Layers className="size-4 text-indigo-500" />
    }
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Header controls: Search & Category filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pb-1 border-b">
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
          {SHOWCASE_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-full transition-all shrink-0 cursor-pointer",
                selectedCategory === cat.id
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "bg-muted/70 text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Hľadať ukážku, autora, tému..."
            className="h-8 pl-8 text-xs bg-muted/30 focus-visible:ring-1"
          />
        </div>
      </div>

      {/* Grid of showcase cards */}
      <ScrollArea className="flex-1 pr-3 max-h-[60vh]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pb-2">
          {filteredShowcases.map((showcase) => {
            const activeOutput = showcase.outputs.find((o) => o.id === showcase.activeOutputId) || showcase.outputs[0]
            const cardsCount = activeOutput?.cards?.length || 0
            const outputsCount = showcase.outputs.length

            return (
              <div
                key={showcase.id}
                className="group flex flex-col justify-between rounded-xl border border-border/70 bg-card p-4 transition-all hover:border-primary/50 hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-muted/80 border border-border/40">
                        {getCategoryIcon(showcase.id)}
                      </div>
                      <div>
                        <span className="text-[11px] font-mono font-medium text-muted-foreground uppercase tracking-wider">
                          {showcase.templateName}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: activeOutput?.themeColor || "#4F46E5" }}
                          />
                          <span className="text-[11px] text-muted-foreground font-medium">
                            {showcase.venue.split(",")[0]}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {outputsCount > 1 && (
                        <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-normal">
                          {outputsCount} formáty
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono">
                        {cardsCount} sekcií
                      </Badge>
                    </div>
                  </div>

                  <h4 className="text-sm font-semibold leading-snug group-hover:text-primary transition-colors line-clamp-2 mb-1.5">
                    {showcase.posterTitle}
                  </h4>

                  <p className="text-xs text-muted-foreground line-clamp-1 mb-2.5">
                    {showcase.authors}
                  </p>

                  {/* Formats badges */}
                  <div className="flex flex-wrap items-center gap-1 mb-3.5">
                    {showcase.outputs.map((out) => (
                      <span
                        key={out.id}
                        className="inline-flex items-center gap-1 rounded-md bg-muted/60 border border-border/40 px-1.5 py-0.5 text-[10px] text-muted-foreground font-medium"
                      >
                        {out.outputType === "poster" && <Layers className="size-2.5 text-indigo-500" />}
                        {out.outputType === "slides" && <Presentation className="size-2.5 text-amber-500" />}
                        {out.outputType === "paper" && <FileText className="size-2.5 text-emerald-500" />}
                        {out.outputType === "thesis-review" && <Award className="size-2.5 text-sky-500" />}
                        {out.outputType} · {out.templateId}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
                  <span className="text-[11px] text-muted-foreground/80 truncate max-w-[140px]">
                    {showcase.assets.length > 0 ? `${showcase.assets.length} vedeckých grafov` : "Text a vzorce"}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {onDuplicateShowcase && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs px-2.5 gap-1 cursor-pointer"
                        disabled={isDuplicating}
                        onClick={() => onDuplicateShowcase(showcase)}
                        title="Vytvoriť kópiu ukážky do vlastných projektov"
                      >
                        <Copy className="size-3" />
                        Duplikovať
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="default"
                      className="h-7 text-xs px-3 gap-1 cursor-pointer"
                      onClick={() => onSelectShowcase(showcase.id)}
                    >
                      <ExternalLink className="size-3" />
                      Otvoriť ukážku
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
