import { toast } from "sonner"
import type { EditorSlice, IngestionSlice } from "./types"
import { detectMethod, type ParseLogEntry, type IngestFile } from "@/lib/ingestion"
import type { ExtractedAsset as Asset } from "@/lib/ingestion"
import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval"
import { jobQueue } from "@/lib/job-queue"
import { apiFetch } from "@/lib/api-fetch"

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
const activeJobs = new Map<string, string>()

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
      
      const jobId = jobQueue.enqueue(`Parse ${f.name}`, async (onProgress, signal) => {
        const existingInterval = activeIntervals.get(id)
        if (existingInterval) clearInterval(existingInterval)
        activeIntervals.delete(id)
        
        const capturedWorkspaceId = get().project.id
        
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
            if (get().project.id === capturedWorkspaceId) {
              get().pushLog("info", `[MinerU] ${statuses[statusIdx]}...`)
              set((s) => {
                const ingestFile = s.project.ingestFiles.find((x) => x.id === id)
                if (ingestFile && ingestFile.status === "parsing") {
                  const prog = 15 + (statusIdx / statuses.length) * 80
                  ingestFile.progress = prog
                  onProgress(prog)
                }
              })
            }
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
          const res = await apiFetch(`/api/ingestion/parse?workspaceId=${workspaceId}`, {
            method: "POST",
            body: formData,
            signal
          })
          
          clearInterval(simInterval)
          activeIntervals.delete(id)

          if (!res.ok) {
             const errData = await res.json().catch(() => ({}))
             throw new Error(errData.detail || errData.error || `HTTP ${res.status}`)
          }
          const data = await res.json()
          const produced = data.assets || []
          
          if (get().project.id === capturedWorkspaceId) {
            set((s) => {
              const ingestFile = s.project.ingestFiles.find((x) => x.id === id)
              if (ingestFile) {
                ingestFile.status = "done"
                ingestFile.progress = 100
                onProgress(100)
              }
              const typedAssets = produced.map((a: Partial<Asset>) => ({
                ...a, 
                fileId: id, 
                confidence: "high"
              }))
              
              typedAssets.forEach((newAsset: any) => {
                const existingIndex = s.project.assets.findIndex((existing: Asset) => existing.filename === newAsset.filename)
                if (existingIndex >= 0) {
                  s.project.assets[existingIndex] = { ...s.project.assets[existingIndex], ...newAsset }
                } else {
                  s.project.assets.push(newAsset)
                }
              })
              s.isDirty = true
            })
            toast.success(`${f.name} parsed successfully`)
            get().pushLog("info", `${f.name} parsed, ${produced.length} assets extracted.`)
          }
        } catch (err) {
          clearInterval(simInterval)
          activeIntervals.delete(id)
          
          if (err instanceof Error && err.name === "AbortError") {
            if (get().project.id === capturedWorkspaceId) {
              set((s) => {
                const ingestFile = s.project.ingestFiles.find((x) => x.id === id)
                if (ingestFile) ingestFile.status = "failed"
              })
              toast.warning(`Parsing cancelled for ${f.name}`)
              get().pushLog("error", `Parsing cancelled for ${f.name}`)
            }
            throw err
          }

          if (get().project.id === capturedWorkspaceId) {
            set((s) => {
              const ingestFile = s.project.ingestFiles.find((x) => x.id === id)
              if (ingestFile) ingestFile.status = "failed"
            })
            const msg = err instanceof Error ? err.message : String(err)
            toast.error(`Failed to parse ${f.name}`)
            get().pushLog("error", `Parse failed: ${msg}`)
          }
          throw err
        }
      })
      activeJobs.set(id, jobId)
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
      const jobId = activeJobs.get(id)
      if (jobId) {
        import("@/lib/job-queue").then(m => m.jobQueue.cancel(jobId))
        activeJobs.delete(id)
      }
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
        s.project.outputs?.forEach(output => {
          output.cards?.forEach(card => {
             card.figures?.forEach(fig => {
                // The fig.id might be fig_<assetId> or the original asset url could match. Just replace it.
                if (fig.id === `fig_${assetId}` || fig.id === assetId) {
                   fig.url = newUrl
                }
             })
          })
        })
      })
      get().saveProject()
    },

    promoteAsset: (assetId, cardId, slot) => {
      const asset = get().project.assets.find((a) => a.id === assetId)
      if (!asset) return
      set((s) => {
        const output = s.project.outputs.find((o) => o.id === s.project.activeOutputId)
        const card = output?.cards.find((c) => c.id === cardId)
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
