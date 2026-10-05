import { describe, it, expect, vi, beforeEach } from "vitest"

/**
 * Endpoint credentials are per-user assets. These tests pin the storage rules
 * that keep them that way:
 *  - each user reads and writes only their own row,
 *  - the legacy instance row is read-only for requests, and the first user to
 *    configure endpoints takes the secrets out of it,
 *  - AI calls resolve the workspace owner's endpoints, falling back to the
 *    (secret-free) instance defaults.
 */

type Row = { key: string; value: string }
const rows = new Map<string, Row>()
let workspaceOwnerId: string | null = "user-1"

const upsert = vi.fn(async ({ where, create, update }: any) => {
  rows.set(where.key, { key: where.key, value: update?.value ?? create?.value })
  return rows.get(where.key)!
})
const findUnique = vi.fn(async ({ where }: any) => rows.get(where.key) ?? null)
const updateMany = vi.fn(async ({ where, data }: any) => {
  const row = rows.get(where.key)
  if (!row || row.value !== where.value) return { count: 0 }
  rows.set(where.key, { key: where.key, value: data.value })
  return { count: 1 }
})

vi.mock("@/lib/prisma", () => ({
  prisma: {
    systemSetting: { upsert, findUnique, updateMany },
    workspace: {
      findUnique: vi.fn(async () => (workspaceOwnerId ? { userId: workspaceOwnerId } : null)),
    },
  },
}))

const {
  AI_ENDPOINTS_INSTANCE_KEY,
  aiEndpointsKeyUserId,
  aiEndpointsUserKey,
  getInstanceAiEndpoints,
  getUserAiEndpoints,
  invalidateAiEndpointsCache,
  resolveAiEndpointsForWorkspace,
  saveUserAiEndpoints,
} = await import("@/lib/ai/endpoint-store")

const legacyEndpoint = {
  id: "ep-legacy",
  name: "Legacy shared endpoint",
  baseUrl: "https://legacy.example.com/v1",
  apiKey: "legacy-secret",
  enabled: true,
  models: ["model-a"],
}

