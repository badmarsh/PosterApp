"use client"

/**
 * AcademicSearchDialog — Perplexity-style scholarly discovery modal.
 *
 * Real-time multi-source academic search across OpenAlex, Crossref, Semantic Scholar, and arXiv
 * with Open Access PDF resolution, citation metrics, and 1-click BibTeX importing.
 */

import { useState, useTransition, useEffect, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import {
  Search,
  BookOpen,
  ExternalLink,
  Download,
  Copy,
  Check,
  Plus,
  Loader2,
  Sparkles,
  GraduationCap,
  FileText,
  Layers,
  Calendar,
  Filter,
  X,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react"
import { toast } from "sonner"
import { getAcademicSearchStrings } from "@/lib/i18n/academic-search"
import type { AcademicPaperResult } from "@/lib/services/academic-connector"
import { credibilityAssessment, type CredibilityAssessment } from "@/lib/services/search-quality"
import { academicPaperToBibEntry } from "@/lib/bib-types"
import { useEditor, useEditorStoreInstance } from "@/components/editor-store"
import { useCopyFeedback } from "@/hooks/use-copy-feedback"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DOMAIN_PRESETS: { id: string; labelKey: "domainAll" | "domainPhysics" | "domainCs" | "domainEngineering" | "domainMedicine"; prefix?: string }[] = [
  { id: "all", labelKey: "domainAll" },
  { id: "physics", labelKey: "domainPhysics", prefix: "physics " },
  { id: "cs", labelKey: "domainCs", prefix: "computer science machine learning " },
  { id: "engineering", labelKey: "domainEngineering", prefix: "engineering " },
  { id: "medicine", labelKey: "domainMedicine", prefix: "biomedical clinical " },
]

const QUICK_SUGGESTIONS = [
  { label: "Quantum Machine Learning", query: "quantum machine learning" },
  { label: "CONSORT 2025 Clinical Trials", query: "CONSORT 2025 randomized trials" },
  { label: "PRISMA 2020 Systematic Review", query: "PRISMA 2020 systematic review" },
  { label: "Transformer Neural Networks", query: "attention is all you need transformers" },
  { label: "DOI: 10.1038/nature14539", query: "10.1038/nature14539" },
]

/**
 * Trust pill for one search result: credibility level + score, with the
 * concrete reasons in the tooltip. Retracted papers get a hard destructive
 * badge — they must never look merely "medium".
 */
function CredibilityPill({ assessment }: { assessment: CredibilityAssessment }) {
  if (assessment.isRetracted) {
    return (
      <Badge
        variant="outline"
        className="text-[10px] font-bold gap-1 border-destructive/40 bg-destructive/10 text-destructive"
        title={assessment.reasons.join(" · ")}
      >
        <ShieldAlert className="size-3" aria-hidden="true" />
        RETRACTED — necitovať
      </Badge>
    )
  }
  const { level, score, reasons } = assessment
  const style =
    level === "high"
      ? "border-success/30 bg-success/10 text-success"
      : level === "medium"
        ? "border-status-info/30 bg-status-info/10 text-status-info"
        : "border-border bg-muted/40 text-muted-foreground"
  const label = level === "high" ? "Dôveryhodný" : level === "medium" ? "Overiteľný" : "Slabá evidencia"
  return (
    <Badge
      variant="outline"
      className={`text-[10px] font-semibold gap-1 ${style}`}
      title={`${score}/100 — ${reasons.join(" · ")}`}
    >
      <ShieldCheck className="size-3" aria-hidden="true" />
      {label}
    </Badge>
  )
}

export function AcademicSearchDialog({ open, onOpenChange }: Props) {
  const uiLanguage = useEditor((s) => s.language)
  const t = getAcademicSearchStrings(uiLanguage)
  const [query, setQuery] = useState("")
  const [domain, setDomain] = useState("all")
  const [yearFilter, setYearFilter] = useState<string>("all")
  const [results, setResults] = useState<AcademicPaperResult[]>([])
  const [isSearching, startSearch] = useTransition()
  const [hasSearched, setHasSearched] = useState(false)
  const [importedKeys, setImportedKeys] = useState<Set<string>>(new Set())
  const [expandedAbstracts, setExpandedAbstracts] = useState<Set<string>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)
  const { copiedKey, copy, isCopied } = useCopyFeedback()

  const editorStore = useEditorStoreInstance()

  // Autofocus primary input whenever dialog opens; also handle Esc to clear query
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 60)
      return () => clearTimeout(t)
    }
  }, [open])

  const executeSearch = (searchQuery: string) => {
    const trimmed = searchQuery.trim()
    if (!trimmed || trimmed.length < 2) return

    setHasSearched(true)
    startSearch(async () => {
      try {
        let yearFrom: number | undefined
        if (yearFilter === "2y") yearFrom = new Date().getFullYear() - 2
        if (yearFilter === "5y") yearFrom = new Date().getFullYear() - 5

        const domainPrefix = DOMAIN_PRESETS.find((d) => d.id === domain)?.prefix || ""
        const finalQuery = domainPrefix && !trimmed.toLowerCase().includes(domain) ? `${domainPrefix}${trimmed}` : trimmed

        const res = await fetch("/api/academic/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: finalQuery,
            limit: 8,
            yearFrom,
          }),
        })

        if (res.ok) {
          const data = await res.json()
          setResults(data.results || [])
        } else {
          setResults([])
        }
      } catch (err) {
        console.error("Search error:", err)
        setResults([])
      }
    })
  }

  const handleSearch = () => executeSearch(query)

  const handleSuggestionClick = (suggestQuery: string) => {
    setQuery(suggestQuery)
    executeSearch(suggestQuery)
  }

  const handleCopyCitation = async (paper: AcademicPaperResult, idx: number) => {
    const authors = paper.authors.join(", ")
    const cit = `${authors} (${paper.year ?? "n.d."}). ${paper.title}.${paper.venue ? ` ${paper.venue}.` : ""}${paper.doi ? ` DOI: ${paper.doi}` : paper.url ? ` URL: ${paper.url}` : ""}`
    await copy(cit, String(idx), t.toastCopied)
  }

  const handleCopyBibtex = async (paper: AcademicPaperResult, idx: number) => {
    const entry = academicPaperToBibEntry(paper)
    const bib = entry.rawBibtex || `@article{${entry.key},\n  title={${entry.title}},\n  author={${entry.authorString}},\n  year={${entry.year || ""}}\n}`
    await copy(bib, `bib-${idx}`, "BibTeX copied to clipboard")
  }

  const handleImportBib = async (paper: AcademicPaperResult) => {
    const entry = academicPaperToBibEntry(paper)
    try {
      await editorStore.getState().addBibEntry(entry)
      setImportedKeys((prev) => new Set([...prev, entry.key]))
      toast.success(t.toastAdded(entry.key))
    } catch (e) {
      toast.error("Failed to add citation", {
        description: e instanceof Error ? e.message : "Please try again or add manually.",
      })
    }
  }

  const toggleAbstract = (id: string) => {
    setExpandedAbstracts((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-4xl max-w-[96vw] w-full h-[85vh] max-h-[85vh] flex flex-col p-0 overflow-hidden shadow-2xl border bg-background gap-0">
        <DialogHeader className="shrink-0 sticky top-0 z-10 px-6 pt-5 pb-4 border-b bg-card shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-2xs">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                {t.title} <span className="text-xs font-normal text-muted-foreground font-mono">(Perplexity Academic)</span>
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                {t.subtitle}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="shrink-0 p-5 border-b space-y-3.5 bg-card/60">
          {/* Search bar */}
          <div className="flex gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                className="pl-10 pr-9 h-10 text-sm rounded-lg bg-background shadow-2xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0"
                placeholder={t.placeholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    handleSearch()
                  }
                  if (e.key === "Escape" && query) {
                    e.preventDefault()
                    setQuery("")
                  }
                }}
                aria-label="Search academic literature"
                autoFocus
              />
              {query && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setQuery("")
                    inputRef.current?.focus()
                  }}
                  className="absolute right-3 top-2.5 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors duration-150"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button
              className="h-10 px-5 font-semibold text-xs gap-1.5 shrink-0 shadow-2xs transition-colors duration-150"
              onClick={handleSearch}
              disabled={isSearching || query.trim().length < 2}
              aria-label="Search academic literature"
            >
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {t.search}
            </Button>
          </div>

          {/* Filter bars */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-0.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground mr-1">Odbor:</span>
              {DOMAIN_PRESETS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDomain(d.id)}
                  aria-pressed={domain === d.id}
                  className={`px-3 py-1 rounded-full text-[11px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    domain === d.id
                      ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                      : "bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/40"
                  }`}
                >
                  {t[d.labelKey]}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="h-7 text-[11px] font-medium rounded-md border bg-background px-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="all">{t.yearsAll}</option>
                <option value="2y">{t.years2}</option>
                <option value="5y">{t.years5}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results Area */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-3.5 bg-muted/10">
          {isSearching ? (
            <div className="space-y-3" role="status" aria-label="Searching academic literature">
              <div className="flex items-center gap-2 text-xs text-muted-foreground pb-1">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="font-medium">{t.searching}</span>
                <span className="text-[11px]">{t.searchingSub}</span>
              </div>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-xl border bg-card p-4 space-y-3 animate-pulse">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-16 w-full rounded-lg" />
                  <div className="flex justify-between pt-2">
                    <Skeleton className="h-6 w-24 rounded-md" />
                    <Skeleton className="h-7 w-20 rounded-md" />
                  </div>
                </div>
              ))}
              <span className="sr-only">Searching…</span>
            </div>
          ) : results.length > 0 ? (
            results.map((paper, idx) => {
              const bibKey = academicPaperToBibEntry(paper).key
              const isImported = importedKeys.has(bibKey)
              const cardId = paper.paperId || `paper-${idx}`
              const isAbstractExpanded = expandedAbstracts.has(cardId)

              return (
                <div
                  key={cardId}
                  className="rounded-xl border bg-card p-4 space-y-3 hover:border-primary/40 hover:shadow-xs transition-colors duration-150 focus-within:ring-1 focus-within:ring-ring"
                >
                  {/* Top metadata row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <h3 className="font-semibold text-sm leading-snug text-foreground">
                        {paper.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground/80">
                          {paper.authors.slice(0, 4).join(", ")}
                          {paper.authors.length > 4 ? " et al." : ""}
                        </span>
                        {paper.year && (
                          <>
                            <span>•</span>
                            <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                              {paper.year}
                            </Badge>
                          </>
                        )}
                        {paper.venue && (
                          <>
                            <span>•</span>
                            <span className="italic truncate max-w-[280px]" title={paper.venue}>
                              {paper.venue}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Source and metrics */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <CredibilityPill assessment={credibilityAssessment(paper)} />
                      {paper.citationCount !== undefined && paper.citationCount > 0 && (
                        <Badge variant="outline" className="text-[10px] font-semibold gap-1 border-warning/30 bg-warning/10 text-warning">
                          ★ {t.citations(paper.citationCount)}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-wider bg-muted/40">
                        {paper.source}
                      </Badge>
                    </div>
                  </div>

                  {/* Abstract / TLDR */}
                  {(paper.tldr || paper.abstract) && (
                    <div className="text-xs text-muted-foreground leading-relaxed bg-muted/30 border border-border/40 rounded-lg p-3 space-y-1.5">
                      {paper.tldr && (
                        <p className="font-medium text-foreground/90 flex items-start gap-1.5 text-[11px]">
                          <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                          <span><strong>AI TLDR:</strong> {paper.tldr}</span>
                        </p>
                      )}
                      {paper.abstract && (
                        <p className={isAbstractExpanded ? "" : "line-clamp-2"}>
                          {paper.abstract}
                        </p>
                      )}
                      {paper.abstract && paper.abstract.length > 150 && (
                        <button
                          onClick={() => toggleAbstract(cardId)}
                          className="text-[10px] text-primary hover:underline font-semibold block pt-0.5"
                        >
                          {isAbstractExpanded ? t.collapseAbstract : t.expandAbstract}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Topics */}
                  {paper.topics && paper.topics.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {paper.topics.slice(0, 5).map((topic) => (
                        <span
                          key={topic}
                          className="rounded-md bg-muted/60 border border-border/30 px-2 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Actions Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-border/60 text-xs">
                    <div className="flex items-center gap-2.5">
                      {paper.openAccessPdfUrl && (
                        <a
                          href={paper.openAccessPdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-[11px] font-semibold text-success hover:underline bg-success/10 px-2.5 py-1 rounded-md border border-success/30 transition-colors duration-150"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Open Access PDF
                        </a>
                      )}
                      {paper.doi && (
                        <a
                          href={`https://doi.org/${paper.doi}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-3 w-3" />
                          DOI: {paper.doi}
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Copy citation for ${paper.title.slice(0, 40)}`}
                        className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5 transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => handleCopyCitation(paper, idx)}
                      >
                        {isCopied(String(idx)) ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-success" />
                            {t.copied}
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            {t.copy}
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Copy BibTeX for ${paper.title.slice(0, 40)}`}
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1 transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => handleCopyBibtex(paper, idx)}
                      >
                        {isCopied(`bib-${idx}`) ? (
                          <>
                            <Check className="h-3 w-3 text-success" />
                            Copied!
                          </>
                        ) : (
                          <>BibTeX</>
                        )}
                      </Button>

                      <Button
                        size="sm"
                        variant={isImported ? "outline" : "secondary"}
                        disabled={isImported}
                        className="h-7 px-3 text-xs gap-1.5 font-semibold"
                        onClick={() => handleImportBib(paper)}
                      >
                        {isImported ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-success" />
                            V bibliografii
                          </>
                        ) : (
                          <>
                            <Plus className="h-3.5 w-3.5 text-primary" />
                            + Do .bib
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })
          ) : hasSearched ? (
            <EmptyState
              icon={BookOpen}
              title={t.noResults}
              description={t.noResultsHint}
              action={
                <Button size="sm" variant="outline" className="mt-2 h-7 text-xs gap-1.5" onClick={() => inputRef.current?.focus()}>
                  <Search className="h-3.5 w-3.5" />
                  Try another query
                </Button>
              }
            />
          ) : (
            <div className="py-12 space-y-6 max-w-xl mx-auto text-center">
              <div className="space-y-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mx-auto border border-primary/20 shadow-xs">
                  <GraduationCap className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-bold text-foreground">
                  {t.emptyTitle}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t.emptyHint}
                </p>
              </div>

              {/* Quick suggestions */}
              <div className="space-y-2 text-left pt-2 border-t border-border/60">
                <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                  {t.quickExamples}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_SUGGESTIONS.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => handleSuggestionClick(s.query)}
                      className="flex items-center gap-1 rounded-lg border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-accent transition-colors shadow-2xs"
                    >
                      <span>{s.label}</span>
                      <ArrowRight className="h-2.5 w-2.5 opacity-60" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
