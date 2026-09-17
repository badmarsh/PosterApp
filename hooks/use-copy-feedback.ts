"use client"

import { useCallback, useRef, useState } from "react"
import { toast } from "sonner"

/**
 * useCopyFeedback — standardized clipboard helper.
 * - copies `text` to clipboard
 * - toggles a transient "copied" flag for `duration` ms so callers can flip
 *   between Copy / Check icons without managing their own timeouts
 * - surfaces a Sonner toast on success / failure for screen-reader + sighted users
 */
export function useCopyFeedback(duration = 1800) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const copy = useCallback(
    async (text: string, key = text, successMessage?: string) => {
      try {
        await navigator.clipboard.writeText(text)
        setCopiedKey(key)
        if (successMessage) toast.success(successMessage)
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => setCopiedKey(null), duration)
        return true
      } catch {
        toast.error("Copy failed", {
          description: "Clipboard access was blocked. Try selecting the text manually.",
        })
        return false
      }
    },
    [duration]
  )

  const isCopied = useCallback((key: string) => copiedKey === key, [copiedKey])

  return { copiedKey, isCopied, copy }
}
