"use client"

import { useEffect, useState } from "react"

/**
 * SSR-safe media query hook.
 * Returns `{ matches, mounted }`. `matches` is always `false` until after the
 * component has mounted on the client, so callers can avoid hydration
 * mismatches by branching on `mounted`.
 */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [query])

  return { matches, mounted }
}

/** Tailwind `lg` breakpoint (1024px) and up. */
export function useIsDesktop() {
  const { matches, mounted } = useMediaQuery("(min-width: 1024px)")
  return { isDesktop: matches, mounted }
}
