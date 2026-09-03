"use client"

import { useCallback, useMemo, useRef, useState, useEffect } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"
import { Loader2 } from "lucide-react"

// Keep the worker version coupled to react-pdf/pdfjs; no third-party CDN or
// external script is involved in rendering private documents.
pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString()

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
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = containerRef.current
    setScrollRoot(el)
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setContainerWidth(entries[0].contentRect.width)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Clone the buffer for react-pdf so its worker transfer does not detach the store's buffer.
  const file = useMemo(() => {
    let fingerprint = ""
    try {
      if (data && data.byteLength > 0 && !(data.buffer as any)?.detached) {
        fingerprint = `${data.byteLength}:${Array.from(data.subarray(0, 16)).join(",")}:${Array.from(data.subarray(-16)).join(",")}`
      } else {
        fingerprint = "pdf-empty"
      }
    } catch {
      fingerprint = "pdf-unreadable"
    }
    return { data: data.slice(), fingerprint }
  }, [data])

  const handleLoadSuccess = useCallback(
    ({ numPages: n }: { numPages: number }) => {
      setNumPages(n)
      if (containerRef.current) {
        containerRef.current.scrollTop = 0
      }
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
        key={file.fingerprint}
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
        {Array.from({ length: numPages }, (_, i) => {
          const page = i + 1
          return (
            <LazyPage
              key={`page-${page}`}
              root={scrollRoot}
              pageNumber={page}
              scale={scale === "auto" ? undefined : scale}
              width={scale === "auto" && containerWidth ? containerWidth : undefined}
            />
          )
        })}
      </Document>
    </div>
  )
}

/**
 * Renders a react-pdf <Page> only when it is near the viewport. A 60-page thesis
 * otherwise mounts 60 canvases + text layers at once, which stalls scrolling and
 * balloons memory. Pages keep their last measured height when unmounted so the
 * scrollbar does not jump.
 */
function LazyPage({
  root,
  pageNumber,
  scale,
  width,
}: {
  root: HTMLDivElement | null
  pageNumber: number
  scale?: number
  width?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(pageNumber <= 2)
  const [height, setHeight] = useState<number | undefined>(undefined)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true)
          } else if (entry.target === el) {
            const h = el.getBoundingClientRect().height
            if (h > 0) setHeight(h)
            setVisible(false)
          }
        }
      },
      { root, rootMargin: "150% 0px" },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [root])

  // Width/scale changes invalidate the cached placeholder height.
  useEffect(() => { setHeight(undefined) }, [scale, width])

  return (
    <div ref={ref} className="mb-4 shrink-0" style={!visible && height ? { height, width } : undefined}>
      {visible ? (
        <Page
          pageNumber={pageNumber}
          scale={scale}
          width={width}
          className="shadow-lg"
          loading={
            <div className="flex h-32 items-center justify-center" style={height ? { height } : undefined}>
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          }
        />
      ) : (
        <div className="flex items-center justify-center rounded bg-muted/30 text-[10px] text-muted-foreground" style={{ height: height ?? 320, width }}>
          {pageNumber}
        </div>
      )}
    </div>
  )
}
