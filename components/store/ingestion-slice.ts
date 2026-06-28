import { toast } from "sonner"
import type { EditorSlice, IngestionSlice } from "./types"
import { detectMethod, initialParseLog, syntheticAssetsForFile, type ParseLogEntry, type IngestFile } from "@/lib/ingestion"
import type { ExtractedAsset as Asset } from "@/lib/ingestion"

function makeLog(level: ParseLogEntry["level"], message: string): ParseLogEntry {
  return {
    id: crypto.randomUUID(),
    ts: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    level,
    message,
  }
}

export const createIngestionSlice: EditorSlice<IngestionSlice> = (set, get) => {
  function advanceFile(fileId: string) {
    // queued → parsing
    window.setTimeout(() => {
      set((s) => {
        const f = s.project.ingestFiles.find((f) => f.id === fileId)
        if (f) { f.status = "parsing"; f.progress = 40 }
      })
    }, 500)
    // parsing → done
    window.setTimeout(() => {
      set((s) => {
        const file = s.project.ingestFiles.find((f) => f.id === fileId)
        if (file) {
          const produced = syntheticAssetsForFile(file)
          s.project.assets.push(...produced)
          s.pushLog(
            "info",
            `${file.name} → ${file.method} extracted ${produced.length} assets`,
          )
          file.status = "done"
          file.progress = 100
        }
      })
    }, 1700)
  }

  return {
    ingestionOpen: false,
    parseLog: initialParseLog,

    pushLog: (level, message) => {
      set((s) => {
        s.parseLog.push(makeLog(level, message))
      })
    },

    openIngestion: () => set((s) => { s.ingestionOpen = true }),
    closeIngestion: () => set((s) => { s.ingestionOpen = false }),

    uploadFiles: (files) => {
      if (!files.length) return
      const created: IngestFile[] = files.map((f) => ({
        id: `file_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        name: f.name,
        size: f.size,
        method: detectMethod(f.name),
        status: "parsing" as const,
        progress: 10,
      }))
      set((s) => { s.project.ingestFiles.unshift(...created) })
      
      files.forEach(async (f, i) => {
        const fileMeta = created[i]
        get().pushLog("info", `Parsing ${f.name} via MinerU backend.`)
        try {
          const formData = new FormData()
          formData.append("file", f)
          formData.append("fileId", fileMeta.id)
          
          const existingFilenames = get().project.assets.map((a: Asset) => a.filename)
          formData.append("existingAssets", JSON.stringify(existingFilenames))

          const workspaceId = get().project.id
          const res = await fetch(`/api/ingestion/parse?workspaceId=${workspaceId}`, {
            method: "POST",
            body: formData
          })
          
          if (!res.ok) {
             const errData = await res.json().catch(() => ({}))
             throw new Error(errData.detail || errData.error || `HTTP ${res.status}`)
          }
          const data = await res.json()
          const produced = data.assets || []
          
          set((s) => {
            const ingestFile = s.project.ingestFiles.find((x) => x.id === fileMeta.id)
            if (ingestFile) {
              ingestFile.status = "done"
              ingestFile.progress = 100
            }
            const typedAssets = produced.map((a: Partial<Asset>) => ({
              ...a, 
              fileId: fileMeta.id, 
              confidence: "high"
            }))
            
            const newAssets = typedAssets.filter((newAsset: Partial<Asset>) => 
              !s.project.assets.some((existing: Asset) => existing.filename === newAsset.filename)
            )
            
            s.project.assets.push(...newAssets)
          })
          get().pushLog("info", `${f.name} parsed successfully. ${produced.length} assets extracted.`)
          toast.success(`Parsed ${f.name}`)
        } catch (err) {
          set((s) => {
            const ingestFile = s.project.ingestFiles.find((x) => x.id === fileMeta.id)
            if (ingestFile) {
              ingestFile.status = "failed"
              ingestFile.progress = 100
              ingestFile.error = String(err)
            }
          })
          get().pushLog("error", `Failed to parse ${f.name}: ${String(err)}`)
          toast.error(`Failed to parse ${f.name}`)
        }
      })
      toast.info(`Uploading ${created.length} file${created.length === 1 ? "" : "s"}...`)
    },

    retryFile: (id) => {
      set((s) => {
        const f = s.project.ingestFiles.find((f) => f.id === id)
        if (f) { f.status = "queued"; f.progress = 0; f.error = undefined }
      })
      get().pushLog("info", `Retrying parse for file ${id}.`)
      advanceFile(id)
    },

    removeFile: (id) => set((s) => {
      s.project.ingestFiles = s.project.ingestFiles.filter((f) => f.id !== id)
      s.project.assets = s.project.assets.filter((a) => a.fileId !== id)
    }),

    applyFigureOp: async (assetId, op) => {
      get().pushLog("info", `Applied "${op}" to ${assetId} via image pipeline.`)
      await new Promise((r) => window.setTimeout(r, 900))
      set((s) => {
        const a = s.project.assets.find((a) => a.id === assetId)
        if (a && a.confidence === "low") a.confidence = "medium"
      })
    },

    promoteAsset: (assetId, cardId, slot) => {
      const asset = get().project.assets.find((a) => a.id === assetId)
      if (!asset) return
      set((s) => {
        const card = s.project.cards.find((c) => c.id === cardId)
        if (!card) return
        if (slot === "bullets" && asset.snippet) {
          const prefix = card.content.trim() ? "\n" : ""
          card.content = card.content + prefix + "- " + asset.snippet
        } else if ((slot === "figure1" || slot === "figure2") && asset.thumbnailUrl) {
          const idx = slot === "figure1" ? 0 : 1
          card.figures[idx] = {
            id: `fig_${assetId}`,
            url: asset.thumbnailUrl,
            caption: asset.caption ?? "",
          }
          card.figureLayout = card.figures.filter(Boolean).length > 1 ? "two-up" : "single"
        } else if (slot === "table" && asset.tableRows) {
          card.table = {
            hasHeader: true,
            caption: asset.caption ?? card.table.caption,
            rows: asset.tableRows,
          }
        }
        const a = s.project.assets.find((a) => a.id === assetId)
        if (a) { a.assignedCardId = cardId; a.assignedSlot = slot }
      })
      get().pushEvent({ kind: "info", status: "done", title: `Asset promoted — ${cardId}`, detail: `${asset.kind} → ${cardId} (${slot})` })
      toast.success(`Promoted to ${cardId}`)
    },

    unassignAsset: (assetId) => set((s) => {
      const a = s.project.assets.find((a) => a.id === assetId)
      if (a) { a.assignedCardId = undefined; a.assignedSlot = undefined }
    }),

    discardAsset: (assetId) => set((s) => {
      s.project.assets = s.project.assets.filter((a) => a.id !== assetId)
      toast.success("Asset discarded")
    }),
  }
}
