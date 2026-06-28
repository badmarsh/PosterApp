"use client"

import { useEffect } from "react"

export default function GlobalError({
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
    <html lang="en">
      <body>
        <div style={{ padding: "2rem", textAlign: "center", fontFamily: "sans-serif" }}>
          <h2>Something went critically wrong</h2>
          <button
            onClick={() => reset()}
            style={{ padding: "0.5rem 1rem", marginTop: "1rem" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
