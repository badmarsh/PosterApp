"use client"

import { EditorProvider } from "@/components/editor-store"
import { Shell, AppSkeleton } from "@/components/layout/shell"
import { useAuth, RedirectToSignIn } from "@clerk/nextjs"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"

export default function ThesisReviewPage() {
  const params = useParams()
  const workspaceId = params?.id as string
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

  useEffect(() => {
    if (!workspaceId || typeof window === "undefined") return
    if (!/^[a-zA-Z0-9_-]{3,64}$/.test(workspaceId)) return
    try {
      const stored = localStorage.getItem("posterapp-editor-storage")
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed?.state) {
          parsed.state.lastWorkspaceId = workspaceId
          localStorage.setItem("posterapp-editor-storage", JSON.stringify(parsed))
        }
      } else {
        localStorage.setItem("posterapp-editor-storage", JSON.stringify({
          state: { selectedCardId: null, lastWorkspaceId: workspaceId },
          version: 1
        }))
      }
    } catch {}
  }, [workspaceId])

  if (!isMounted) {
    return <AppSkeleton />
  }

  if (!isE2e && (!userId && (isLoaded || authTimedOut))) {
    return <RedirectToSignIn />
  }

  if (!isLoaded && !isE2e) {
    return <AppSkeleton />
  }

  if (!userId && !isE2e) {
    return <RedirectToSignIn />
  }

  return (
    <EditorProvider>
      <div data-testid="thesis-review-page">
        <Shell />
      </div>
    </EditorProvider>
  )
}
