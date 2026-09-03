"use client"

import { useEffect, useRef } from "react"
import { useUser } from "@clerk/nextjs"
import * as Y from "yjs"
import { WebsocketProvider } from "y-websocket"
import { useEditorStoreInstance, useEditor } from "@/components/editor-store"
import { useThesisReviewStore, getThesisReviewStore, type ThesisReviewRecord } from "@/components/thesis-review/use-thesis-review-store"
import type { Card, OutputConfig } from "@/lib/poster-types"
import { OUTPUT_META_KEYS, pickOutputMeta } from "./project-slice"
import type { Collaborator } from "./types"
import { jobQueue } from "@/lib/job-queue"
import {
  hydrateReviewIntoYDoc,
  extractReviewFromYDoc,
  getGranularReviewStructure,
} from "@/lib/ai/yjs-granular-sync"

const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#d946ef"]

/** Minimum ms between awareness cursor broadcasts (~30 fps). */
const CURSOR_THROTTLE_MS = 80

export function useYjs(workspaceId: string) {
  const store = useEditorStoreInstance()
  const { user } = useUser()
  const lastCursorRef = useRef<number>(0)

  const collabEnabled = useEditor(s => s.collabEnabled)

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_YJS_WS_URL) return
    if (!workspaceId) return
    if (!collabEnabled) {
      store.getState().setYjsStatus("disconnected")
      return
    }

    let provider: WebsocketProvider | null = null
    let ydoc: Y.Doc | null = null
    let unsubscribeZustand: (() => void) | null = null
    let unsubscribeThesisStore: (() => void) | null = null
    let unsubscribeJobs: (() => void) | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let isCancelled = false

    let currentBoundOutputId = store.getState().project.activeOutputId
    let currentObserver: ((event: Y.YMapEvent<string>) => void) | null = null
    let currentYCards: Y.Map<string> | null = null
    let currentYMeta: Y.Map<string> | null = null
    let currentMetaObserver: ((event: Y.YMapEvent<string>) => void) | null = null

    ydoc = new Y.Doc()
    const wsUrl = typeof window !== "undefined"
      ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/api/yjs`
      : (process.env.NEXT_PUBLIC_YJS_WS_URL || "ws://localhost:3333/api/yjs")

    const thesisReviewsMap = ydoc.getMap<string>("thesisReviews")
    const thesisObserver = (event: Y.YMapEvent<string>) => {
      if (event.transaction.local) return
      event.changes.keys.forEach((change, key) => {
        if (change.action === "delete") {
          currentThesisStore.getState()._removeReviewFromYjs(key)
        } else {
          const val = thesisReviewsMap.get(key)
          if (val) {
            try {
              const review = JSON.parse(val) as ThesisReviewRecord
              currentThesisStore.getState()._syncReviewFromYjs(review)
            } catch (err) {
              console.error("[Yjs] Failed to parse synced thesis review:", err)
            }
          }
        }
      })
    }
    thesisReviewsMap.observe(thesisObserver)

    const bindOutput = (outputId: string) => {
      if (currentYCards && currentObserver) {
        currentYCards.unobserve(currentObserver)
      }
      if (currentYMeta && currentMetaObserver) {
        currentYMeta.unobserve(currentMetaObserver)
      }
      currentBoundOutputId = outputId
      if (!outputId || !ydoc) return

      // Output metadata (title/authors/venue/logos/theme) — previously only cards
      // were shared, so header edits silently diverged between co-authors.
      const metaRoot = ydoc.getMap<Y.Map<string>>("outputMeta")
      let meta = metaRoot.get(outputId)
      if (!meta) {
        meta = new Y.Map<string>()
        metaRoot.set(outputId, meta)
      }
      currentYMeta = meta
      currentMetaObserver = (event: Y.YMapEvent<string>) => {
        if (event.transaction.local) return
        const patch: Record<string, unknown> = {}
        event.changes.keys.forEach((_c, key) => {
          if ((OUTPUT_META_KEYS as readonly string[]).includes(key)) {
            const raw = meta!.get(key)
            try { patch[key] = raw === undefined ? undefined : JSON.parse(raw) } catch { /* ignore malformed */ }
          }
        })
        if (Object.keys(patch).length > 0) store.getState()._setOutputMetaFromYjs(outputId, patch as Partial<OutputConfig>)
      }
      meta.observe(currentMetaObserver)

      const outputs = ydoc.getMap<Y.Map<string>>("outputs")
      let cards = outputs.get(outputId)
      if (!cards) {
        cards = new Y.Map<string>()
        outputs.set(outputId, cards)
      }
      currentYCards = cards

      currentObserver = (event: Y.YMapEvent<string>) => {
        if (event.transaction.local) return
        const newCardsArray: Card[] = Array.from(cards!.values()).map((val) => JSON.parse(val))
        newCardsArray.sort((a, b) => a.order - b.order)
        if (store.getState().project.activeOutputId === outputId) {
          store.getState()._setCardsFromYjs(newCardsArray)
        }
      }
      cards.observe(currentObserver)
    }

    let canWrite = false

    const connect = async () => {
      if (isCancelled) return

      try {
        const ticketResponse = await fetch(`/api/workspaces/${workspaceId}/collaboration-ticket`, {
          method: "POST",
          credentials: "same-origin",
        })
        if (isCancelled || !ticketResponse.ok) {
          canWrite = false
          store.getState().setYjsStatus("disconnected")
          return
        }
        const { ticket } = (await ticketResponse.json()) as { ticket?: string }
        if (!ticket || isCancelled) return

        canWrite = true

        class TicketWebSocket extends WebSocket {
          constructor(url: string | URL, _protocols?: string | string[]) {
            super(url, ["posterapp-yjs-v1", ticket!])
          }
        }

        provider = new WebsocketProvider(
          wsUrl,
          workspaceId,
          ydoc!,
          { connect: true, params: { workspaceId }, WebSocketPolyfill: TicketWebSocket }
        )

        provider.on("status", (event: { status: "connected" | "disconnected" | "connecting" }) => {
          store.getState().setYjsStatus(event.status)
        })

        provider.on("connection-close", () => {
          if (isCancelled) return
          store.getState().setYjsStatus("disconnected")
          provider?.destroy()
          provider = null
          if (reconnectTimer) clearTimeout(reconnectTimer)
          reconnectTimer = setTimeout(connect, 2000)
        })

        // Awareness — use real Clerk identity
        const myColor = COLORS[Math.floor(Math.random() * COLORS.length)]
        const displayName =
          user?.fullName || user?.username || user?.primaryEmailAddress?.emailAddress || "Anonymous"

        provider.awareness.setLocalStateField("user", {
          name: displayName,
          color: myColor,
          cursor: null,
        })

        provider.awareness.on("change", () => {
          if (!provider) return
          const states = Array.from(provider.awareness.getStates().entries())
            .map(([clientId, state]) => ({
              clientId,
              ...(state.user as Omit<Collaborator, "clientId">),
            }))
            .filter((u) => u.clientId !== ydoc!.clientID && u.name)
          store.getState().setCollaborators(states)
        })
      } catch (err) {
        console.error("[Yjs] Connection failed:", err)
        canWrite = false
        store.getState().setYjsStatus("disconnected")
        if (!isCancelled) {
          if (reconnectTimer) clearTimeout(reconnectTimer)
          reconnectTimer = setTimeout(connect, 3000)
        }
      }
    }

    if (currentBoundOutputId) {
      bindOutput(currentBoundOutputId)
    }

    // Listen for local Zustand changes and update Yjs (gated on canWrite permission)
    let lastCards =
      store.getState().project.outputs?.find((o) => o.id === store.getState().project.activeOutputId)?.cards ?? []
    let lastOutputRef = store.getState().project.outputs?.find((o) => o.id === store.getState().project.activeOutputId) ?? null
    // Debounce local → Yjs pushes: every keystroke used to JSON.stringify every card.
    let pushTimer: ReturnType<typeof setTimeout> | null = null
    const flushToYjs = () => {
      pushTimer = null
      if (!canWrite || !ydoc || !currentYCards) return
      const state = store.getState()
      const activeId = state.project.activeOutputId
      const output = state.project.outputs?.find((o) => o.id === activeId)
      if (!output) return
      const newCards = output.cards ?? []
      ydoc.transact(() => {
        if (newCards !== lastCards) {
          lastCards = newCards
          newCards.forEach((card) => {
            const currentStr = currentYCards!.get(card.id)
            const newStr = JSON.stringify(card)
            if (currentStr !== newStr) currentYCards!.set(card.id, newStr)
          })
          const currentIds = new Set(newCards.map((c) => c.id))
          Array.from(currentYCards!.keys()).forEach((key) => {
            if (!currentIds.has(key)) currentYCards!.delete(key)
          })
        }
        if (currentYMeta && output !== lastOutputRef) {
          lastOutputRef = output
          const meta = pickOutputMeta(output)
          for (const key of OUTPUT_META_KEYS) {
            const newStr = JSON.stringify(meta[key] ?? null)
            if (currentYMeta.get(key) !== newStr) currentYMeta.set(key, newStr)
          }
        }
      }, "local")
    }
    unsubscribeZustand = store.subscribe((state) => {
      const activeId = state.project.activeOutputId
      if (activeId !== currentBoundOutputId) {
        bindOutput(activeId)
        rebindThesisStore()
        lastOutputRef = null
      }
      if (!canWrite || !currentYCards || !activeId) return
      const output = state.project.outputs?.find((o) => o.id === activeId)
      const newCards = output?.cards ?? []
      if (newCards !== lastCards || output !== lastOutputRef) {
        if (pushTimer) clearTimeout(pushTimer)
        pushTimer = setTimeout(flushToYjs, 150)
      }
    })

    // Granular Yjs synchronization for thesis reviews
    const bindGranularReview = (reviewId: string) => {
      if (!ydoc || !reviewId) return () => {}
      const { metadataMap, findingsMap, findingOrderArray, reportingMap, decisionsMap } =
        getGranularReviewStructure(ydoc, reviewId)

      const handleGranularChange = (event: Y.YMapEvent<string> | Y.YArrayEvent<string>) => {
        if (event.transaction.local || event.transaction.origin === "local") return
        const fallback = currentThesisStore.getState().activeReview ?? undefined
        const updated = extractReviewFromYDoc(ydoc!, reviewId, fallback)
        currentThesisStore.getState()._syncReviewFromYjs(updated)
      }

      metadataMap.observe(handleGranularChange)
      findingsMap.observe(handleGranularChange)
      findingOrderArray.observe(handleGranularChange as any)
      reportingMap.observe(handleGranularChange)
      decisionsMap.observe(handleGranularChange)

      return () => {
        metadataMap.unobserve(handleGranularChange)
        findingsMap.unobserve(handleGranularChange)
        findingOrderArray.unobserve(handleGranularChange as any)
        reportingMap.unobserve(handleGranularChange)
        decisionsMap.unobserve(handleGranularChange)
      }
    }

    // Listen for local Thesis Review changes and update Yjs (gated on canWrite permission)
    let currentThesisStore = useThesisReviewStore
    let lastActiveReview: ThesisReviewRecord | null = null
    let unbindGranular: (() => void) | null = null
    let boundThesisReviewKey: string | null = null

    const rebindThesisStore = () => {
      const proj = store.getState().project
      const out = proj.outputs?.find(o => o.id === proj.activeOutputId)
      const key = out?.outputType === "thesis-review" ? `${proj.id}:${out.id}` : null
      if (key === boundThesisReviewKey) return
      unsubscribeThesisStore?.()
      unbindGranular?.()
      boundThesisReviewKey = key
      currentThesisStore = key ? getThesisReviewStore(key) : useThesisReviewStore
      lastActiveReview = currentThesisStore.getState().activeReview
      if (lastActiveReview && ydoc) {
        unbindGranular = bindGranularReview(lastActiveReview.id)
      }
      unsubscribeThesisStore = currentThesisStore.subscribe((state) => {
        const active = state.activeReview
        if (active !== lastActiveReview) {
          if (active?.id !== lastActiveReview?.id) {
            unbindGranular?.()
            if (active) {
              unbindGranular = bindGranularReview(active.id)
            }
          }
          lastActiveReview = active
          if (canWrite && active && ydoc) {
            hydrateReviewIntoYDoc(ydoc, active, "local")
            ydoc.transact(() => {
              const currentStr = thesisReviewsMap.get(active.id)
              const newStr = JSON.stringify(active)
              if (currentStr !== newStr) {
                thesisReviewsMap.set(active.id, newStr)
              }
            }, "local")
          }
        }
      })
    }
    rebindThesisStore()

    // Track mouse for cursor — throttled
    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now()
      if (now - lastCursorRef.current < CURSOR_THROTTLE_MS) return
      lastCursorRef.current = now
      provider?.awareness.setLocalStateField("user", {
        ...provider?.awareness.getLocalState()?.user,
        cursor: { x: e.clientX, y: e.clientY },
      })
    }
    const handleMouseLeave = () => {
      lastCursorRef.current = 0
      provider?.awareness.setLocalStateField("user", {
        ...provider?.awareness.getLocalState()?.user,
        cursor: null,
      })
    }
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseleave", handleMouseLeave)

    if (jobQueue?.subscribe) {
      unsubscribeJobs = jobQueue.subscribe((jobs) => {
        store.setState({ jobs })
      })
    }

    connect()

    return () => {
      isCancelled = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (pushTimer) { clearTimeout(pushTimer); flushToYjs() }
      if (currentYCards && currentObserver) {
        currentYCards.unobserve(currentObserver)
      }
      if (currentYMeta && currentMetaObserver) {
        currentYMeta.unobserve(currentMetaObserver)
      }
      thesisReviewsMap.unobserve(thesisObserver)
      unbindGranular?.()
      unsubscribeZustand?.()
      unsubscribeThesisStore?.()
      unsubscribeJobs?.()
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseleave", handleMouseLeave)
      provider?.destroy()
      ydoc?.destroy()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, store, collabEnabled])
}
