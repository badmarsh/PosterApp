"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex h-full min-h-[50vh] w-full flex-col items-center justify-center gap-4 bg-background p-8 text-center text-foreground">
      <div className="flex flex-col items-center gap-2">
        <h2 className="text-2xl font-semibold tracking-tight">Something went wrong</h2>
        <p className="text-sm text-muted-foreground">
          An unexpected error occurred in the application.
        </p>
        {error?.message && (
          <pre className="mt-4 max-w-[80vw] overflow-auto rounded-md bg-muted p-4 text-left text-xs">
            {error.message}
          </pre>
        )}
      </div>
      <Button onClick={() => reset()} variant="default">
        Try again
      </Button>
    </div>
  )
}
