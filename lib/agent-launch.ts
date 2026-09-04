/**
 * DeerFlow × PosterApp Launch Flow Helpers (§12.2, §14.1)
 */

export const AGENT_SCOPE_PRESETS = {
  "research-ro": [
    "workspace:read",
    "bibliography:read",
    "assets:read",
    "rag:query",
    "review:run",
    "changes:read",
  ],
  "research-propose": [
    "workspace:read",
    "workspace:write",
    "bibliography:read",
    "bibliography:write",
    "assets:read",
    "assets:write",
    "rag:query",
    "review:run",
    "snapshot:create",
    "changes:read",
  ],
  full: ["*"],
} as const

export type AgentScopePreset = keyof typeof AGENT_SCOPE_PRESETS | "custom"

export interface DeerFlowLaunchBundleOptions {
  workspaceId: string
  rawKey: string
  prompt: string
  origin?: string
}

/**
 * Builds the canonical 3-step DeerFlow launch bundle (§14.1).
 * Ready for one-click copy to clipboard.
 */
export function buildDeerFlowLaunchBundle(opts: DeerFlowLaunchBundleOptions): string {
  const origin = opts.origin || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3333")

  return `### 1. Add to DeerFlow extensions_config.json → mcpServers
\`\`\`json
{
  "posterapp": {
    "enabled": true,
    "type": "http",
    "url": "${origin}/api/agent/mcp",
    "headers": {
      "Authorization": "Bearer ${opts.rawKey}"
    },
    "description": "PosterApp workspace tools (cards, bibliography, RAG, review, compile). Writes are proposals pending human approval."
  }
}
\`\`\`

### 2. Restart DeerFlow (MCP changes need restart; skills hot-reload)

### 3. Paste into a new DeerFlow thread
Workspace: ${opts.workspaceId}

${opts.prompt}`
}
