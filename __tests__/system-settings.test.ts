import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  parseBoolean,
  getEnvRegistrationSetting,
  getRegistrationSetting,
  setRegistrationSetting,
  resetRegistrationSetting,
  invalidateSystemSettingsCache,
  SYSTEM_SETTING_KEYS,
} from "@/lib/system-settings"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    systemSetting: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({ userId: null }),
  apiError: vi.fn((code: string, message: string, status: number) => {
    return new Response(JSON.stringify({ error: { code, message } }), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  }),
}))

describe("System Settings — User Registration Control", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    invalidateSystemSettingsCache()
    delete process.env.ALLOW_REGISTRATION
    delete process.env.NEXT_PUBLIC_ALLOW_REGISTRATION
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  describe("parseBoolean helper", () => {
    it("parses truthy values correctly", () => {
      expect(parseBoolean("true")).toBe(true)
      expect(parseBoolean("TRUE")).toBe(true)
      expect(parseBoolean("1")).toBe(true)
      expect(parseBoolean("yes")).toBe(true)
      expect(parseBoolean("on")).toBe(true)
      expect(parseBoolean("enabled")).toBe(true)
    })

    it("parses falsy values correctly", () => {
      expect(parseBoolean("false")).toBe(false)
      expect(parseBoolean("FALSE")).toBe(false)
      expect(parseBoolean("0")).toBe(false)
      expect(parseBoolean("no")).toBe(false)
      expect(parseBoolean("off")).toBe(false)
      expect(parseBoolean("disabled")).toBe(false)
    })

    it("returns null for empty or invalid values", () => {
      expect(parseBoolean(undefined)).toBeNull()
      expect(parseBoolean(null)).toBeNull()
      expect(parseBoolean("")).toBeNull()
      expect(parseBoolean("   ")).toBeNull()
      expect(parseBoolean("random_string")).toBeNull()
    })
  })

  describe("getEnvRegistrationSetting", () => {
    it("returns null when no env vars are set", () => {
      expect(getEnvRegistrationSetting()).toBeNull()
    })

    it("respects ALLOW_REGISTRATION=false", () => {
      process.env.ALLOW_REGISTRATION = "false"
      expect(getEnvRegistrationSetting()).toBe(false)
    })

    it("respects NEXT_PUBLIC_ALLOW_REGISTRATION=0", () => {
      process.env.NEXT_PUBLIC_ALLOW_REGISTRATION = "0"
      expect(getEnvRegistrationSetting()).toBe(false)
    })

    it("prioritizes ALLOW_REGISTRATION over NEXT_PUBLIC_ALLOW_REGISTRATION", () => {
      process.env.ALLOW_REGISTRATION = "false"
      process.env.NEXT_PUBLIC_ALLOW_REGISTRATION = "true"
      expect(getEnvRegistrationSetting()).toBe(false)
    })
  })

  describe("getRegistrationSetting", () => {
    it("returns default true when neither DB nor env is configured", async () => {
      vi.mocked(prisma.systemSetting.findUnique).mockResolvedValue(null)
      const res = await getRegistrationSetting(true)
      expect(res.allowRegistration).toBe(true)
      expect(res.source).toBe("default")
      expect(res.envDefault).toBeNull()
    })

    it("falls back to env when DB has no record", async () => {
      vi.mocked(prisma.systemSetting.findUnique).mockResolvedValue(null)
      process.env.ALLOW_REGISTRATION = "false"
      const res = await getRegistrationSetting(true)
      expect(res.allowRegistration).toBe(false)
      expect(res.source).toBe("env")
      expect(res.envDefault).toBe(false)
    })

    it("prioritizes database record over env variable", async () => {
      process.env.ALLOW_REGISTRATION = "true"
      vi.mocked(prisma.systemSetting.findUnique).mockResolvedValue({
        key: SYSTEM_SETTING_KEYS.ALLOW_REGISTRATION,
        value: "false",
        updatedAt: new Date(),
      })
      const res = await getRegistrationSetting(true)
      expect(res.allowRegistration).toBe(false)
      expect(res.source).toBe("database")
      expect(res.envDefault).toBe(true)
    })

    it("handles database errors gracefully and falls back to env", async () => {
      process.env.ALLOW_REGISTRATION = "false"
      vi.mocked(prisma.systemSetting.findUnique).mockRejectedValue(new Error("DB connection timeout"))
      const res = await getRegistrationSetting(true)
      expect(res.allowRegistration).toBe(false)
      expect(res.source).toBe("env")
    })
  })

  describe("setRegistrationSetting", () => {
    it("upserts value in database and invalidates cache", async () => {
      vi.mocked(prisma.systemSetting.upsert).mockResolvedValue({
        key: SYSTEM_SETTING_KEYS.ALLOW_REGISTRATION,
        value: "false",
        updatedAt: new Date(),
      })
      vi.mocked(prisma.systemSetting.findUnique).mockResolvedValue({
        key: SYSTEM_SETTING_KEYS.ALLOW_REGISTRATION,
        value: "false",
        updatedAt: new Date(),
      })

      const res = await setRegistrationSetting(false)
      expect(prisma.systemSetting.upsert).toHaveBeenCalledWith({
        where: { key: SYSTEM_SETTING_KEYS.ALLOW_REGISTRATION },
        create: { key: SYSTEM_SETTING_KEYS.ALLOW_REGISTRATION, value: "false" },
        update: { value: "false" },
      })
      expect(res.allowRegistration).toBe(false)
      expect(res.source).toBe("database")
    })
  })

  describe("resetRegistrationSetting", () => {
    it("deletes key from database to revert to env/default", async () => {
      vi.mocked(prisma.systemSetting.delete).mockResolvedValue({
        key: SYSTEM_SETTING_KEYS.ALLOW_REGISTRATION,
        value: "false",
        updatedAt: new Date(),
      })
      vi.mocked(prisma.systemSetting.findUnique).mockResolvedValue(null)

      const res = await resetRegistrationSetting()
      expect(prisma.systemSetting.delete).toHaveBeenCalledWith({
        where: { key: SYSTEM_SETTING_KEYS.ALLOW_REGISTRATION },
      })
      expect(res.source).toBe("default")
      expect(res.allowRegistration).toBe(true)
    })
  })

  describe("API Route Handlers", () => {
    it("GET /api/system/settings returns registration status", async () => {
      vi.mocked(prisma.systemSetting.findUnique).mockResolvedValue(null)
      const { GET } = await import("@/app/api/system/settings/route")
      const res = await GET()
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toHaveProperty("allowRegistration")
      expect(data).toHaveProperty("source")
    })

    it("PATCH /api/system/settings rejects unauthenticated requests", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ userId: null } as any)
      const { PATCH } = await import("@/app/api/system/settings/route")
      const req = new Request("http://localhost/api/system/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowRegistration: false }),
      })
      const res = await PATCH(req)
      expect(res.status).toBe(401)
    })

    it("PATCH /api/system/settings succeeds when authenticated", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ userId: "admin_user_123" } as any)
      vi.mocked(prisma.systemSetting.upsert).mockResolvedValue({
        key: SYSTEM_SETTING_KEYS.ALLOW_REGISTRATION,
        value: "false",
        updatedAt: new Date(),
      })
      vi.mocked(prisma.systemSetting.findUnique).mockResolvedValue({
        key: SYSTEM_SETTING_KEYS.ALLOW_REGISTRATION,
        value: "false",
        updatedAt: new Date(),
      })

      const { PATCH } = await import("@/app/api/system/settings/route")
      const req = new Request("http://localhost/api/system/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowRegistration: false }),
      })
      const res = await PATCH(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.settings.allowRegistration).toBe(false)
    })
  })
})
