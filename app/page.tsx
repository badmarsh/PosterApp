"use client"

import { EditorProvider } from "@/components/editor-store"
import { Shell } from "@/components/layout/shell"
import { useAuth } from "@clerk/nextjs"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export default function Page() {
  const { isLoaded, userId } = useAuth()
  const router = useRouter()
  const [isMounted, setIsMounted] = useState(false)
  const isE2e = process.env.NEXT_PUBLIC_E2E_TEST === "1" && process.env.NODE_ENV !== "production"

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (isMounted && isLoaded && !userId && !isE2e) {
      router.push("/sign-in")
    }
  }, [isMounted, isLoaded, userId, router, isE2e])

  if (!isMounted || ((!isLoaded || !userId) && !isE2e)) {
    return null // Return null to avoid hydration mismatch
  }

  return (
    <EditorProvider>
      <Shell />
    </EditorProvider>
  )
}
