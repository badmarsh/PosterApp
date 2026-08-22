"use client"

import { useEffect } from "react"
import * as Y from "yjs"
import { WebsocketProvider } from "y-websocket"
import { useEditorStoreInstance } from "@/components/editor-store"
import type { Card } from "@/lib/poster-types"
import type { Collaborator } from "./types"

const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#d946ef"]

export function useYjs(workspaceId: string) {
  const store = useEditorStoreInstance()

  useEffect(() => {
    if (!workspaceId) return

    const ydoc = new Y.Doc()
    const wsUrl = process.env.NEXT_PUBLIC_YJS_WS_URL || "ws://localhost:1234"
    const provider = new WebsocketProvider(
      wsUrl,
      workspaceId,
      ydoc
    )

    provider.on("status", (event: { status: "connected" | "disconnected" | "connecting" }) => {
      store.getState().setYjsStatus(event.status)
    })

    const yCards = ydoc.getMap<string>("cards")

    // Listen for remote Yjs changes and update Zustand
    const observer = (event: Y.YMapEvent<string>) => {
      // Avoid infinite loops by checking if the change originated locally
      if (event.transaction.local) return

      // Convert Y.Map values back to an array of Cards
      const newCardsArray: Card[] = Array.from(yCards.values()).map(val => JSON.parse(val))
      // Sort by original order
      newCardsArray.sort((a, b) => a.order - b.order)
      
      store.getState()._setCardsFromYjs(newCardsArray)
    }

    yCards.observe(observer)

    // Listen for local Zustand changes and update Yjs
    let lastCards = store.getState().project.cards
    const unsubscribeZustand = store.subscribe((state) => {
      const newCards = state.project.cards
      if (newCards !== lastCards) {
        lastCards = newCards
        // Sync cards to Y.Map
        ydoc.transact(() => {
          newCards.forEach((card) => {
            const currentStr = yCards.get(card.id)
            const newStr = JSON.stringify(card)
            if (currentStr !== newStr) {
              yCards.set(card.id, newStr)
            }
          })
          
          // Detect deleted cards
          const currentIds = new Set(newCards.map(c => c.id))
          Array.from(yCards.keys()).forEach(key => {
            if (!currentIds.has(key)) {
              yCards.delete(key)
            }
          })
        }, "local")
      }
    })

    // Awareness for cursors/collaborators
    const myColor = COLORS[Math.floor(Math.random() * COLORS.length)]
    
    provider.awareness.setLocalStateField("user", {
      name: `User ${Math.floor(Math.random() * 1000)}`,
      color: myColor,
      cursor: null
    })

    provider.awareness.on("change", () => {
      const states = Array.from(provider.awareness.getStates().entries())
        .map(([clientId, state]) => ({
          clientId,
          ...(state.user as Omit<Collaborator, "clientId">)
        }))
        .filter(u => u.clientId !== ydoc.clientID && u.name) // filter out self and empty states
      
      store.getState().setCollaborators(states)
    })

    // Track mouse for cursor
    const handleMouseMove = (e: MouseEvent) => {
      provider.awareness.setLocalStateField("user", {
        ...provider.awareness.getLocalState()?.user,
        cursor: { x: e.clientX, y: e.clientY }
      })
    }
    
    const handleMouseLeave = () => {
      provider.awareness.setLocalStateField("user", {
        ...provider.awareness.getLocalState()?.user,
        cursor: null
      })
    }
    
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseleave", handleMouseLeave)

    return () => {
      unsubscribeZustand()
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseleave", handleMouseLeave)
      provider.disconnect()
      ydoc.destroy()
    }
  }, [workspaceId, store])
}
