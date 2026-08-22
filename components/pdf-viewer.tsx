"use client"

import { useCallback, useMemo, useRef, useState, useEffect } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"
import { Loader2 } from "lucide-react"

// Load the pdf.js worker from CDN — avoids bundler / public-dir hassle
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`

interface PdfViewerProps {
  /** PDF binary data (Uint8Array) */
  data: Uint8Array
  /** Render scale factor (1 = 100%, or 'auto' for fit-width) */
  scale: number | "auto"
  /** Called after document loads */
  onLoadSuccess?: (numPages: number) => void
  /** Called when an error occurs */
  onError?: (error: string) => void
}

export function PdfViewer({
  data,
  scale,
  onLoadSuccess,
  onError,
}: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [numPages, setNumPages] = useState(0)
  const [containerWidth, setContainerWidth] = useState<number>(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Memoize the file object so react-pdf doesn't re-parse on every render
  const file = useMemo(() => {
    const pdfData =
      data instanceof Uint8Array ? data : new Uint8Array(Object.values(data))
    return { data: pdfData.slice() }
  }, [data])

  const handleLoadSuccess = useCallback(
    ({ numPages: n }: { numPages: number }) => {
      setNumPages(n)
      onLoadSuccess?.(n)
    },
    [onLoadSuccess],
  )

  const handleError = useCallback(
    (error: Error) => {
      onError?.(error.message)
    },
    [onError],
  )

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 flex flex-col items-center gap-2 overflow-auto p-4"
    >
      <Document
        file={file}
        onLoadSuccess={handleLoadSuccess}
        onLoadError={handleError}
        loading={
          <div className="flex items-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-sm">Loading PDF…</span>
          </div>
        }
        error={
          <div className="py-12 text-center text-sm text-destructive">
            Failed to load PDF document.
          </div>
        }
      >
        {Array.from({ length: numPages }, (_, i) => (
          <Page
            key={`page-${i + 1}`}
            pageNumber={i + 1}
            scale={scale === "auto" ? undefined : scale}
            width={scale === "auto" && containerWidth ? containerWidth : undefined}
            className="mb-4 shadow-lg"
            loading={
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            }
          />
        ))}
      </Document>
    </div>
  )
}
