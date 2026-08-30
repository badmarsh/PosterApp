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

import { useState, useEffect, useCallback, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
} from "lucide-react"

interface ChunkDocument {
  documentId: string
  name: string
  chunkCount: number
  embeddedCount: number
  avgTokens: number
  lastIngestedAt: string
}

interface RagStats {
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
  /** Called after a successful refresh so parent can react */
  onRefresh?: () => void
}

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
  const [docsExpanded, setDocsExpanded] = useState(false)

  const loadStats = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/thesis-review/rag-stats`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setStats(await res.json())
      onRefresh?.()
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
      await loadStats()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Indexovanie zlyhalo")
    } finally {
      setIsReindexing(false)
    }
  }, [workspaceId, loadStats])

  useEffect(() => {
    if (expanded) loadStats()
  }, [expanded, loadStats])

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
        <Badge variant="outline" className="text-[10px] text-muted-foreground gap-1">
          <AlertCircle className="h-2.5 w-2.5" />
          Žiadne chunky
        </Badge>
      )
    if (!stats.hnswIndexReady)
      return (
        <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 gap-1">
          <AlertCircle className="h-2.5 w-2.5" />
          Index sa buduje
        </Badge>
      )
    return (
      <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 gap-1">
        <CheckCircle2 className="h-2.5 w-2.5" />
        {stats.totalChunks} chunkov · HNSW ✓
      </Badge>
    )
  }

  return (
    <div className="rounded-lg border bg-card text-sm">
      {/* Header — always visible, acts as toggle */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-muted/40 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary shrink-0" />
          <span className="font-medium text-xs">Vektorový index (RAG)</span>
          <div className="ml-1">{statusBadge()}</div>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {isLoading && <RefreshCw className="h-3 w-3 animate-spin" />}
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t px-3 pb-3 pt-2.5 space-y-3">
          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Stats grid */}
          {stats && (
            <>
              <div className="grid grid-cols-3 gap-2">
                <StatCard
                  icon={<Layers className="h-3.5 w-3.5 text-primary" />}
                  label="Chunky"
                  value={stats.totalChunks}
                  sub={`${stats.totalEmbedded} embedded`}
                />
                <StatCard
                  icon={<FileText className="h-3.5 w-3.5 text-primary" />}
                  label="Dokumenty"
                  value={stats.totalDocuments}
                  sub="indexovaných"
                />
                <StatCard
                  icon={<Cpu className="h-3.5 w-3.5 text-primary" />}
                  label="Avg. tokeny"
                  value={stats.avgTokensPerChunk}
                  sub="na chunk"
                />
              </div>

              {/* Model info */}
              <div className="rounded-md bg-muted/40 px-2.5 py-2 space-y-1 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Embedding model</span>
                  <span className="font-mono text-[10px] truncate max-w-[160px]">
                    {stats.embeddingModel.split("/").pop()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Dimenzia</span>
                  <span className="font-mono text-[10px]">{stats.embeddingDimensions}D</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">HNSW index</span>
                  {stats.hnswIndexReady ? (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Aktívny
                    </span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400">Nie je vytvorený</span>
                  )}
                </div>
              </div>

              {/* Per-document breakdown */}
              {stats.documents.length > 0 && (
                <div className="space-y-1.5">
                  <button
                    onClick={() => setDocsExpanded((v) => !v)}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {docsExpanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    Prehľad dokumentov ({stats.documents.length})
                  </button>

                  {docsExpanded && (
                    <div className="space-y-1.5 pt-0.5">
                      {stats.documents.map((doc) => {
                        const pct =
                          doc.chunkCount > 0
                            ? Math.round((doc.embeddedCount / doc.chunkCount) * 100)
                            : 0
                        return (
                          <div key={doc.documentId} className="space-y-0.5">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="truncate max-w-[180px] font-medium" title={doc.name}>
                                {doc.name}
                              </span>
                              <span className="text-muted-foreground shrink-0">
                                {doc.chunkCount} chunkov · {doc.avgTokens} tok/ch
                              </span>
                            </div>
                            {/* Embedding progress bar */}
                            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <div className="text-[9px] text-muted-foreground">
                              {pct}% embedded ·{" "}
                              {new Date(doc.lastIngestedAt).toLocaleDateString("sk-SK")}
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
          <div className="space-y-2 pt-1 border-t">
            <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <Zap className="h-3 w-3 text-primary" />
              Testovací hybridný search
            </p>
            <div className="flex gap-1.5">
              <Input
                className="h-7 text-xs flex-1"
                placeholder="Napíšte testovaciu otázku…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) handleSearch()
                }}
              />
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-xs gap-1 shrink-0"
                onClick={handleSearch}
                disabled={isSearching || searchQuery.trim().length < 3 || stats?.totalChunks === 0}
              >
                {isSearching ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  <Search className="h-3 w-3" />
                )}
                Hľadať
              </Button>
            </div>

            {searchError && (
              <p className="text-[11px] text-destructive">{searchError}</p>
            )}

            {stats?.totalChunks === 0 && (
              <p className="text-[11px] text-muted-foreground italic">
                Žiadny dokument nie je zatiaľ vektorizovaný. Nahrajte PDF cez ingestion panel.
              </p>
            )}

            {searchResults.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground">
                  Top {searchResults.length} výsledkov (70% vektorové + 30% FTS):
                </p>
                {searchResults.map((r, i) => (
                  <div
                    key={r.id}
                    className="rounded-md border bg-muted/30 px-2.5 py-2 space-y-1"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                          #{i + 1}
                        </span>
                        {r.heading && (
                          <span className="text-[11px] font-semibold truncate" title={r.heading}>
                            {r.heading}
                          </span>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[9px] shrink-0 tabular-nums ${
                          r.similarity >= 0.8
                            ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                            : r.similarity >= 0.6
                            ? "border-amber-500 text-amber-600 dark:text-amber-400"
                            : ""
                        }`}
                      >
                        {(r.similarity * 100).toFixed(1)}%
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">
                      {r.snippet}
                      {r.snippet.length >= 300 && "…"}
                    </p>
                    {r.tokens && (
                      <p className="text-[9px] text-muted-foreground/60">{r.tokens} tokenov</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Refresh button */}
          <Button
            size="sm"
            variant="ghost"
            className="w-full h-7 text-xs text-muted-foreground gap-1.5"
            onClick={loadStats}
            disabled={isLoading}
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
            Obnoviť štatistiky
          </Button>

          {/* Re-index button — triggers full re-embedding of all workspace documents */}
          <Button
            size="sm"
            variant="outline"
            className="w-full h-7 text-xs gap-1.5"
            onClick={handleReindex}
            disabled={isReindexing || isLoading}
          >
            {isReindexing ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : (
              <Database className="h-3 w-3" />
            )}
            {stats?.totalChunks === 0 ? "Indexovať dokumenty" : "Preindexovať znova"}
          </Button>
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
    <div className="rounded-md border bg-muted/20 px-2.5 py-2 space-y-0.5">
      <div className="flex items-center gap-1 text-muted-foreground text-[10px]">
        {icon}
        {label}
      </div>
      <p className="text-base font-bold tabular-nums leading-tight">{value.toLocaleString()}</p>
      <p className="text-[9px] text-muted-foreground">{sub}</p>
    </div>
  )
}
