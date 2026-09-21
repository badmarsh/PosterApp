"use client"

import React, { useState, useMemo } from "react"
import {
  Sparkles,
  Search,
  X,
  Atom,
  Cpu,
  Dna,
  Layers,
  GraduationCap,
  Copy,
  ExternalLink,
  FileText,
  Presentation,
  Award,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { ALL_SHOWCASE_PROJECTS, SHOWCASE_CATEGORIES, ELITE_SHOWCASES } from "@/lib/showcases-data"
import type { Project } from "@/lib/poster-types"

interface ShowcaseGalleryProps {
  onSelectShowcase: (id: string) => void
  onDuplicateShowcase?: (project: Project) => void
  isDuplicating?: boolean
}

function ShowcaseCard({
  showcase,
  eliteData,
  onSelect,
  onDuplicate,
  isDuplicating,
}: {
  showcase: Project
  eliteData?: typeof ELITE_SHOWCASES[number]
  onSelect: () => void
  onDuplicate?: () => void
  isDuplicating: boolean
}) {
  const [imgError, setImgError] = useState(false)
  const activeOutput = showcase.outputs.find((o) => o.id === showcase.activeOutputId) || showcase.outputs[0]
  const outputsCount = showcase.outputs.length
  const previewUrl = "/showcases/" + showcase.id + ".png"

  const getCategoryIcon = (id: string) => {
    switch (id) {
      case "atlas-bose-einstein-correlations":
      case "neural-wavefunction-superconductors":
        return <Atom className="size-3.5 text-rose-500" />
      case "jwst-gravitational-lensing":
        return <Atom className="size-3.5 text-sky-500" />
      case "quantum-supremacy-sycamore":
      case "speculative-decoding-guarantees":
        return <Cpu className="size-3.5 text-indigo-500" />
      case "alphafold-protein-folding":
      case "cas13-panviral-immunity":
        return <Dna className="size-3.5 text-emerald-500" />
      case "posudok-diplomovka-ai":
        return <GraduationCap className="size-3.5 text-sky-500" />
      default:
        return <Layers className="size-3.5 text-indigo-500" />
    }
  }

  return (
    <div
      onClick={onSelect}
      className="group relative flex flex-col justify-between rounded-xl border border-border/70 bg-card transition-all duration-200 hover:border-primary/50 hover:shadow-lg cursor-pointer overflow-hidden"
    >
      <div>
        {/* Visual Poster / Document Preview Thumbnail */}
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted/50 border-b border-border/50 select-none">
          {!imgError ? (
            <img
              src={previewUrl}
              alt={showcase.posterTitle || showcase.name}
              className="w-full h-full object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.03]"
              onError={() => setImgError(true)}
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-muted/80 via-muted to-muted/40 p-4 text-center">
              <div className="p-3 rounded-full bg-background/80 border border-border/50 mb-2 shadow-xs">
                {getCategoryIcon(showcase.id)}
              </div>
              <span className="text-xs font-semibold text-foreground/80 line-clamp-1">
                {showcase.posterTitle || showcase.name}
              </span>
              <span className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                {activeOutput?.templateId}
              </span>
            </div>
          )}

          {/* Scrim overlay at top for badge legibility */}
          <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/50 via-black/20 to-transparent pointer-events-none" />

          {/* Template Badge on Preview */}
          <div className="absolute top-2 left-2 flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-black/75 backdrop-blur-md px-2 py-0.5 text-[10px] font-mono font-medium text-white shadow-xs border border-white/10">
              <span
                className="size-2 rounded-full ring-1 ring-white/20 shrink-0"
                style={{ backgroundColor: activeOutput?.themeColor || "#4F46E5" }}
              />
              {activeOutput?.templateId || showcase.templateName}
            </span>
          </div>

          {/* Formats count badge */}
          <div className="absolute top-2 right-2 flex items-center gap-1">
            <span className="inline-flex items-center gap-1 rounded-md bg-black/75 backdrop-blur-md px-2 py-0.5 text-[10px] font-medium text-white shadow-xs border border-white/10">
              {outputsCount > 1 ? outputsCount + " formáty" : "1 formát"}
            </span>
          </div>

          {/* Hover highlight overlay */}
          <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-center justify-center">
            <span className="inline-flex items-center gap-1.5 bg-background/90 backdrop-blur-md text-foreground text-xs font-medium px-3 py-1.5 rounded-full shadow-md border border-border/80">
              <ExternalLink className="size-3.5 text-primary" />
              Otvoriť ukážku
            </span>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-3.5 pb-2">
          {/* Category & Venue */}
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium truncate">
              <span className="p-1 rounded bg-muted border border-border/40 shrink-0">
                {getCategoryIcon(showcase.id)}
              </span>
              <span className="truncate">{showcase.venue.split("•")[0].split(",")[0]}</span>
            </div>
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono shrink-0">
              {(activeOutput?.cards?.length || 0) + " sekcií"}
            </Badge>
          </div>

          {/* Title */}
          <h4 className="text-sm font-bold leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-1">
            {showcase.posterTitle || showcase.name}
          </h4>

          {/* Authors */}
          <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
            {showcase.authors}
          </p>

          {/* Key metrics / Highlights from elite data */}
          {eliteData?.highlights && eliteData.highlights.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
              {eliteData.highlights.map((h, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 rounded bg-muted/80 px-1.5 py-0.5 text-[10px] border border-border/40"
                >
                  <strong className="font-mono text-foreground font-semibold">{h.value}</strong>
                  <span className="text-muted-foreground">{h.label}</span>
                </span>
              ))}
            </div>
          )}

          {/* Available outputs badges */}
          <div className="flex flex-wrap items-center gap-1 mb-1">
            {showcase.outputs.map((out) => (
              <span
                key={out.id}
                className="inline-flex items-center gap-1 rounded-md bg-muted/60 border border-border/40 px-1.5 py-0.5 text-[10px] text-muted-foreground font-medium"
                title={out.outputType + " (" + out.templateId + ")"}
              >
                {out.outputType === "poster" && <Layers className="size-2.5 text-indigo-500 shrink-0" />}
                {out.outputType === "slides" && <Presentation className="size-2.5 text-amber-500 shrink-0" />}
                {out.outputType === "paper" && <FileText className="size-2.5 text-emerald-500 shrink-0" />}
                {out.outputType === "thesis-review" && <Award className="size-2.5 text-sky-500 shrink-0" />}
                <span className="capitalize">{out.outputType}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Actions Footer */}
      <div
        className="flex items-center justify-between gap-2 px-3.5 py-2.5 mt-1 border-t border-border/50 bg-muted/20"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-[11px] text-muted-foreground truncate max-w-[150px]">
          {showcase.assets.length > 0 ? showcase.assets.length + " grafov (SVG/PNG)" : "Vzorce a tabuľky"}
        </span>

        <div className="flex items-center gap-1.5 shrink-0">
          {onDuplicate && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs px-2.5 gap-1 cursor-pointer hover:bg-muted"
              disabled={isDuplicating}
              onClick={(e) => {
                e.stopPropagation()
                onDuplicate()
              }}
              title="Vytvoriť kópiu ukážky do vlastných projektov"
            >
              <Copy className="size-3" />
              Duplikovať
            </Button>
          )}
          <Button
            size="sm"
            variant="default"
            className="h-7 text-xs px-3 gap-1 cursor-pointer font-medium"
            onClick={(e) => {
              e.stopPropagation()
              onSelect()
            }}
          >
            <ExternalLink className="size-3" />
            Otvoriť
          </Button>
        </div>
      </div>
    </div>
  )
}

export function ShowcaseGallery({
  onSelectShowcase,
  onDuplicateShowcase,
  isDuplicating = false,
}: ShowcaseGalleryProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")

  const eliteMap = useMemo(() => {
    return new Map(ELITE_SHOWCASES.map((e) => [e.id, e]))
  }, [])

  const filteredShowcases = useMemo(() => {
    return ALL_SHOWCASE_PROJECTS.filter((showcase) => {
      // Category filter
      if (selectedCategory === "ai-foundations") {
        const aiIds = [
          "attention-is-all-you-need",
          "resnet-deep-residual-learning",
          "bert-pre-training",
          "gans-goodfellow-2014",
          "vla-autonomous-surgery",
          "speculative-decoding-guarantees",
        ]
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
        const elite = eliteMap.get(showcase.id)
        const matchTags = elite?.tags?.some((t) => t.toLowerCase().includes(q)) ?? false
        return matchTitle || matchAuthors || matchVenue || matchTemplate || matchTags
      }

      return true
    })
  }, [selectedCategory, searchQuery, eliteMap])

  return (
    <div className="flex flex-col h-full min-h-0 gap-3">
      {/* Header controls: Search & Category filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pb-2 border-b shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
          {SHOWCASE_CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-full transition-all shrink-0 cursor-pointer",
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "bg-muted/70 text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {cat.label}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Hľadať ukážku, autora, model..."
              className="h-8 pl-8 pr-7 text-xs bg-muted/30 focus-visible:ring-1"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <span className="text-[11px] text-muted-foreground whitespace-nowrap hidden md:inline">
            {filteredShowcases.length} z {ALL_SHOWCASE_PROJECTS.length}
          </span>
        </div>
      </div>

      {/* Scrollable grid of showcase cards with native smooth wheel scrolling */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1.5 pb-6 overscroll-contain">
        {filteredShowcases.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-4 pb-4">
            {filteredShowcases.map((showcase) => (
              <ShowcaseCard
                key={showcase.id}
                showcase={showcase}
                eliteData={eliteMap.get(showcase.id)}
                onSelect={() => onSelectShowcase(showcase.id)}
                onDuplicate={onDuplicateShowcase ? () => onDuplicateShowcase(showcase) : undefined}
                isDuplicating={isDuplicating}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <Search className="size-8 stroke-1 mb-2 text-muted-foreground/60" />
            <p className="text-sm font-medium">Nenašli sa žiadne ukážky</p>
            <p className="text-xs mt-1 text-muted-foreground/80">
              Skúste zmeniť kategóriu alebo hľadaný výraz.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 text-xs h-8"
              onClick={() => {
                setSelectedCategory("all")
                setSearchQuery("")
              }}
            >
              Resetovať filtre
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
