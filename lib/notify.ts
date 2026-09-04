"use client"

import { toast as sonnerToast } from "sonner"

/**
 * Centralized user-facing notifications (UI polish plan §1.4 / Phase 4).
 *
 * Conventions:
 * - One toast per async action, with a stable title + specific description.
 * - Identical errors within DEDUPE_MS are swallowed (network blips that
 *   retry in a loop must not stack toasts).
 * - `action` carries the retry/undo affordance when it makes sense.
 * - Domain events (agent log) stay on `pushEvent`; this is the user channel.
 *
 * Client-only: SSR-safe no-op so store slices can import it unconditionally.
 */

export interface NotifyOptions {
  description?: string
  duration?: number
  action?: { label: string; onClick: () => void }
}

const DEDUPE_MS = 3000
const recentErrors = new Map<string, number>()

function errorKey(title: string, description?: string): string {
  return `${title}::${description ?? ""}`
}

function isDuplicated(key: string): boolean {
  const now = Date.now()
  const last = recentErrors.get(key)
  if (last !== undefined && now - last < DEDUPE_MS) return true
  recentErrors.set(key, now)
  if (recentErrors.size > 64) {
    for (const [k, t] of recentErrors) {
      if (now - t >= DEDUPE_MS) recentErrors.delete(k)
    }
  }
  return false
}

export const notify = {
  success(title: string, options?: NotifyOptions): void {
    if (typeof window === "undefined") return
    sonnerToast.success(title, options)
  },
  error(title: string, options?: NotifyOptions): void {
    if (typeof window === "undefined") return
    if (isDuplicated(errorKey(title, options?.description))) return
    sonnerToast.error(title, options)
  },
  warning(title: string, options?: NotifyOptions): void {
    if (typeof window === "undefined") return
    sonnerToast.warning(title, options)
  },
}
