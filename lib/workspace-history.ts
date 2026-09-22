import type { AgentEvent } from "@/lib/poster-types"

const HISTORY_STORAGE_PREFIX = "posterapp_history_"

export interface WorkspaceHistoryData {
  agentEvents: AgentEvent[]
  chatMessages: any[]
}

const memoryHistoryCache = new Map<string, WorkspaceHistoryData>()

export function getWorkspaceLocalHistory(workspaceId: string): WorkspaceHistoryData | null {
  if (!workspaceId) return null
  const fromMem = memoryHistoryCache.get(workspaceId)
  if (fromMem) return fromMem

  if (typeof window !== "undefined") {
    try {
      const raw =
        sessionStorage.getItem(`${HISTORY_STORAGE_PREFIX}${workspaceId}`) ||
        localStorage.getItem(`${HISTORY_STORAGE_PREFIX}${workspaceId}`)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && Array.isArray(parsed.agentEvents)) {
          const res: WorkspaceHistoryData = {
            agentEvents: parsed.agentEvents,
            chatMessages: Array.isArray(parsed.chatMessages) ? parsed.chatMessages : [],
          }
          memoryHistoryCache.set(workspaceId, res)
          return res
        }
      }
    } catch {}
  }
  return null
}

export function setWorkspaceLocalHistory(
  workspaceId: string,
  agentEvents: AgentEvent[],
  chatMessages: any[]
): void {
  if (!workspaceId) return
  const data: WorkspaceHistoryData = {
    agentEvents: (agentEvents || []).slice(-100),
    chatMessages: (chatMessages || []).slice(-100),
  }
  memoryHistoryCache.set(workspaceId, data)

  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(`${HISTORY_STORAGE_PREFIX}${workspaceId}`, JSON.stringify(data))
    } catch {}
  }
}

export function clearWorkspaceLocalHistory(workspaceId: string): void {
  if (!workspaceId) return
  memoryHistoryCache.delete(workspaceId)
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem(`${HISTORY_STORAGE_PREFIX}${workspaceId}`)
      localStorage.removeItem(`${HISTORY_STORAGE_PREFIX}${workspaceId}`)
    } catch {}
  }
}
