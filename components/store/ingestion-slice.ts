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
      set((s) => {
        s.project.ingestFiles.unshift(...created)
        s.isDirty = true
      })
      get().saveProject()
      
      files.forEach((f, i) => {
        const fileMeta = created[i]
        idbSet(`file_${fileMeta.id}`, f)
          .then(() => {
            get().processFile(fileMeta.id)
          })
          .catch((err) => {
            set((s) => {
              const ingestFile = s.project.ingestFiles.find((x) => x.id === fileMeta.id)
              if (ingestFile) {
                ingestFile.status = "failed"
                ingestFile.error = String(err)
              }
              s.isDirty = true
            })
            get().saveProject()
            get().pushLog("error", `Failed to buffer ${f.name} for parsing: ${err}`)
          })
      })
    },

    processFile: async (id) => {
      const existingJobId = activeJobs.get(id)
      if (existingJobId) {
        const existing = jobQueue.getJobs().find((j) => j.id === existingJobId)
        if (existing && (existing.status === "queued" || existing.status === "running")) {
          return
        }
      }

      const f = await idbGet<File>(`file_${id}`)
      if (!f) return
      
      const jobId = jobQueue.enqueue(`Parse ${f.name}`, async (onProgress, signal) => {
        const capturedWorkspaceId = get().project.id
        
        get().pushLog("info", `Parsing ${f.name} via MinerU backend.`)
        onProgress(10)

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
            signal,
          })

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}))
            const msg = errData.detail && errData.error && errData.detail !== errData.error
              ? `${errData.error}: ${errData.detail}`
              : (errData.detail || errData.error || `HTTP ${res.status}`)
            throw new Error(msg)
          }

          let produced: Partial<Asset>[] = []
          let completedFileName: string | undefined = undefined
          const contentType = res.headers.get("content-type") || ""

          if (contentType.includes("text/event-stream") && res.body) {
            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ""

            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              buffer += decoder.decode(value, { stream: true })
              const lines = buffer.split("\n")
              buffer = lines.pop() || ""

              for (const line of lines) {
                const trimmed = line.trim()
                if (!trimmed.startsWith("data:")) continue
                const jsonStr = trimmed.slice(5).trim()
                if (!jsonStr) continue

                try {
                  const event = JSON.parse(jsonStr)
                  if (event.type === "progress") {
                    if (event.stage && get().project.id === capturedWorkspaceId) {
                      get().pushLog("info", `[MinerU] ${event.stage}`)
                    }
                    if (typeof event.progress === "number" && get().project.id === capturedWorkspaceId) {
                      set((s) => {
                        const ingestFile = s.project.ingestFiles.find((x) => x.id === id)
                        if (ingestFile && ingestFile.status === "parsing") {
                          ingestFile.progress = event.progress
                        }
                      })
                      onProgress(event.progress)
                    }
                  } else if (event.type === "complete") {
                    produced = event.assets || []
                    if (event.fileName) {
                      completedFileName = event.fileName
                    }
                  } else if (event.type === "error") {
                    const msg = event.detail && event.error && event.detail !== event.error
                      ? `${event.error}: ${event.detail}`
                      : (event.detail || event.error || "Document parsing failed")
                    throw new Error(msg)
                  }
                } catch (parseErr: any) {
                  if (parseErr.message && (parseErr.message.includes("failed") || parseErr.message.includes("error") || parseErr.message.includes("MinerU"))) {
                    throw parseErr
                  }
                  // Ignore JSON chunk syntax errors in transit
                }
              }
            }
          } else {
            const data = await res.json().catch(() => ({}))
            produced = data.assets || []
            if (data.fileName) completedFileName = data.fileName
          }
          
          if (get().project.id === capturedWorkspaceId) {
            set((s) => {
              const ingestFile = s.project.ingestFiles.find((x) => x.id === id)
              if (ingestFile) {
                ingestFile.status = "done"
                ingestFile.progress = 100
                if (completedFileName) {
                  ingestFile.name = completedFileName
                }
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

            // Clean up PDF blob in IndexedDB on success to prevent storage leaks
            await idbDel(`file_${id}`).catch(() => undefined)
            await get().saveProject()

            if (produced.length === 0) {
              get().pushLog("warning", `${f.name} parsed, but no assets were extracted.`)
            } else {
              get().pushLog("info", `${f.name} parsed, ${produced.length} assets extracted.`)
            }
          }
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") {
            if (get().project.id === capturedWorkspaceId) {
              set((s) => {
                const ingestFile = s.project.ingestFiles.find((x) => x.id === id)
                if (ingestFile) ingestFile.status = "failed"
                s.isDirty = true
              })
              get().saveProject()
              get().pushLog("error", `Parsing cancelled for ${f.name}`)
            }
            throw err
          }

          if (get().project.id === capturedWorkspaceId) {
            const msg = err instanceof Error ? err.message : String(err)
            set((s) => {
              const ingestFile = s.project.ingestFiles.find((x) => x.id === id)
              if (ingestFile) {
                ingestFile.status = "failed"
                ingestFile.error = msg
              }
              s.isDirty = true
            })
            get().saveProject()
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
        get().pushLog("error", "File no longer available in memory. Please re-upload.")
        return
      }
      set((s) => {
        const f = s.project.ingestFiles.find((f) => f.id === id)
        if (f) { f.status = "parsing"; f.progress = 10; f.error = undefined }
        s.isDirty = true
      })
      get().saveProject()
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
      get().saveProject()
    },

    renameFile: async (id, newName) => {
      const trimmed = newName.trim()
      if (!trimmed) return
      set((s) => {
        const f = s.project.ingestFiles.find((x) => x.id === id)
        if (f) f.name = trimmed
        s.isDirty = true
      })
      try {
        const workspaceId = get().project.id
        await apiFetch(`/api/workspaces/${workspaceId}/ingest-files/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ name: trimmed }),
        })
      } catch (e) {
        console.error("Failed to persist renamed file:", e)
      }
      await get().saveProject()
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

        // ── Equation ──────────────────────────────────────────────────────
        if (asset.kind === "equation") {
          const formula = asset.snippet || asset.caption || ""
          if (slot === "equation" || slot === "bullets") {
            const formattedFormula = formula.includes("$$") || formula.includes("\\[")
              ? formula
              : `$$\n${formula}\n$$`
            const prefix = card.content.trim() ? "\n\n" : ""
            card.content = card.content + prefix + formattedFormula
          }

        // ── Table ─────────────────────────────────────────────────────────
        } else if (asset.kind === "table") {
          const parsedRows: string[][] = Array.isArray(asset.tableRows)
            ? (asset.tableRows as string[][])
            : typeof asset.tableRows === "string"
            ? (() => {
                try {
                  const p = JSON.parse(asset.tableRows as string)
                  return Array.isArray(p) ? (p as string[][]) : []
                } catch { return [] }
              })()
            : []

          if (slot === "table") {
            card.table = {
              hasHeader: card.table?.hasHeader ?? true,
              caption: asset.caption ?? card.table?.caption ?? "",
              rows: parsedRows,
            }
          } else if (slot === "bullets") {
            // Insert as markdown table into bullets content
            if (parsedRows.length > 0) {
              const header = parsedRows[0]
              const sep = header.map(() => "---")
              const body = parsedRows.slice(1)
              const mdTable = [
                `| ${header.join(" | ")} |`,
                `| ${sep.join(" | ")} |`,
                ...body.map((r) => `| ${r.join(" | ")} |`),
              ].join("\n")
              const captionLine = asset.caption ? `**${asset.caption}**\n\n` : ""
              const prefix = card.content.trim() ? "\n\n" : ""
              card.content = card.content + prefix + captionLine + mdTable
            }
          }

        // ── Figure ────────────────────────────────────────────────────────
        } else if (asset.kind === "figure") {
          if (slot === "figure1" || slot === "figure2") {
            if (!card.figures) card.figures = []
            const idx = slot === "figure1" ? 0 : 1
            while (card.figures.length <= idx) {
              card.figures.push({ id: `fig_ph_${card.figures.length}_${Date.now().toString(36)}`, url: "", caption: "" })
            }
            card.figures[idx] = {
              id: `fig_${assetId}`,
              url: asset.thumbnailUrl ?? "",
              caption: asset.caption ?? "",
            }
            card.figureLayout = card.figures.filter(f => Boolean(f?.url?.trim())).length > 1 ? "two-up" : "single"
          } else if (slot === "bullets" && asset.caption) {
            const prefix = card.content.trim() ? "\n" : ""
            card.content = card.content + prefix + `- ${asset.caption}`
          }

        // ── Text ──────────────────────────────────────────────────────────
        } else if (slot === "bullets" && asset.snippet) {
          const prefix = card.content.trim() ? "\n" : ""
          card.content = card.content + prefix + "- " + asset.snippet
        }

        const a = s.project.assets.find((a) => a.id === assetId)
        if (a) { a.assignedCardId = cardId; a.assignedSlot = slot }
      })
      get().pushEvent({ kind: "info", status: "done", title: `Asset promoted — ${cardId}`, detail: `${asset.kind} → ${cardId} (${slot})` })
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
      get().saveProject()
    },

    discardAsset: (assetId) => {
      set((s) => {
        s.project.assets = s.project.assets.filter((a) => a.id !== assetId)
      })
      get().saveProject()
    },

    backfillCaptions: async () => {
      const workspaceId = get().project.id
      if (!workspaceId) return
      get().pushLog("info", "Backfilling AI captions for workspace assets...")
      try {
        const res = await apiFetch(`/api/workspaces/${workspaceId}/assets/backfill-captions`, {
          method: "POST",
        })
        if (!res.ok) {
          throw new Error(`Backfill failed with status ${res.status}`)
        }
        const data = await res.json()
        if (Array.isArray(data.assets) && data.assets.length > 0) {
          set((s) => {
            const updateMap = new Map<string, { caption?: string; snippet?: string }>(
              data.assets.map((a: any) => [a.id, a])
            )
            for (const a of s.project.assets) {
              const u = updateMap.get(a.id)
              if (u) {
                if (u.caption) a.caption = u.caption
                if (u.snippet) a.snippet = u.snippet
              }
            }
          })
          get().saveProject()
          get().pushLog("info", `Backfilled captions for ${data.updatedCount} assets.`)
          get().pushEvent({
            kind: "info",
            status: "done",
            title: "Captions backfilled",
            detail: `Updated ${data.updatedCount} asset captions`,
          })
        } else {
          get().pushLog("info", data.message || "All assets already have captions.")
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        get().pushLog("error", `Backfill captions error: ${msg}`)
      }
    },
  }
}
