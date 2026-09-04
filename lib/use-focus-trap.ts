"use client"

import { useEffect, type RefObject } from "react"

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Minimal focus trap for custom overlays (ingestion drawer, history panel)
 * that are not base-ui Dialogs (which trap/restore focus themselves).
 *
 * - Moves focus into the overlay on mount (initialFocusRef, else first focusable).
 * - Cycles Tab / Shift+Tab inside the container.
 * - Restores focus to the previously focused element when `active` turns
 *   false or the overlay unmounts (i.e. back to the trigger button).
 *
 * `active` must mirror the overlay's open state: the hook's effect only
 * re-runs when it changes, and the container is absent while closed.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  initialFocusRef?: RefObject<HTMLElement | null>,
  active = true
) {
  useEffect(() => {
    if (!active) return
    const container = containerRef.current
    if (!container) return
    const previouslyFocused = document.activeElement as HTMLElement | null

    initialFocusRef?.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return
      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((el) => el.offsetParent !== null || el === document.activeElement)
      if (focusables.length === 0) {
        e.preventDefault()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || !container.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      } else if (!container.contains(active)) {
        e.preventDefault()
        first.focus()
      }
    }
    // Capture phase so in-overlay keydown handlers cannot leak focus out first.
    document.addEventListener("keydown", onKey, true)
    return () => {
      document.removeEventListener("keydown", onKey, true)
      previouslyFocused?.focus?.()
    }
  }, [containerRef, initialFocusRef, active])
}
