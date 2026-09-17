import { NextResponse } from "next/server"
import { z } from "zod"
import { auth, apiError } from "@/lib/auth"
import { rateLimitAsync } from "@/lib/rate-limit"
import {
  getRegistrationSetting,
  setRegistrationSetting,
  resetRegistrationSetting,
} from "@/lib/system-settings"

const UpdateSettingsSchema = z.object({
  allowRegistration: z.boolean().optional(),
  resetToEnv: z.boolean().optional(),
})

export async function GET() {
  try {
    const settings = await getRegistrationSetting()
    return NextResponse.json(settings, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    })
  } catch (error) {
    console.error("[system-settings] GET error:", error)
    return apiError("SYSTEM_SETTINGS_ERROR", "Failed to retrieve system settings", 500)
  }
}

export async function PATCH(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return apiError("UNAUTHENTICATED", "Sign in to modify system settings", 401)
    }

    const rl = await rateLimitAsync(`system-settings:${userId}`, 20, 60_000)
    if (!rl.allowed) {
      return apiError("RATE_LIMITED", "Too many requests. Please try again shortly.", 429)
    }

    const body = await req.json().catch(() => null)
    const parsed = UpdateSettingsSchema.safeParse(body)
    if (!parsed.success) {
      return apiError("INVALID_PAYLOAD", parsed.error.issues[0]?.message || "Invalid payload", 400)
    }

    const { allowRegistration, resetToEnv } = parsed.data

    let updated
    if (resetToEnv) {
      updated = await resetRegistrationSetting()
    } else if (typeof allowRegistration === "boolean") {
      updated = await setRegistrationSetting(allowRegistration)
    } else {
      updated = await getRegistrationSetting()
    }

    return NextResponse.json({
      success: true,
      settings: updated,
    })
  } catch (error) {
    console.error("[system-settings] PATCH error:", error)
    return apiError("SYSTEM_SETTINGS_UPDATE_ERROR", "Failed to update system settings", 500)
  }
}
