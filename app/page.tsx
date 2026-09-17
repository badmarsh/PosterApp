"use client"

import { EditorProvider } from "@/components/editor-store"
import { Shell, AppSkeleton } from "@/components/layout/shell"
import { useAuth, RedirectToSignIn } from "@clerk/nextjs"
import { useEffect, useState } from "react"

export default function Page() {
  const { isLoaded, userId } = useAuth()
  const [isMounted, setIsMounted] = useState(false)
  const [authTimedOut, setAuthTimedOut] = useState(false)
  const isE2e = process.env.NEXT_PUBLIC_E2E_TEST === "1" && process.env.NODE_ENV !== "production"

  useEffect(() => {
    setIsMounted(true)
    const timer = setTimeout(() => {
      setAuthTimedOut(true)
    }, 4000)
    return () => clearTimeout(timer)
  }, [])

  if (!isMounted) {
    return <AppSkeleton />
  }

  // Not signed in (or auth check timed out while unauthenticated)
  if (!isE2e && (!userId && (isLoaded || authTimedOut))) {
    return <RedirectToSignIn />
  }

  // Still verifying initial authentication state
  if (!isLoaded && !isE2e) {
    return <AppSkeleton />
  }

  // Fallback guard if not authenticated
  if (!userId && !isE2e) {
    return <RedirectToSignIn />
  }

  return (
    <EditorProvider>
      <Shell />
    </EditorProvider>
  )
}
