"use client"

import { useEffect, useRef } from "react"
import { useAuth, useUser } from "@clerk/nextjs"
import * as Y from "yjs"
import { WebsocketProvider } from "y-websocket"
import { useEditorStoreInstance } from "@/components/editor-store"
import type { Card } from "@/lib/poster-types"
import type { Collaborator } from "./types"
import { jobQueue } from "@/lib/job-queue"

const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#d946ef"]

/** Minimum ms between awareness cursor broadcasts (~30 fps). */
const CURSOR_THROTTLE_MS = 33

export function useYjs(workspaceId: string) {
  const store = useEditorStoreInstance()
  const { getToken } = useAuth()
  const { user } = useUser()
  const lastCursorRef = useRef<number>(0)

  const collabEnabled = store(s => s.collabEnabled)

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
    let unsubscribeJobs: (() => void) | null = null

    const setup = async () => {
      // Get a fresh Clerk token to authenticate the WebSocket handshake
      const token = await getToken()
      if (!token) {
        console.warn("[Yjs] No Clerk token — staying offline")
        return
      }

      ydoc = new Y.Doc()
      const wsUrl = process.env.NEXT_PUBLIC_YJS_WS_URL!
      provider = new WebsocketProvider(
        wsUrl,
        workspaceId,
        ydoc,
        { 
          connect: true,
          params: { workspaceId, token }
        }
      )

      provider.on("status", (event: { status: "connected" | "disconnected" | "connecting" }) => {
        store.getState().setYjsStatus(event.status)
      })

      // When the connection closes (e.g. token expired, server restart), fetch a fresh token
      // and update the URL so the exponential backoff reconnect uses the new token!
      provider.on("connection-close", async () => {
        try {
          const freshToken = await getToken()
          if (freshToken) {
            provider!.url = `${wsUrl}/${workspaceId}?workspaceId=${workspaceId}&token=${freshToken}`
          }
        } catch (err) {
          console.error("[Yjs] Failed to refresh token on reconnect", err)
        }
      })

      const yCards = ydoc.getMap<string>("cards")

      // Listen for remote Yjs changes and update Zustand
      const observer = (event: Y.YMapEvent<string>) => {
        if (event.transaction.local) return
        const newCardsArray: Card[] = Array.from(yCards.values()).map(val => JSON.parse(val))
        newCardsArray.sort((a, b) => a.order - b.order)
        store.getState()._setCardsFromYjs(newCardsArray)
      }
      yCards.observe(observer)

      // Listen for local Zustand changes and update Yjs
      let lastCards = store.getState().project.cards
      unsubscribeZustand = store.subscribe((state) => {
        const newCards = state.project.cards
        if (newCards !== lastCards) {
          lastCards = newCards
          ydoc!.transact(() => {
            newCards.forEach((card) => {
              const currentStr = yCards.get(card.id)
              const newStr = JSON.stringify(card)
              if (currentStr !== newStr) yCards.set(card.id, newStr)
            })
            const currentIds = new Set(newCards.map(c => c.id))
            Array.from(yCards.keys()).forEach(key => {
              if (!currentIds.has(key)) yCards.delete(key)
            })
          }, "local")
        }
      })

      // Awareness — use real Clerk identity
      const myColor = COLORS[Math.floor(Math.random() * COLORS.length)]
      const displayName = user?.fullName || user?.username || user?.primaryEmailAddress?.emailAddress || "Anonymous"

      provider.awareness.setLocalStateField("user", {
        name: displayName,
        color: myColor,
        cursor: null,
      })

      provider.awareness.on("change", () => {
        const states = Array.from(provider!.awareness.getStates().entries())
          .map(([clientId, state]) => ({
            clientId,
            ...(state.user as Omit<Collaborator, "clientId">),
          }))
          .filter(u => u.clientId !== ydoc!.clientID && u.name)
        store.getState().setCollaborators(states)
      })

      // Track mouse for cursor — throttled
      const handleMouseMove = (e: MouseEvent) => {
        const now = Date.now()
        if (now - lastCursorRef.current < CURSOR_THROTTLE_MS) return
        lastCursorRef.current = now
        provider!.awareness.setLocalStateField("user", {
          ...provider!.awareness.getLocalState()?.user,
          cursor: { x: e.clientX, y: e.clientY },
        })
      }
      const handleMouseLeave = () => {
        lastCursorRef.current = 0
        provider!.awareness.setLocalStateField("user", {
          ...provider!.awareness.getLocalState()?.user,
          cursor: null,
        })
      }
      window.addEventListener("mousemove", handleMouseMove)
      window.addEventListener("mouseleave", handleMouseLeave)

      unsubscribeJobs = jobQueue.subscribe((jobs) => {
        store.setState({ jobs })
      })

      // Store cleanup refs on the ydoc for teardown
      ;(ydoc as any)._cleanup = () => {
        yCards.unobserve(observer)
        unsubscribeZustand?.()
        unsubscribeJobs?.()
        window.removeEventListener("mousemove", handleMouseMove)
        window.removeEventListener("mouseleave", handleMouseLeave)
        provider?.destroy()
        ydoc?.destroy()
      }
    }

    setup()

    return () => {
      ;(ydoc as any)?._cleanup?.()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, store, collabEnabled])
}
