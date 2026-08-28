/**
 * agent-chat-adapter.ts
 *
 * Provides the `makeChatAdapter` factory that creates a `ChatModelAdapter`
 * for assistant-ui's `useLocalRuntime`. Each call to `run()` POSTs the full
 * conversation history to `/api/workspaces/<id>/chat` and resolves the
 * assistant reply as a single non-streamed message.
 *
 * The adapter is recreated whenever `projectId` changes so each workspace
 * gets a fresh, ephemeral thread.
 */

import type { ChatModelAdapter } from "@assistant-ui/react"
import { apiFetch } from "@/lib/api-fetch"

export function makeChatAdapter(
  projectId: string,
  getSelectedCardId: () => string | null
): ChatModelAdapter {
  return {
    async run({ messages, abortSignal }) {
      // Convert assistant-ui message objects to plain {role, content} pairs
      const history = messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content
          .filter((c) => c.type === "text")
          .map((c) => (c.type === "text" ? c.text : ""))
          .join(""),
      }))

      const res = await apiFetch(`/api/workspaces/${projectId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          selectedCardId: getSelectedCardId() ?? undefined,
        }),
        signal: abortSignal,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        const errMsg = typeof err?.error === "object" ? err.error.message : err?.error
        throw new Error(`Error ${res.status}: ${errMsg ?? res.statusText}`)
      }

      const data: { role: string; content: string } = await res.json()

      return {
        content: [{ type: "text", text: data.content }],
      }
    },
  }
}
