"use client"

/**
 * CitationIssuesPanel — displays citation audit results & bibliographic issues.
 *
 * Shows issues flagged by Academic Connector (Semantic Scholar / arXiv)
 * and ISO 690 / completeness checks. Includes live literature lookup search.
 */

import { useState } from "react"
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Search,
  ExternalLink,
  Loader2,
  Copy,
  Check,
  Plus,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ReviewLanguage } from "@/lib/ai/thesis-rubric"
import type { AcademicPaperResult } from "@/lib/services/academic-connector"
import { academicPaperToBibEntry, slugifyCiteKey } from "@/lib/bib-types"
import { useEditorStoreInstance } from "@/components/editor-store"

interface Props {
  issues: string[]
  lang: ReviewLanguage
  workspaceId?: string
}

const LABELS: Record<
  ReviewLanguage,
  {
    title: string
    subtitle: string
    clean: string
    searchTitle: string
    searchPlaceholder: string
    searchBtn: string
    noResults: string
  }
> = {
  sk: {
    title: "Akademický konektor & Kontrola citácií",
    subtitle: "Overenie citovaných zdrojov cez Semantic Scholar / arXiv a normu ISO 690",
    clean: "Všetky overované citácie spĺňajú základné požiadavky.",
    searchTitle: "Overiť / Vyhľadať akademický zdroj:",
    searchPlaceholder: "Zadajte názov článku, DOI alebo arXiv ID...",
    searchBtn: "Hľadať",
    noResults: "Neboli nájdené žiadne záznamy v Semantic Scholar ani arXiv.",
  },
  cs: {
    title: "Akademický konektor & Kontrola citací",
    subtitle: "Ověření citovaných zdrojů přes Semantic Scholar / arXiv a normu ISO 690",
    clean: "Všechny ověřované citace splňují základní požadavky.",
    searchTitle: "Ověřit / Vyhledat akademický zdroj:",
    searchPlaceholder: "Zadejte název článku, DOI nebo arXiv ID...",
    searchBtn: "Hledat",
    noResults: "Nebyly nalezeny žádné záznamy v Semantic Scholar ani arXiv.",
  },
  en: {
    title: "Academic Connector & Citation Audit",
    subtitle: "Verification of cited references via Semantic Scholar / arXiv and ISO 690 standards",
    clean: "All verified citations meet the required criteria.",
    searchTitle: "Verify / Search Academic Literature:",
    searchPlaceholder: "Enter paper title, DOI, or arXiv ID...",
    searchBtn: "Search",
    noResults: "No records found on Semantic Scholar or arXiv.",
  },
}

