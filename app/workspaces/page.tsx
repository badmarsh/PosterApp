"use client"

import { EditorProvider } from "@/components/editor-store"
import { AppSkeleton } from "@/components/layout/shell"
import { ManageWorkspaces } from "@/components/manage-workspaces"
import { useAuth, RedirectToSignIn } from "@clerk/nextjs"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

function WorkspacesContent() {
  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-12 items-center gap-3 border-b border-border bg-card px-4">
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="size-4" />
            Back to Editor
          </Button>
        </Link>
        <h1 className="text-sm font-semibold" data-testid="workspaces-title">Workspaces</h1>
      </header>
      <main data-testid="workspaces-list" className="max-w-4xl mx-auto">
        <ManageWorkspaces />
      </main>
    </div>
  )
}

export default function WorkspacesPage() {
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
      <WorkspacesContent />
    </EditorProvider>
  )
}
