"use client"

import { EditorProvider } from "@/components/editor-store"
import { Shell } from "@/components/layout/shell"
import { useAuth } from "@clerk/nextjs"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function Page() {
  const { isLoaded, userId } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoaded && !userId) {
      router.push("/sign-in")
    }
  }, [isLoaded, userId, router])

  if (!isLoaded || !userId) {
    return <div style={{ padding: 20 }}>Loading Auth... isLoaded: {String(isLoaded)}, userId: {String(userId)}</div>
  }

  return (
    <EditorProvider>
      <Shell />
    </EditorProvider>
  )
}