export function CitationIssuesPanel({ issues, lang, workspaceId }: Props) {
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<AcademicPaperResult[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [importedKeys, setImportedKeys] = useState<Set<string>>(new Set())
  const [isImporting, setIsImporting] = useState<string | null>(null)

  const editorStore = useEditorStoreInstance()
  const t = LABELS[lang]

  const handleSearch = async () => {
    if (!searchQuery.trim() || isSearching) return
    setIsSearching(true)
    setHasSearched(true)
    try {
      const res = await fetch("/api/academic/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery.trim(), limit: 4 }),
      })
      if (res.ok) {
        const data = await res.json()
        setSearchResults(data.results ?? [])
      } else {
        setSearchResults([])
      }
    } catch {
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleCopyCitation = (paper: AcademicPaperResult, idx: number) => {
    const authors = paper.authors.join(", ")
    const cit = `${authors} (${paper.year ?? "n.d."}). ${paper.title}.${paper.doi ? ` DOI: ${paper.doi}` : paper.url ? ` URL: ${paper.url}` : ""}`
    navigator.clipboard.writeText(cit)
    setCopiedId(String(idx))
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleImportBib = async (paper: AcademicPaperResult, idx: number) => {
    const entry = academicPaperToBibEntry(paper)
    setIsImporting(String(idx))
    try {
      await editorStore.getState().addBibEntry(entry)
      setImportedKeys((prev) => new Set([...prev, entry.key]))
    } catch (err) {
      console.error("[CitationIssuesPanel] Failed to import BibTeX entry:", err)
    } finally {
      setIsImporting(null)
    }
  }

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">{t.title}</h3>
        </div>
        {issues.length > 0 ? (
          <Badge
            variant="outline"
            className="bg-warning/15 text-warning border-warning/40 dark:bg-warning/20 dark:text-warning text-xs font-semibold"
          >
            {issues.length} {lang === "sk" ? "pripomienok" : lang === "cs" ? "připomínek" : "issues"}
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="bg-success/15 text-success border-success/40 dark:bg-success/20 dark:text-success text-xs font-semibold"
          >
            ISO 690 OK
          </Badge>
        )}
      </div>

      <p className="text-xs text-muted-foreground">{t.subtitle}</p>

      {/* Issues list */}
      {issues.length === 0 ? (
        <div className="flex items-center gap-2 rounded-md bg-success/10 p-3 text-xs text-success dark:bg-success/20 dark:text-success border border-success/40 dark:border-success/50">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
          <span className="font-medium">{t.clean}</span>
        </div>
      ) : (
        <div className="space-y-2">
          {issues.map((issue, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 p-2.5 text-xs text-warning dark:border-warning/40 dark:bg-warning/10 dark:text-warning"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 text-warning mt-0.5" />
              <div className="flex-1 whitespace-pre-wrap leading-relaxed">{issue}</div>
            </div>
          ))}
        </div>
      )}



      {/* Live Academic Search & Verification box */}
      <div className="pt-2 border-t space-y-2.5">
        <span className="text-xs font-medium text-muted-foreground block">
          {t.searchTitle}
        </span>
        <div className="flex gap-2">
          <Input
            placeholder={t.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="text-xs h-8"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault()
                handleSearch()
              }
            }}
          />
          <Button
            size="sm"
            onClick={handleSearch}
            disabled={!searchQuery.trim() || isSearching}
            className="h-8 text-xs gap-1 shrink-0"
          >
            {isSearching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
            {t.searchBtn}
          </Button>
        </div>

        {/* Search results */}
        {hasSearched && (
          <div className="space-y-2 pt-1">
            {searchResults.length > 0 ? (
              <div className="grid gap-2">
                {searchResults.map((paper, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-md border bg-muted/20 hover:bg-muted/40 transition-colors text-xs space-y-1"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-foreground leading-snug">
                        {paper.title}
                      </span>
                      <Badge variant="outline" className="text-[10px] uppercase font-mono h-4 shrink-0">
                        {paper.source}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                      <span>{paper.authors.slice(0, 3).join(", ")}{paper.authors.length > 3 ? " et al." : ""}</span>
                      {paper.year && <span>• {paper.year}</span>}
                      {paper.citationCount != null && (
                        <span>• {paper.citationCount} cit.</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      {paper.doi && (
                        <a
                          href={`https://doi.org/${paper.doi}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-info hover:underline inline-flex items-center gap-1 font-mono"
                        >
                          DOI:{paper.doi.slice(0, 24)}...
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                      {paper.arxivId && (
                        <a
                          href={paper.url || `https://arxiv.org/abs/${paper.arxivId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-warning hover:underline inline-flex items-center gap-1 font-mono"
                        >
                          arXiv:{paper.arxivId}
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}

                      <div className="ml-auto flex items-center gap-1.5 shrink-0">
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => handleCopyCitation(paper, idx)}
                          className="h-5 text-[10px] gap-1 px-1.5"
                        >
                          {copiedId === String(idx) ? (
                            <>
                              <Check className="h-2.5 w-2.5 text-success" />
                              {lang === "sk" ? "Skopírované" : "Copied"}
                            </>
                          ) : (
                            <>
                              <Copy className="h-2.5 w-2.5" />
                              {lang === "sk" ? "Citácia" : "Copy Cite"}
                            </>
                          )}
                        </Button>

                        <Button
                          size="xs"
                          variant={importedKeys.has(academicPaperToBibEntry(paper).key) ? "outline" : "secondary"}
                          onClick={() => handleImportBib(paper, idx)}
                          disabled={importedKeys.has(academicPaperToBibEntry(paper).key) || isImporting === String(idx)}
                          className="h-5 text-[10px] gap-1 px-1.5"
                        >
                          {isImporting === String(idx) ? (
                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                          ) : importedKeys.has(academicPaperToBibEntry(paper).key) ? (
                            <>
                              <Check className="h-2.5 w-2.5 text-success" />
                              {lang === "sk" ? "V .bib" : lang === "cs" ? "V .bib" : "In .bib"}
                            </>
                          ) : (
                            <>
                              <Plus className="h-2.5 w-2.5" />
                              {lang === "sk" ? "+ Do .bib" : lang === "cs" ? "+ Do .bib" : "+ To .bib"}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic py-1">
                {t.noResults}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
