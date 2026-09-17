import { prisma } from "@/lib/prisma"

export const SYSTEM_SETTING_KEYS = {
  ALLOW_REGISTRATION: "allow_registration",
} as const

export type RegistrationSettingResult = {
  allowRegistration: boolean
  source: "database" | "env" | "default"
  envDefault: boolean | null
}

let cachedSetting: { data: RegistrationSettingResult; expiresAt: number } | null = null
const CACHE_TTL_MS = 5_000 // 5 seconds in-memory cache

export function parseBoolean(value: string | undefined | null): boolean | null {
  if (value === undefined || value === null || value.trim() === "") {
    return null
  }
  const normalized = value.trim().toLowerCase()
  if (["false", "0", "no", "off", "disabled"].includes(normalized)) {
    return false
  }
  if (["true", "1", "yes", "on", "enabled"].includes(normalized)) {
    return true
  }
  return null
}

export function getEnvRegistrationSetting(): boolean | null {
  const raw =
    process.env.ALLOW_REGISTRATION ??
    process.env.NEXT_PUBLIC_ALLOW_REGISTRATION
  return parseBoolean(raw)
}

export function invalidateSystemSettingsCache() {
  cachedSetting = null
}

/**
 * Resolves the effective registration permission.
 * Priority:
 * 1. Database `SystemSetting` table (`key: "allow_registration"`).
 * 2. Environment variable (`ALLOW_REGISTRATION` or `NEXT_PUBLIC_ALLOW_REGISTRATION`).
 * 3. Default: `true` (registration enabled).
 */
export async function getRegistrationSetting(skipCache = false): Promise<RegistrationSettingResult> {
  const now = Date.now()
  if (!skipCache && cachedSetting && cachedSetting.expiresAt > now) {
    return cachedSetting.data
  }

  const envVal = getEnvRegistrationSetting()

  try {
    const row = await prisma.systemSetting.findUnique({
      where: { key: SYSTEM_SETTING_KEYS.ALLOW_REGISTRATION },
    })

    if (row && row.value !== undefined && row.value !== null) {
      const parsed = parseBoolean(row.value)
      if (parsed !== null) {
        const result: RegistrationSettingResult = {
          allowRegistration: parsed,
          source: "database",
          envDefault: envVal,
        }
        cachedSetting = { data: result, expiresAt: now + CACHE_TTL_MS }
        return result
      }
    }
  } catch (err) {
    // If DB is temporarily unavailable or table not created yet, degrade gracefully to env
    console.warn("[system-settings] Failed to query SystemSetting from DB, falling back to env:", err)
  }

  const effective = envVal !== null ? envVal : true
  const source: "env" | "default" = envVal !== null ? "env" : "default"

  const result: RegistrationSettingResult = {
    allowRegistration: effective,
    source,
    envDefault: envVal,
  }
  cachedSetting = { data: result, expiresAt: now + CACHE_TTL_MS }
  return result
}

/**
 * Persists registration permission in database so all instances update immediately.
 */
export async function setRegistrationSetting(allowed: boolean): Promise<RegistrationSettingResult> {
  await prisma.systemSetting.upsert({
    where: { key: SYSTEM_SETTING_KEYS.ALLOW_REGISTRATION },
    create: {
      key: SYSTEM_SETTING_KEYS.ALLOW_REGISTRATION,
      value: String(allowed),
    },
    update: {
      value: String(allowed),
    },
  })
  invalidateSystemSettingsCache()
  return getRegistrationSetting(true)
}

/**
 * Resets the registration setting in DB, reverting to env var or default.
 */
export async function resetRegistrationSetting(): Promise<RegistrationSettingResult> {
  try {
    await prisma.systemSetting.delete({
      where: { key: SYSTEM_SETTING_KEYS.ALLOW_REGISTRATION },
    })
  } catch {
    // Ignore error if row didn't exist
  }
  invalidateSystemSettingsCache()
  return getRegistrationSetting(true)
}
