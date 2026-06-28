import type { EditorSlice, UiSlice } from "./types"
import type { AgentEvent } from "@/lib/poster-types"

function makeEvent(e: Omit<AgentEvent, "id" | "ts">): AgentEvent {
  return {
    ...e,
    id: crypto.randomUUID(),
    ts: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  }
}

export const createUiSlice: EditorSlice<UiSlice> = (set, get) => ({
  agentEvents: [
    makeEvent({
      kind: "info",
      status: "done",
      title: "Editor ready",
      detail: "Loading workspace…",
    }),
  ],
  generatingId: null,

  pushEvent: (e) => {
    set((s) => {
      s.agentEvents.push(makeEvent(e))
    })
  },
})
