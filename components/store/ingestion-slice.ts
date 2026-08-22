import { toast } from "sonner"
import type { EditorSlice, IngestionSlice } from "./types"
import { detectMethod, type ParseLogEntry, type IngestFile } from "@/lib/ingestion"
import type { ExtractedAsset as Asset } from "@/lib/ingestion"
import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval"

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

const activeIntervals = new Map<string, ReturnType<typeof setInterval>>()

export const createIngestionSlice: EditorSlice<IngestionSlice> = (set, get) => {
  return {
    ingestionOpen: false,
    parseLog: [],

    pushLog: (level, message) => {
      set((s) => {
        s.parseLog.push(makeLog(level, message))
      })
      const status = level === "error" ? "error" : level === "warning" ? "warning" : "done"
      get().pushEvent({
        kind: "info",
        status,
        title: "Ingestion",
        detail: message,
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
        await idbSet(`file_${fileMeta.id}`, f)
        get().processFile(fileMeta.id)
      })
      toast.info(`Uploading ${created.length} file${created.length === 1 ? "" : "s"}...`)
    },

    processFile: async (id) => {
      const f = await idbGet<File>(`file_${id}`)
      if (!f) return
      
      const existingInterval = activeIntervals.get(id)
      if (existingInterval) clearInterval(existingInterval)
      activeIntervals.delete(id)
      
      get().pushLog("info", `Parsing ${f.name} via MinerU backend.`)
      
      const statuses = [
        "Layout Predict",
        "Table orientation",
        "External Layout Extraction",
        "MFR Predict",
        "OCR-det",
        "Processing pages",
        "OCR-rec Predict",
        "Generating captions"
      ]
      let statusIdx = 0
      const simInterval = setInterval(() => {
        if (statusIdx < statuses.length) {
          get().pushLog("info", `[MinerU] ${statuses[statusIdx]}...`)
          set((s) => {
            const ingestFile = s.project.ingestFiles.find((x) => x.id === id)
            if (ingestFile && ingestFile.status === "parsing") {
              ingestFile.progress = 15 + (statusIdx / statuses.length) * 80
            }
          })
          statusIdx++
        } else {
          clearInterval(simInterval)
          activeIntervals.delete(id)
        }
      }, 3000)
      activeIntervals.set(id, simInterval)

      try {
        const formData = new FormData()
        formData.append("file", f)
        formData.append("fileId", id)
        
        const existingFilenames = get().project.assets.map((a: Asset) => a.filename)
        formData.append("existingAssets", JSON.stringify(existingFilenames))

        const workspaceId = get().project.id
        const res = await fetch(`/api/ingestion/parse?workspaceId=${workspaceId}`, {
          method: "POST",
          body: formData
        })
        
        clearInterval(simInterval)
        activeIntervals.delete(id)

        if (!res.ok) {
           const errData = await res.json().catch(() => ({}))
           throw new Error(errData.detail || errData.error || `HTTP ${res.status}`)
        }
        const data = await res.json()
        const produced = data.assets || []
        
        set((s) => {
          const ingestFile = s.project.ingestFiles.find((x) => x.id === id)
          if (ingestFile) {
            ingestFile.status = "done"
            ingestFile.progress = 100
          }
          const typedAssets = produced.map((a: Partial<Asset>) => ({
            ...a, 
            fileId: id, 
            confidence: "high"
          }))
          
          typedAssets.forEach((newAsset: any) => {
            const existingIndex = s.project.assets.findIndex((existing: Asset) => existing.filename === newAsset.filename)
            if (existingIndex >= 0) {
              // Update fileId so it links to the current upload, and preserve original id
              s.project.assets[existingIndex] = {
                ...s.project.assets[existingIndex],
                ...newAsset,
                id: s.project.assets[existingIndex].id
              }
            } else {
              s.project.assets.push(newAsset)
            }
          })
        })
        await idbDel(`file_${id}`)
        get().pushLog("info", `${f.name} parsed successfully. ${produced.length} assets extracted.`)
        toast.success(`Parsed ${f.name}`)
      } catch (err) {
        clearInterval(simInterval)
        activeIntervals.delete(id)
        // Keep file in idb-keyval in case user wants to retry
        set((s) => {
          const ingestFile = s.project.ingestFiles.find((x) => x.id === id)
          if (ingestFile) {
            ingestFile.status = "failed"
            ingestFile.progress = 100
            ingestFile.error = String(err)
          }
        })
        get().pushLog("error", `Failed to parse ${f.name}: ${String(err)}`)
        toast.error(`Failed to parse ${f.name}`)
      }
    },

    retryFile: async (id) => {
      const f = await idbGet<File>(`file_${id}`)
      if (!f) {
        toast.error("File no longer available in memory. Please re-upload.")
        return
      }
      set((s) => {
        const f = s.project.ingestFiles.find((f) => f.id === id)
        if (f) { f.status = "parsing"; f.progress = 10; f.error = undefined }
      })
      get().pushLog("info", `Retrying parse for file ${id}.`)
      get().processFile(id)
    },

    removeFile: async (id) => {
      await idbDel(`file_${id}`)
      set((s) => {
        s.project.ingestFiles = s.project.ingestFiles.filter((f) => f.id !== id)
        // Also remove assets produced by this file
        s.project.assets = s.project.assets.filter((a) => a.fileId !== id)
      })
      toast.success("File removed")
      get().saveProject()
    },

    dismissFile: (id) => {
      set((s) => {
        const f = s.project.ingestFiles.find((f) => f.id === id)
        if (f) f.dismissed = true
      })
      get().saveProject()
    },

    updateAssetUrl: (assetId, newUrl) => {
      set((s) => {
        const a = s.project.assets.find((a) => a.id === assetId)
        if (a) {
          a.url = newUrl
          a.thumbnailUrl = newUrl
        }
      })
      get().saveProject()
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

    removeAllLegacyAssets: () => {
      set((s) => {
        const fileIds = new Set(s.project.ingestFiles.map(f => f.id))
        s.project.assets = s.project.assets.filter(a => a.fileId && fileIds.has(a.fileId))
      })
      toast.success("Other assets removed")
      get().saveProject()
    },

    discardAsset: (assetId) => {
      set((s) => {
        s.project.assets = s.project.assets.filter((a) => a.id !== assetId)
      })
      toast.success("Asset discarded")
      get().saveProject()
    },
  }
}
