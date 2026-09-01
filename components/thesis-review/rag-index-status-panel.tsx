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
  Search,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  FileText,
  Share2,
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

interface GraphStatsInfo {
  nodeCount: number
  edgeCount: number
  documentsCovered: number
  topLabels: Array<{ label: string; count: number }>
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
  graphStats?: GraphStatsInfo
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
      <Badge variant="outline" className="text-[11px] font-normal text-muted-foreground border-border/70 bg-muted/40 gap-1.5 py-0.5 px-2">
        <span className="size-1.5 rounded-full bg-emerald-500/80 shrink-0 inline-block" />
        {stats.totalChunks} {pluralizeSk(stats.totalChunks, "chunk", "chunky", "chunkov")} · {stats.totalDocuments} {pluralizeSk(stats.totalDocuments, "dokument", "dokumenty", "dokumentov")} · HNSW
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
          <div className="p-1.5 rounded-md bg-muted text-muted-foreground">
            <Database className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-xs text-foreground">Vektorový index (RAG)</span>
              {statusBadge()}
            </div>
            {!expanded && stats && stats.totalChunks > 0 ? (
              <p className="text-[11px] text-muted-foreground truncate">
                {stats.embeddingModel.split("/").pop()} · {stats.embeddingDimensions}D
                {stats.graphStats && stats.graphStats.nodeCount > 0
                  ? ` · Graf: ${stats.graphStats.nodeCount} ${pluralizeSk(stats.graphStats.nodeCount, "entita", "entity", "entít")}, ${stats.graphStats.edgeCount} ${pluralizeSk(stats.graphStats.edgeCount, "vzťah", "vzťahy", "vzťahov")}`
                  : ""}
                {" · Kliknite pre podrobnosti a testovacie vyhľadávanie"}
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

          {/* Active indexed documents overview */}
          {stats && stats.documents.length > 0 && (
            <div className="rounded-xl border bg-card p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground flex items-center gap-2">
                  <FileText className="size-3.5 text-muted-foreground" />
                  Zaindexované dokumenty ({stats.documents.length})
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-[11px] gap-1.5 font-medium rounded-lg"
                  onClick={handleReindex}
                  disabled={isReindexing || isLoading}
                >
                  {isReindexing ? (
                    <RefreshCw className="size-3 animate-spin text-primary" />
                  ) : (
                    <Database className="size-3 text-primary" />
                  )}
                  {isReindexing ? "Indexujem…" : "Preindexovať"}
                </Button>
              </div>

              <div className="space-y-2">
                {stats.documents.map((doc) => {
                  const pct =
                    doc.chunkCount > 0
                      ? Math.round((doc.embeddedCount / doc.chunkCount) * 100)
                      : 0
                  return (
                    <div key={doc.documentId} className="rounded-lg bg-muted/20 p-2.5 space-y-1.5 border border-border/70">
                      <div className="flex items-center justify-between text-xs gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="font-medium text-xs text-foreground truncate block" title={doc.detectedTopic || doc.name}>
                            {formatDocumentDisplayName(doc.name, doc.detectedTopic)}
                          </span>
                        </div>
                        <Badge variant="secondary" className="text-[10px] font-mono shrink-0 px-2 py-0.5">
                          {doc.chunkCount} {pluralizeSk(doc.chunkCount, "chunk", "chunky", "chunkov")}
                        </Badge>
                      </div>
                      {/* Embedding progress bar */}
                      <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500/70 dark:bg-emerald-400/70 transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Knowledge graph (GraphRAG) overview */}
          {stats?.graphStats && stats.graphStats.nodeCount > 0 && (
            <div className="rounded-xl border bg-card p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground flex items-center gap-2">
                  <Share2 className="size-3.5 text-muted-foreground" />
                  Znalostný graf (GraphRAG)
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {stats.graphStats.documentsCovered}{" "}
                  {pluralizeSk(stats.graphStats.documentsCovered, "dokument", "dokumenty", "dokumentov")}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="text-[10px] font-mono px-2 py-0.5">
                  {stats.graphStats.nodeCount} {pluralizeSk(stats.graphStats.nodeCount, "entita", "entity", "entít")}
                </Badge>
                <Badge variant="secondary" className="text-[10px] font-mono px-2 py-0.5">
                  {stats.graphStats.edgeCount} {pluralizeSk(stats.graphStats.edgeCount, "vzťah", "vzťahy", "vzťahov")}
                </Badge>
                {stats.graphStats.topLabels.map((l) => (
                  <Badge key={l.label} variant="outline" className="text-[10px] px-2 py-0.5 text-muted-foreground">
                    {l.label}: {l.count}
                  </Badge>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Entity a vzťahy extrahované z dokumentov obohacujú posudok o multi-hop súvislosti (napr. metodika → dataset → metrika) vrátane prepojení naprieč dokumentmi.
              </p>
            </div>
          )}

          {/* Live search */}
          <div className="rounded-xl border bg-card p-3.5 space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  className="h-9 pl-8 text-xs bg-muted/20 rounded-lg"
                  placeholder="Testovacie vyhľadávanie v indexe (napr. metodika, ciele)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) handleSearch()
                  }}
                />
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="h-9 px-3.5 text-xs gap-1.5 shrink-0 font-medium rounded-lg cursor-pointer"
                onClick={handleSearch}
                disabled={isSearching || searchQuery.trim().length < 3 || stats?.totalChunks === 0}
              >
                {isSearching ? (
                  <RefreshCw className="size-3.5 animate-spin" />
                ) : (
                  <Search className="size-3.5" />
                )}
                Vyhľadať
              </Button>
            </div>

            {searchError && (
              <p className="text-xs text-destructive">{searchError}</p>
            )}

            {stats?.totalChunks === 0 && (
              <p className="text-xs text-muted-foreground italic py-1">
                Žiadny dokument nie je zatiaľ vektorizovaný. Nahrajte PDF práce pre vytvorenie indexu.
              </p>
            )}

            {searchResults.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-[11px] font-medium text-muted-foreground">
                  Nájdené úryvky ({searchResults.length}):
                </p>
                <div className="space-y-2">
                  {searchResults.map((r, i) => (
                    <div
                      key={r.id}
                      className="rounded-lg border bg-muted/20 p-3 space-y-1.5 text-xs transition-colors hover:bg-muted/30"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Badge variant="secondary" className="text-[10px] font-mono px-1 py-0">
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
                          className="text-[10px] font-semibold shrink-0 tabular-nums px-1.5 py-0 border-muted-foreground/30 text-muted-foreground"
                        >
                          {(r.similarity * 100).toFixed(0)}%
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
        </div>
      )}
    </div>
  )
}
