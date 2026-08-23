"use client"

import { EditorProvider } from "@/components/editor-store"
import { Shell } from "@/components/layout/shell"
import { useAuth } from "@clerk/nextjs"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function Page() {
  const { isLoaded, userId } = useAuth()
  const router = useRouter()
  const isE2e = process.env.E2E_TEST === "1" && process.env.NODE_ENV !== "production"

  useEffect(() => {
    if (isLoaded && !userId && !isE2e) {
      router.push("/sign-in")
    }
  }, [isLoaded, userId, router, isE2e])

  if ((!isLoaded || !userId) && !isE2e) {
    return <div style={{ padding: 20 }}>Loading Auth... isLoaded: {String(isLoaded)}, userId: {String(userId)}</div>
  }

  return (
    <EditorProvider>
      <Shell />
    </EditorProvider>
  )
}
