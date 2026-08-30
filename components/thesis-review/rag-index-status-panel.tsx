"use client"

/**
 * RagIndexStatusPanel — diagnostic panel for the pgvector RAG pipeline.
 *
 * Displays:
 *  - Total indexed chunks and documents
 *  - Embedding model info
 *  - HNSW index readiness
 *  - Per-document breakdown with progress bars
 *  - Live hybrid search preview (type a query → see top-5 RAG results)
 */

import { useState, useEffect, useCallback, useRef, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { pluralizeSk } from "@/lib/utils"
import { formatDocumentDisplayName } from "@/lib/ingestion"
import {
  Database,
  Layers,
  Search,
  Zap,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  FileText,
  Cpu,
  Sparkles,
} from "lucide-react"

interface ChunkDocument {
  documentId: string
  name: string
  detectedTopic?: string | null
  chunkCount: number
  embeddedCount: number
  avgTokens: number
  lastIngestedAt: string
}

export interface RagStats {
  workspaceId: string
  totalChunks: number
  totalEmbedded: number
  totalDocuments: number
  avgTokensPerChunk: number
  hnswIndexReady: boolean
  embeddingModel: string
  embeddingDimensions: number
  documents: ChunkDocument[]
}

interface SearchResult {
  id: string
  heading: string | null
  snippet: string
  similarity: number
  tokens: number | null
}

interface Props {
  workspaceId: string
  /** Called after a successful refresh with the freshly fetched stats, so
   *  parent components (e.g. the workflow stepper) can mirror the real
   *  index state instead of hardcoding it. */
  onRefresh?: (stats: RagStats) => void
}

// Client-side cache for RAG index diagnostics (60s TTL)
const ragStatsCache = new Map<string, { data: RagStats; fetchedAt: number }>()
const RAG_CACHE_TTL_MS = 60_000

export function RagIndexStatusPanel({ workspaceId, onRefresh }: Props) {
  const [stats, setStats] = useState<RagStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [isReindexing, setIsReindexing] = useState(false)

  // Live search state
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, startSearchTransition] = useTransition()
  const [searchError, setSearchError] = useState<string | null>(null)
  const [docsExpanded, setDocsExpanded] = useState(true)

  const loadStats = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = ragStatsCache.get(workspaceId)
      if (cached && Date.now() - cached.fetchedAt < RAG_CACHE_TTL_MS) {
        setStats(cached.data)
        onRefresh?.(cached.data)
        return
      }
    }

    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/thesis-review/rag-stats`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: RagStats = await res.json()
      ragStatsCache.set(workspaceId, { data, fetchedAt: Date.now() })
      setStats(data)
      onRefresh?.(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nepodarilo sa načítať RAG štatistiky")
    } finally {
      setIsLoading(false)
    }
  }, [workspaceId, onRefresh])

  const handleReindex = useCallback(async () => {
    setIsReindexing(true)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/thesis-review/reindex`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      const totalChunks = (data.results as Array<{ chunks: number }> ?? []).reduce((s, r) => s + r.chunks, 0)
      toast.success(`Indexovanie dokončené: ${data.indexed} dokumentov, ${totalChunks} chunkov`)
      ragStatsCache.delete(workspaceId)
      await loadStats(true)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Indexovanie zlyhalo")
    } finally {
      setIsReindexing(false)
    }
  }, [workspaceId, loadStats])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  // Fire-and-forget chunk embedding runs shortly *after* PDF parsing finishes
  // server-side (app/api/ingestion/parse/route.ts's setImmediate callback),
  // so the very first stats fetch above can legitimately land before it's
  // done. Rather than leaving this panel — and the workflow stepper reading
  // its onRefresh output — stuck showing zero chunks until the reviewer
  // manually clicks refresh, retry on a short bounded schedule.
  const pollAttemptsRef = useRef(0)
  useEffect(() => {
    if (!stats || stats.totalChunks > 0) {
      pollAttemptsRef.current = 0
      return
    }
    if (pollAttemptsRef.current >= 8) return
    const timer = setTimeout(() => {
      pollAttemptsRef.current += 1
      loadStats(true)
    }, 5000)
    return () => clearTimeout(timer)
  }, [stats, loadStats])

  const handleSearch = useCallback(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 3) return
    setSearchError(null)
    startSearchTransition(async () => {
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/thesis-review/rag-stats`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: searchQuery.trim() }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error ?? `HTTP ${res.status}`)
        }
        const data = await res.json()
        setSearchResults(data.results ?? [])
      } catch (e) {
        setSearchError(e instanceof Error ? e.message : "Search failed")
        setSearchResults([])
      }
    })
  }, [workspaceId, searchQuery])

  // Status indicator pill
  const statusBadge = () => {
    if (!stats) return null
    if (stats.totalChunks === 0)
      return (
        <Badge variant="outline" className="text-xs text-muted-foreground gap-1.5 py-0.5 px-2 font-normal">
          <AlertCircle className="h-3 w-3 text-amber-500" />
          Žiadne chunky
        </Badge>
      )
    if (!stats.hnswIndexReady)
      return (
        <Badge variant="outline" className="text-xs text-amber-600 dark:text-amber-400 gap-1.5 py-0.5 px-2 font-normal">
          <AlertCircle className="h-3 w-3" />
          Index sa buduje
        </Badge>
      )
    return (
      <Badge variant="outline" className="text-xs text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5 gap-1.5 py-0.5 px-2.5 font-medium">
        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
        {stats.totalChunks} {pluralizeSk(stats.totalChunks, "chunk", "chunky", "chunkov")} · {stats.totalDocuments} {pluralizeSk(stats.totalDocuments, "dokument", "dokumenty", "dokumentov")} · HNSW ✓
      </Badge>
    )
  }

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-2xs overflow-hidden transition-all">
      {/* Header — toggleable card header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/20 hover:bg-muted/30 transition-colors">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls="rag-index-details"
          className="flex items-center gap-2.5 text-left flex-1 min-w-0 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-md py-0.5"
        >
          <div className="p-1.5 rounded-md bg-[#8B2635]/10 text-[#8B2635] dark:text-[#E06D7B]">
            <Database className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-xs text-foreground">Vektorový index (RAG)</span>
              {statusBadge()}
            </div>
            {!expanded && stats && stats.totalChunks > 0 ? (
              <p className="text-[11px] text-muted-foreground truncate">
                {stats.embeddingModel.split("/").pop()} · {stats.embeddingDimensions}D · Kliknite pre podrobnosti a testovacie vyhľadávanie
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground truncate">
                Sémantický pgvector index s HNSW pre ukotvenie posudku a vyhľadávanie
              </p>
            )}
          </div>
        </button>

        <div className="flex items-center gap-1 shrink-0 ml-2">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => loadStats(true)}
            disabled={isLoading}
            title="Obnoviť štatistiky"
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
          </Button>

          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls="rag-index-details"
            title={expanded ? "Zbaliť podrobnosti RAG" : "Rozbaliť podrobnosti RAG"}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div id="rag-index-details" className="p-4 space-y-4 border-t">
          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Stats grid */}
          {stats && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <StatCard
                  icon={<Layers className="h-4 w-4 text-[#8B2635] dark:text-[#E06D7B]" />}
                  label="Chunky v databáze"
                  value={stats.totalChunks}
                  sub={`${stats.totalEmbedded} vektorovo zaindexovaných`}
                />
                <StatCard
                  icon={<FileText className="h-4 w-4 text-[#8B2635] dark:text-[#E06D7B]" />}
                  label="Zdrojové dokumenty"
                  value={stats.totalDocuments}
                  sub={`${stats.totalDocuments} ${pluralizeSk(stats.totalDocuments, "indexovaný súbor", "indexované súbory", "indexovaných súborov")}`}
                />
                <StatCard
                  icon={<Cpu className="h-4 w-4 text-[#8B2635] dark:text-[#E06D7B]" />}
                  label="Priemerná dĺžka"
                  value={stats.avgTokensPerChunk}
                  sub="tokenov na chunk"
                />
              </div>

              {/* Model & index info banner */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-lg border bg-muted/30 p-3 text-xs">
                <div className="space-y-0.5">
                  <span className="text-muted-foreground text-[11px] block">Embedding model</span>
                  <span className="font-mono font-medium text-foreground text-xs">
                    {stats.embeddingModel.split("/").pop()}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-muted-foreground text-[11px] block">Vektorová dimenzia</span>
                  <span className="font-mono font-medium text-foreground text-xs">{stats.embeddingDimensions}D (Dense)</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-muted-foreground text-[11px] block">Stav indexu</span>
                  {stats.hnswIndexReady ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> HNSW aktívny
                    </span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" /> Index sa buduje
                    </span>
                  )}
                </div>
              </div>

              {/* Per-document breakdown */}
              {stats.documents.length > 0 && (
                <div className="rounded-lg border bg-card p-3 space-y-2.5">
                  <button
                    onClick={() => setDocsExpanded((v) => !v)}
                    className="flex items-center justify-between w-full text-xs font-semibold text-foreground hover:text-primary transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-primary" />
                      Prehľad indexovaných dokumentov ({stats.documents.length})
                    </span>
                    {docsExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </button>

                  {docsExpanded && (
                    <div className="space-y-2.5 pt-1">
                      {stats.documents.map((doc) => {
                        const pct =
                          doc.chunkCount > 0
                            ? Math.round((doc.embeddedCount / doc.chunkCount) * 100)
                            : 0
                        return (
                          <div key={doc.documentId} className="rounded-lg bg-muted/30 p-3 space-y-2 border">
                            <div className="flex items-start justify-between text-xs gap-2">
                              <div className="space-y-0.5 min-w-0 flex-1">
                                <span className="font-semibold text-xs text-foreground truncate block" title={doc.detectedTopic || doc.name}>
                                  {formatDocumentDisplayName(doc.name, doc.detectedTopic)}
                                </span>
                                {doc.name !== formatDocumentDisplayName(doc.name, doc.detectedTopic) && (
                                  <span className="text-[10px] text-muted-foreground font-mono block truncate" title={doc.name}>
                                    {doc.name}
                                  </span>
                                )}
                              </div>
                              <Badge variant="secondary" className="text-[10px] font-mono shrink-0">
                                {doc.chunkCount} {pluralizeSk(doc.chunkCount, "chunk", "chunky", "chunkov")} · ~{doc.avgTokens} tok/ch
                              </Badge>
                            </div>
                            {/* Embedding progress bar */}
                            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-[#8B2635] transition-all duration-300"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                              <span>{pct}% zaindexované</span>
                              <span>Aktualizované: {new Date(doc.lastIngestedAt).toLocaleDateString("sk-SK")}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Live hybrid search preview */}
          <div className="rounded-lg border bg-card p-3.5 space-y-3">
            <div className="flex items-start gap-2.5 rounded-lg border border-[#8B2635]/20 bg-[#8B2635]/5 p-2.5 text-xs text-foreground">
              <Zap className="h-4 w-4 text-[#8B2635] dark:text-[#E06D7B] shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1 space-y-0.5">
                <span className="font-semibold text-xs text-foreground block">
                  Testovacie hybridné vyhľadávanie (70% Cosine + 30% FTS)
                </span>
                <p className="text-[11px] text-muted-foreground">
                  Overte relevanciu RAG extrakcie pred generovaním
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="h-9 pl-8 text-xs"
                  placeholder="Napíšte testovaciu otázku (napr. metodika merania, ciele práce, závery)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) handleSearch()
                  }}
                />
              </div>
              <Button
                size="sm"
                className="h-9 px-4 text-xs gap-1.5 shrink-0 bg-[#8B2635] hover:bg-[#741E2B] text-white shadow-xs font-semibold transition-colors"
                onClick={handleSearch}
                disabled={isSearching || searchQuery.trim().length < 3 || stats?.totalChunks === 0}
              >
                {isSearching ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Vyhľadať
              </Button>
            </div>

            {searchError && (
              <p className="text-xs text-destructive">{searchError}</p>
            )}

            {stats?.totalChunks === 0 && (
              <p className="text-xs text-muted-foreground italic py-1">
                Žiadny dokument nie je zatiaľ vektorizovaný. Nahrajte PDF cez Ingestion panel v hornej lište.
              </p>
            )}

            {searchResults.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-[11px] font-medium text-muted-foreground">
                  Top {searchResults.length} najrelevantnejších úryvkov:
                </p>
                <div className="space-y-2">
                  {searchResults.map((r, i) => (
                    <div
                      key={r.id}
                      className="rounded-lg border bg-muted/20 p-3 space-y-1.5 hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 shrink-0">
                            #{i + 1}
                          </Badge>
                          {r.heading ? (
                            <span className="text-xs font-semibold truncate text-foreground" title={r.heading}>
                              {r.heading}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Bez nadpisu</span>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-semibold shrink-0 tabular-nums px-2 py-0.5 ${
                            r.similarity >= 0.8
                              ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/10 dark:text-emerald-400"
                              : r.similarity >= 0.6
                              ? "border-amber-500/40 text-amber-600 bg-amber-500/10 dark:text-amber-400"
                              : "border-muted-foreground/30 text-muted-foreground"
                          }`}
                        >
                          {(r.similarity * 100).toFixed(1)}% zhoda
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                        {r.snippet}
                        {r.snippet.length >= 300 && "…"}
                      </p>
                      {r.tokens && (
                        <p className="text-[10px] text-muted-foreground/60 font-mono">{r.tokens} tokenov</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action footer */}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1.5"
              onClick={() => loadStats(true)}
              disabled={isLoading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Obnoviť stav
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5"
              onClick={handleReindex}
              disabled={isReindexing || isLoading}
            >
              {isReindexing ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
              ) : (
                <Database className="h-3.5 w-3.5 text-primary" />
              )}
              {stats?.totalChunks === 0 ? "Indexovať dokumenty" : "Preindexovať dokumenty"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-component
// ---------------------------------------------------------------------------

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode
  label: string
  value: number
  sub: string
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-xl font-bold tabular-nums tracking-tight text-foreground leading-tight">
        {value.toLocaleString()}
      </p>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </div>
  )
}