describe("AI endpoint ownership & persistence", () => {
  beforeEach(() => {
    rows.clear()
    workspaceOwnerId = "user-1"
    vi.clearAllMocks()
    invalidateAiEndpointsCache()
  })

  it("stores each user's endpoints under their own key", async () => {
    await saveUserAiEndpoints("user-1", [{ ...legacyEndpoint, id: "ep-a", apiKey: "sk-a" }])
    await saveUserAiEndpoints("user-2", [{ ...legacyEndpoint, id: "ep-b", apiKey: "sk-b" }])

    expect([...rows.keys()].sort()).toEqual([aiEndpointsUserKey("user-1"), aiEndpointsUserKey("user-2")].sort())
    expect(aiEndpointsKeyUserId(aiEndpointsUserKey("user-1"))).toBe("user-1")
    expect(aiEndpointsKeyUserId(AI_ENDPOINTS_INSTANCE_KEY)).toBeNull()

    invalidateAiEndpointsCache()
    expect((await getUserAiEndpoints("user-1")).map((e) => e.id)).toEqual(["ep-a"])
    expect((await getUserAiEndpoints("user-2")).map((e) => e.id)).toEqual(["ep-b"])
  })

  it("keeps one user's save from touching another user's credentials", async () => {
    await saveUserAiEndpoints("user-1", [{ ...legacyEndpoint, apiKey: "sk-a" }])
    invalidateAiEndpointsCache()

    await saveUserAiEndpoints("user-2", [])

    invalidateAiEndpointsCache()
    const userOne = await getUserAiEndpoints("user-1")
    expect(userOne).toHaveLength(1)
    expect(userOne[0].apiKey).toBe("sk-a")
    expect(await getUserAiEndpoints("user-2")).toEqual([])
  })

  it("lets the first user take ownership of legacy instance endpoints exactly once", async () => {
    rows.set(AI_ENDPOINTS_INSTANCE_KEY, { key: AI_ENDPOINTS_INSTANCE_KEY, value: JSON.stringify([legacyEndpoint]) })

    const claimed = await getUserAiEndpoints("user-1")
    expect(claimed).toEqual([legacyEndpoint])

    // Secrets moved into the claiming user's own row…
    const ownRow = rows.get(aiEndpointsUserKey("user-1"))!
    expect(JSON.parse(ownRow.value)[0].apiKey).toBe("legacy-secret")

    // …and the instance row keeps only defaults, so a second user cannot read them.
    const instanceRow = rows.get(AI_ENDPOINTS_INSTANCE_KEY)!
    expect(JSON.parse(instanceRow.value)[0].apiKey).toBeUndefined()

    invalidateAiEndpointsCache()
    const otherUser = await getUserAiEndpoints("user-2")
    expect(otherUser[0].baseUrl).toBe(legacyEndpoint.baseUrl)
    expect(otherUser[0].apiKey).toBeUndefined()
    expect(JSON.stringify(otherUser)).not.toContain("legacy-secret")
  })

  it("does not claim twice when two users read the legacy row concurrently", async () => {
    rows.set(AI_ENDPOINTS_INSTANCE_KEY, { key: AI_ENDPOINTS_INSTANCE_KEY, value: JSON.stringify([legacyEndpoint]) })

    const [first, second] = await Promise.all([getUserAiEndpoints("user-1"), getUserAiEndpoints("user-2")])
    const withSecret = first.some((endpoint) => endpoint.apiKey === "legacy-secret")
    const secondWithSecret = second.some((endpoint) => endpoint.apiKey === "legacy-secret")

    // Exactly one claimant receives the secret.
    expect([withSecret, secondWithSecret].filter(Boolean)).toHaveLength(1)
    // Both racers may attempt the compare-and-set, but only one may win it.
    const settled = await Promise.all(updateMany.mock.results.map((result) => result.value))
    expect(settled.filter((outcome) => outcome.count === 1)).toHaveLength(1)
    // The losing attempt compares against the value it read (the original raw
    // payload), which no longer matches: it cannot strip or claim again later.
    const attempts = updateMany.mock.calls.map((call: any[]) => call[0].where.value)
    expect(new Set(attempts).size).toBe(1)
  })

  it("resolves generation endpoints from the workspace owner, then instance defaults", async () => {
    rows.set(AI_ENDPOINTS_INSTANCE_KEY, {
      key: AI_ENDPOINTS_INSTANCE_KEY,
      value: JSON.stringify([{ ...legacyEndpoint, apiKey: undefined }]),
    })
    await saveUserAiEndpoints("user-1", [{ ...legacyEndpoint, id: "ep-owner", apiKey: "sk-owner" }])
    invalidateAiEndpointsCache()

    const ownerEndpoints = await resolveAiEndpointsForWorkspace("ws-1")
    expect(ownerEndpoints.map((endpoint) => endpoint.id)).toEqual(["ep-owner"])

    // A workspace whose owner has no endpoints falls back to instance defaults.
    invalidateAiEndpointsCache()
    workspaceOwnerId = "user-without-endpoints"
    const fallback = await resolveAiEndpointsForWorkspace("ws-2")
    expect(fallback.map((endpoint) => endpoint.id)).toEqual(["ep-legacy"])
    expect(fallback[0].apiKey).toBeUndefined()
  })

  it("never caches one user's endpoints under another user's key", async () => {
    await saveUserAiEndpoints("user-1", [{ ...legacyEndpoint, id: "ep-a", apiKey: "sk-a" }])
    invalidateAiEndpointsCache()

    // Read user 1 (fills the cache), then save for user 2 and read user 1 again.
    expect((await getUserAiEndpoints("user-1")).map((e) => e.apiKey)).toEqual(["sk-a"])
    await saveUserAiEndpoints("user-2", [{ ...legacyEndpoint, id: "ep-b", apiKey: "sk-b" }])

    expect((await getUserAiEndpoints("user-1")).map((e) => e.apiKey)).toEqual(["sk-a"])
    expect((await getUserAiEndpoints("user-2")).map((e) => e.apiKey)).toEqual(["sk-b"])
  })

  it("returns no endpoints for an empty user id instead of the instance row", async () => {
    rows.set(AI_ENDPOINTS_INSTANCE_KEY, { key: AI_ENDPOINTS_INSTANCE_KEY, value: JSON.stringify([legacyEndpoint]) })
    expect(await getUserAiEndpoints("")).toEqual([])
  })

  it("reads instance defaults without exposing secrets", async () => {
    rows.set(AI_ENDPOINTS_INSTANCE_KEY, {
      key: AI_ENDPOINTS_INSTANCE_KEY,
      value: JSON.stringify([{ ...legacyEndpoint, apiKey: undefined }]),
    })
    const instance = await getInstanceAiEndpoints()
    expect(instance[0].baseUrl).toBe(legacyEndpoint.baseUrl)
    expect(JSON.stringify(instance)).not.toContain("legacy-secret")
  })
})
