"use client"

import { EditorProvider } from "@/components/editor-store"
import { Shell, AppSkeleton } from "@/components/layout/shell"
import { useAuth, RedirectToSignIn } from "@clerk/nextjs"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"

export default function WorkspaceEditorPage() {
  const params = useParams()
  const router = useRouter()
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

  // When workspaceId is available, store it as lastWorkspaceId so the editor loads it
  useEffect(() => {
    if (!workspaceId || typeof window === "undefined") return
    // Validate workspace ID format
    if (!/^[a-zA-Z0-9_-]{3,64}$/.test(workspaceId)) {
      // Invalid ID - redirect to 404 or home
      return
    }
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

  // Validate workspace ID format - if invalid, show 404
  if (workspaceId && !/^[a-zA-Z0-9_-]{3,64}$/.test(workspaceId)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Invalid workspace ID</h1>
        <p className="max-w-md text-muted-foreground">
          The workspace ID &quot;{workspaceId}&quot; is not valid.
        </p>
        <button
          onClick={() => router.push("/")}
          className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
          data-testid="back-to-editor"
        >
          Back to the editor
        </button>
      </div>
    )
  }

  return (
    <EditorProvider>
      <Shell />
    </EditorProvider>
  )
}
