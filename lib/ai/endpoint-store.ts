/**
 * Server-side persistence and ownership of AI endpoints.
 *
 * Endpoint API keys belong to the user who configured them. They are stored one
 * row per user (`SystemSetting.key = "ai_endpoints:user:<userId>"`), so an
 * authenticated user can only ever read or overwrite their own credentials. The
 * legacy instance-wide `ai_endpoints` row is treated as an administrator-managed
 * default: it is only read, its secrets are stripped the first time a user takes
 * ownership, and no request handler writes to it.
 *
 * Which endpoints serve a generation call: `resolveAiEndpointsForWorkspace`
 * returns the workspace owner's endpoints, falling back to instance defaults.
 *
 * This module imports the database client, so it must only be imported from
 * server code. Client-shared URL helpers live in `lib/ai/endpoints.ts`.
 */

import { prisma } from "@/lib/prisma"
import type { AiEndpointConfig } from "./endpoints"

/** The instance-wide default row, kept only for administrator-managed defaults. */
export const AI_ENDPOINTS_INSTANCE_KEY = "ai_endpoints"
const USER_KEY_PREFIX = "ai_endpoints:user:"
const WORKSPACE_CACHE_PREFIX = "ai_endpoints:workspace:"
const CACHE_TTL_MS = 5_000

/** Per-key cache, so one user's read can never serve another user's list. */
const endpointCache = new Map<string, { data: AiEndpointConfig[]; expiresAt: number }>()

export function aiEndpointsUserKey(userId: string): string {
  return `${USER_KEY_PREFIX}${userId}`
}

/** Extract the owning user id from a `SystemSetting` key, or null for other keys. */
export function aiEndpointsKeyUserId(key: string): string | null {
  return key.startsWith(USER_KEY_PREFIX) ? key.slice(USER_KEY_PREFIX.length) : null
}

/** Drop cached endpoints for one user, or for every key when called without arguments. */
export function invalidateAiEndpointsCache(userId?: string): void {
  if (userId === undefined) {
    endpointCache.clear()
    return
  }
  endpointCache.delete(aiEndpointsUserKey(userId))
  endpointCache.delete(AI_ENDPOINTS_INSTANCE_KEY)
  for (const key of [...endpointCache.keys()]) {
    if (key.startsWith(WORKSPACE_CACHE_PREFIX)) endpointCache.delete(key)
  }
}

function parseEndpointRows(raw: string | null | undefined): AiEndpointConfig[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as AiEndpointConfig[]) : []
  } catch {
    return []
  }
}

function withoutSecrets(endpoints: AiEndpointConfig[]): AiEndpointConfig[] {
  return endpoints.map((endpoint) => ({ ...endpoint, apiKey: undefined }))
}

async function readSetting(key: string): Promise<string | null> {
  const row = await prisma.systemSetting.findUnique({ where: { key } })
  return row?.value ?? null
}

async function writeSetting(key: string, value: string): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  })
}

/** Instance-wide defaults; secrets are removed as soon as a user owns them. */
export async function getInstanceAiEndpoints(skipCache = false): Promise<AiEndpointConfig[]> {
  const now = Date.now()
  const cached = endpointCache.get(AI_ENDPOINTS_INSTANCE_KEY)
  if (!skipCache && cached && cached.expiresAt > now) return cached.data
  const endpoints = parseEndpointRows(await readSetting(AI_ENDPOINTS_INSTANCE_KEY))
  endpointCache.set(AI_ENDPOINTS_INSTANCE_KEY, { data: endpoints, expiresAt: now + CACHE_TTL_MS })
  return endpoints
}

/**
 * Endpoints configured by `userId`.
 *
 * If the user has none yet but the instance row still holds endpoints, the user
 * takes ownership of them: the secrets move into their own row and are stripped
 * from the instance row. Whoever claims first wins — a losing racer keeps the
 * instance defaults without secrets, so no second user can read them.
 */
export async function getUserAiEndpoints(userId: string, skipCache = false): Promise<AiEndpointConfig[]> {
  if (!userId) return []
  const key = aiEndpointsUserKey(userId)
  const now = Date.now()
  const cached = endpointCache.get(key)
  if (!skipCache && cached && cached.expiresAt > now) return cached.data

  const own = parseEndpointRows(await readSetting(key))
  if (own.length > 0) {
    endpointCache.set(key, { data: own, expiresAt: now + CACHE_TTL_MS })
    return own
  }

  const claimed = await claimLegacyEndpoints(userId)
  endpointCache.set(key, { data: claimed, expiresAt: now + CACHE_TTL_MS })
  return claimed
}

/**
 * Move the legacy instance endpoints into `userId`'s own row exactly once.
 * The compare-and-set on the raw value means concurrent first reads cannot both
 * claim the same secrets.
 */
async function claimLegacyEndpoints(userId: string): Promise<AiEndpointConfig[]> {
  const raw = await readSetting(AI_ENDPOINTS_INSTANCE_KEY)
  const legacy = parseEndpointRows(raw)
  if (!raw || legacy.length === 0) return []

  const stripped = withoutSecrets(legacy)
  const claimed = await prisma.systemSetting.updateMany({
    where: { key: AI_ENDPOINTS_INSTANCE_KEY, value: raw },
    data: { value: JSON.stringify(stripped) },
  })
  endpointCache.set(AI_ENDPOINTS_INSTANCE_KEY, { data: stripped, expiresAt: Date.now() + CACHE_TTL_MS })
  if (claimed.count === 0) return stripped

  await writeSetting(aiEndpointsUserKey(userId), JSON.stringify(legacy))
  return legacy
}

/** Persist endpoints for one user. Never touches another user's row or the instance row. */
export async function saveUserAiEndpoints(userId: string, endpoints: AiEndpointConfig[]): Promise<void> {
  if (!userId) throw new Error("Cannot save AI endpoints without an authenticated user")
  await writeSetting(aiEndpointsUserKey(userId), JSON.stringify(endpoints))
  invalidateAiEndpointsCache(userId)
  endpointCache.set(aiEndpointsUserKey(userId), { data: endpoints, expiresAt: Date.now() + CACHE_TTL_MS })
}

/**
 * Endpoints that should serve AI calls for a workspace: the owner's own
 * endpoints when they configured any, otherwise instance defaults.
 */
export async function resolveAiEndpointsForWorkspace(workspaceId: string): Promise<AiEndpointConfig[]> {
  if (!workspaceId) return getInstanceAiEndpoints()
  const cacheKey = `${WORKSPACE_CACHE_PREFIX}${workspaceId}`
  const now = Date.now()
  const cached = endpointCache.get(cacheKey)
  if (cached && cached.expiresAt > now) return cached.data

  const workspace = await prisma.workspace
    .findUnique({ where: { id: workspaceId }, select: { userId: true } })
    .catch(() => null)
  const ownerEndpoints = workspace?.userId ? await getUserAiEndpoints(workspace.userId) : []
  const endpoints = ownerEndpoints.length > 0 ? ownerEndpoints : await getInstanceAiEndpoints()
  endpointCache.set(cacheKey, { data: endpoints, expiresAt: now + CACHE_TTL_MS })
  return endpoints
}
