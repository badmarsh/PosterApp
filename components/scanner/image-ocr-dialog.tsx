"use client"

import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { useEditor } from "@/components/editor-store"
import { useShallow } from "zustand/react/shallow"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { apiFetch } from "@/lib/api-fetch"
import {
  Camera,
  Upload,
  Clipboard,
  Sparkles,
  Loader2,
  Check,
  Copy,
  CornerDownLeft,
  BookOpen,
  Bot,
  RefreshCw,
  Eye,
  AlertCircle,
  FileText,
  Table as TableIcon,
  Calculator,
  ImageIcon,
  X,
} from "lucide-react"
import katex from "katex"
import "katex/dist/katex.min.css"
import { cleanFormula, type EquationItem } from "@/lib/equation-types"
import { type VisionOcrResult } from "@/lib/ai/contracts"
import { cn } from "@/lib/utils"

type OcrMode = "auto" | "equation" | "table" | "text" | "figure"

function KaTeXMathPreview({ formula }: { formula: string }) {
  const html = useMemo(() => {
    try {
      const clean = cleanFormula(formula)
      if (!clean) return null
      return katex.renderToString(clean, {
        throwOnError: false,
        displayMode: true,
      })
    } catch {
      return null
    }
  }, [formula])

  if (!html) {
    return (
      <div className="overflow-x-auto rounded border border-border/70 bg-muted/40 px-3 py-2 font-mono text-[11px] select-all">
        {formula}
      </div>
    )
  }

  return (
    <div
      className="my-1 overflow-x-auto rounded border border-border/60 bg-muted/20 px-3 py-2 text-center text-foreground [&_.katex-display]:my-0 select-all"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

export function ImageOcrDialog() {
  const {
    project,
    isScannerOpen,
    setIsScannerOpen,
    scannerImage,
    setScannerImage,
    addEquation,
    insertEquation,
    selectedCardId,
    setPendingAiPrompt,
    pushEvent,
  } = useEditor(
    useShallow((s) => ({
      project: s.project,
      isScannerOpen: s.isScannerOpen,
      setIsScannerOpen: s.setIsScannerOpen,
      scannerImage: s.scannerImage,
      setScannerImage: s.setScannerImage,
      addEquation: s.addEquation,
      insertEquation: s.insertEquation,
      selectedCardId: s.selectedCardId,
      setPendingAiPrompt: s.setPendingAiPrompt,
      pushEvent: s.pushEvent,
    }))
  )

  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [ocrMode, setOcrMode] = useState<OcrMode>("auto")
  const [customPrompt, setCustomPrompt] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [ocrResult, setOcrResult] = useState<VisionOcrResult | null>(null)
  const [activeTab, setActiveTab] = useState<"scan" | "results">("scan")
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [saveAsAsset, setSaveAsAsset] = useState(true)

  // Camera capture state
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeOutput = project.outputs?.find((o) => o.id === project.activeOutputId)
  const activeCards = activeOutput?.cards ?? []
  const selectedCard = activeCards.find((c) => c.id === selectedCardId)

  // Sync incoming scannerImage from store
  useEffect(() => {
    if (scannerImage) {
      setImagePreview(scannerImage)
      setOcrResult(null)
      setActiveTab("scan")
    }
  }, [scannerImage])

  // Stop camera when dialog closes
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setIsCameraActive(false)
    setCameraError(null)
  }, [])

  useEffect(() => {
    if (!isScannerOpen) {
      stopCamera()
    }
  }, [isScannerOpen, stopCamera])

  // Start Camera
  const startCamera = async () => {
    stopCamera()
    setCameraError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      setIsCameraActive(true)
    } catch (err: any) {
      setCameraError(err?.message || "Could not access camera. Please allow camera permissions.")
      setIsCameraActive(false)
    }
  }

  // Take Snapshot from Camera
  const captureSnapshot = () => {
    if (!videoRef.current) return
    const video = videoRef.current
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL("image/jpeg", 0.92)
      setImagePreview(dataUrl)
      setScannerImage(dataUrl)
      stopCamera()
    }
  }

  // Handle File Drop / Upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setImagePreview(result)
      setScannerImage(result)
      setOcrResult(null)
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  // Global Clipboard paste listener when dialog is open
  useEffect(() => {
    if (!isScannerOpen) return

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile()
          if (file) {
            const reader = new FileReader()
            reader.onload = () => {
              const res = reader.result as string
              setImagePreview(res)
              setScannerImage(res)
              setOcrResult(null)
              stopCamera()
            }
            reader.readAsDataURL(file)
            break
          }
        }
      }
    }

    window.addEventListener("paste", handlePaste)
    return () => window.removeEventListener("paste", handlePaste)
  }, [isScannerOpen, stopCamera, setScannerImage])

  // Run OCR
  const runOcr = async () => {
    if (!imagePreview) return
    setIsProcessing(true)
    setOcrResult(null)

    try {
      const res = await apiFetch(`/api/workspaces/${project.id}/ocr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: imagePreview,
          mode: ocrMode,
          prompt: customPrompt.trim() || undefined,
          saveAsAsset,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }

      const data = await res.json()
      if (data.result) {
        setOcrResult(data.result)
        setActiveTab("results")

        pushEvent({
          kind: "info",
          status: "done",
          title: "OCR Scan Complete",
          detail: `Extracted ${data.result.equations?.length || 0} equations, ${data.result.tables?.length || 0} tables.`,
        })
      }
    } catch (err: any) {
      pushEvent({
        kind: "info",
        status: "error",
        title: "OCR Scan Failed",
        detail: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Copy to clipboard helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(id)
    setTimeout(() => setCopiedKey(null), 1800)
  }

  // Add equation to registry
  const handleAddToEquationLibrary = async (eq: { key?: string; name?: string; formula: string; description?: string }) => {
    await addEquation({
      key: eq.key || `eq:scan_${Date.now().toString(36)}`,
      name: eq.name || "Scanned Equation",
      formula: cleanFormula(eq.formula),
      description: eq.description,
      contextSnippet: ocrResult?.summary || ocrResult?.text.slice(0, 300),
    })
  }

  // Send OCR result to AI Assistant
  const handleSendToAiAssistant = () => {
    if (!ocrResult) return
    const prompt = `I scanned an image (${ocrResult.title}). Here is the extracted OCR content:

${ocrResult.text}

${ocrResult.equations?.length ? `Extracted Equations:\n${ocrResult.equations.map(e => `* ${e.name} (${e.key || "eq"}): $$${e.formula}$$`).join("\n")}\n` : ""}
Please analyze this content and suggest how to incorporate it into my ${project.outputs?.[0]?.outputType || "poster"}.`

    setPendingAiPrompt(prompt)
    setIsScannerOpen(false)
  }

  return (
    <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
      <DialogContent showCloseButton className="w-[95vw] sm:max-w-4xl md:max-w-5xl h-[88vh] p-0 overflow-hidden flex flex-col shadow-2xl border border-border bg-background">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-b border-border bg-card shrink-0 pr-12">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <DialogTitle className="text-base font-semibold tracking-tight flex items-center gap-2 text-foreground">
                <Sparkles className="size-4 text-primary" />
                Image OCR &amp; AI Vision Scanner
              </DialogTitle>
              <span className="inline-flex items-center whitespace-nowrap rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-mono font-medium text-primary border border-primary/20">
                Multimodal AI
              </span>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Scan handwritten notes, paper figures, whiteboard equations, or screenshots into LaTeX and AI Assistant.
            </DialogDescription>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "scan" | "results")}>
              <TabsList className="h-8">
                <TabsTrigger value="scan" className="text-xs h-7 px-3">
                  Capture / Upload
                </TabsTrigger>
                <TabsTrigger value="results" disabled={!ocrResult} className="text-xs h-7 px-3">
                  OCR Results {ocrResult && `(${ocrResult.equations?.length || 0} eq)`}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex flex-1 min-h-0 bg-muted/10">
          {activeTab === "scan" ? (
            <div className="flex-1 flex flex-col md:flex-row min-h-0 divide-y md:divide-y-0 md:divide-x divide-border">
              {/* Left: Input / Preview */}
              <div className="flex-1 flex flex-col p-6 overflow-y-auto">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />

                {isCameraActive ? (
                  /* Camera Viewfinder */
                  <div className="relative flex flex-col items-center justify-center flex-1 min-h-[280px] bg-black rounded-lg overflow-hidden border border-border">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-4 flex items-center gap-3">
                      <Button onClick={captureSnapshot} className="h-9 px-4 gap-2 bg-primary text-primary-foreground shadow-lg">
                        <Camera className="size-4" />
                        Take Snapshot
                      </Button>
                      <Button variant="secondary" onClick={stopCamera} className="h-9 px-3">
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : imagePreview ? (
                  /* Image Preview Box */
                  <div className="relative flex flex-col items-center justify-center flex-1 min-h-[280px] bg-muted/30 rounded-lg overflow-hidden border border-border group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreview}
                      alt="Scan Preview"
                      className="max-h-[380px] w-auto max-w-full object-contain rounded p-2"
                    />
                    <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => fileInputRef.current?.click()}
                        className="h-7 text-[11px] gap-1 bg-background/80 backdrop-blur-xs"
                      >
                        <RefreshCw className="size-3" /> Change
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="destructive"
                        onClick={() => {
                          setImagePreview(null)
                          setScannerImage(null)
                        }}
                        className="h-7 w-7"
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Dropzone & Capture Triggers */
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 min-h-[280px] border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center p-6 text-center hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer"
                  >
                    <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
                      <Upload className="size-6" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">
                      Upload, capture photo, or paste image
                    </p>
                    <p className="text-[12px] text-muted-foreground mt-1 max-w-sm">
                      Click to choose an image, or press <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-muted rounded border">Ctrl+V</kbd> anywhere to paste from clipboard.
                    </p>

                    <div className="flex items-center gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="h-8 text-[11px] gap-1.5"
                      >
                        <Upload className="size-3.5" />
                        Choose File
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={startCamera}
                        className="h-8 text-[11px] gap-1.5"
                      >
                        <Camera className="size-3.5" />
                        Live Camera Scan
                      </Button>
                    </div>

                    {cameraError && (
                      <p className="text-[11px] text-destructive mt-3 flex items-center gap-1">
                        <AlertCircle className="size-3" />
                        {cameraError}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Right: Configuration & Run */}
              <div className="w-full md:w-80 flex flex-col p-6 bg-card shrink-0 gap-4 overflow-y-auto">
                <div>
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Recognition Focus Mode
                  </Label>
                  <div className="grid grid-cols-1 gap-1.5 mt-2">
                    {[
                      { id: "auto", label: "⚡ Auto-Detect (Everything)", icon: Sparkles },
                      { id: "equation", label: "🧮 Math & Formulas (LaTeX)", icon: Calculator },
                      { id: "table", label: "📊 Tables & Data Grids", icon: TableIcon },
                      { id: "text", label: "📝 Notes & Text Paragraphs", icon: FileText },
                      { id: "figure", label: "🖼️ Figures & Schematics", icon: ImageIcon },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setOcrMode(mode.id as OcrMode)}
                        className={cn(
                          "flex items-center justify-between px-3 py-2 rounded-md border text-left text-[12px] font-medium transition-all",
                          ocrMode === mode.id
                            ? "border-primary bg-primary/10 text-primary font-semibold"
                            : "border-border hover:bg-muted/50 text-foreground"
                        )}
                      >
                        <span>{mode.label}</span>
                        {ocrMode === mode.id && <Check className="size-3.5" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="custom-ocr-prompt" className="text-[11px] font-medium text-muted-foreground uppercase">
                    Custom Prompt / AI Instruction (Optional)
                  </Label>
                  <Input
                    id="custom-ocr-prompt"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="e.g. Focus on derivation steps..."
                    className="text-[12px] h-8"
                  />
                </div>

                <div className="pt-2 border-t border-border flex items-center justify-between">
                  <label className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveAsAsset}
                      onChange={(e) => setSaveAsAsset(e.target.checked)}
                      className="rounded border-border"
                    />
                    Save image into Assets
                  </label>
                </div>

                <Button
                  onClick={runOcr}
                  disabled={!imagePreview || isProcessing}
                  className="w-full h-9 text-[12px] gap-2 mt-auto shadow-md"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Scanning with Vision AI...
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3.5" />
                      Extract &amp; OCR Content
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            /* Results View */
            <div className="flex-1 flex flex-col md:flex-row min-h-0 divide-y md:divide-y-0 md:divide-x divide-border">
              {/* Left: Original Image & Summary */}
              <div className="w-full md:w-72 flex flex-col p-5 bg-card shrink-0 gap-3 overflow-y-auto">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Scanned Source
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTab("scan")}
                    className="h-6 text-[10px]"
                  >
                    Scan Another
                  </Button>
                </div>

                {imagePreview && (
                  <div className="rounded-md border border-border overflow-hidden bg-muted/20 max-h-[220px] flex items-center justify-center p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagePreview} alt="Scanned source" className="max-h-[210px] w-auto object-contain rounded" />
                  </div>
                )}

                {ocrResult?.summary && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">Summary</span>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {ocrResult.summary}
                    </p>
                  </div>
                )}

                {/* AI Assistant Trigger Button */}
                <Button
                  variant="outline"
                  onClick={handleSendToAiAssistant}
                  className="w-full h-8 text-[11px] gap-1.5 mt-auto border-primary/30 text-primary hover:bg-primary/10"
                >
                  <Bot className="size-3.5" />
                  Discuss with AI Assistant
                </Button>
              </div>

              {/* Right: Detected Entities (Formulas, Tables, Prose) */}
              <ScrollArea className="flex-1 min-h-0 p-6">
                <div className="flex flex-col gap-6 max-w-3xl">
                  {/* Equations Section */}
                  {ocrResult?.equations && ocrResult.equations.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Calculator className="size-4 text-primary" />
                          <h4 className="text-sm font-bold text-foreground">
                            Detected Mathematical Equations ({ocrResult.equations.length})
                          </h4>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3">
                        {ocrResult.equations.map((eq, i) => (
                          <div
                            key={i}
                            className="rounded-lg border border-border bg-card p-4 shadow-xs flex flex-col gap-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                {eq.key && (
                                  <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                                    {eq.key}
                                  </span>
                                )}
                                <span className="text-[12px] font-semibold text-foreground">
                                  {eq.name || `Equation ${i + 1}`}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCopy(eq.formula, `eq_${i}`)}
                                  className="h-6 text-[10px] gap-1 text-muted-foreground"
                                >
                                  {copiedKey === `eq_${i}` ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                                  {copiedKey === `eq_${i}` ? "Copied" : "Copy LaTeX"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleAddToEquationLibrary(eq)}
                                  className="h-6 text-[10px] gap-1"
                                >
                                  <BookOpen className="size-3 text-primary" />
                                  Add to Library
                                </Button>
                                {selectedCardId && (
                                  <Button
                                    size="sm"
                                    onClick={() => insertEquation(eq.formula, selectedCardId, "display")}
                                    className="h-6 text-[10px] gap-1 shadow-xs"
                                  >
                                    <CornerDownLeft className="size-3" />
                                    Insert to Card
                                  </Button>
                                )}
                              </div>
                            </div>

                            {/* Rendered Math Preview */}
                            <KaTeXMathPreview formula={eq.formula} />

                            {eq.description && (
                              <p className="text-[10px] text-muted-foreground leading-relaxed">
                                <span className="font-semibold text-foreground/80">Definition: </span>
                                {eq.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tables Section */}
                  {ocrResult?.tables && ocrResult.tables.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <TableIcon className="size-4 text-primary" />
                        <h4 className="text-sm font-bold text-foreground">
                          Detected Tables ({ocrResult.tables.length})
                        </h4>
                      </div>

                      <div className="flex flex-col gap-3">
                        {ocrResult.tables.map((t, i) => (
                          <div key={i} className="rounded-lg border border-border bg-card p-4 shadow-xs space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[12px] font-semibold text-foreground">
                                {t.caption || `Table ${i + 1}`}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopy(t.markdown || "", `tbl_${i}`)}
                                className="h-6 text-[10px] gap-1"
                              >
                                {copiedKey === `tbl_${i}` ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                                Copy Markdown
                              </Button>
                            </div>
                            <pre className="p-2.5 bg-muted/40 rounded border border-border/60 font-mono text-[11px] overflow-x-auto whitespace-pre">
                              {t.markdown || JSON.stringify(t.rows, null, 2)}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Full Text Transcription Section */}
                  {ocrResult?.text && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="size-4 text-primary" />
                          <h4 className="text-sm font-bold text-foreground">
                            Full Markdown Transcription
                          </h4>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(ocrResult.text, "full_text")}
                          className="h-6 text-[10px] gap-1"
                        >
                          {copiedKey === "full_text" ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                          Copy Markdown
                        </Button>
                      </div>

                      <div className="rounded-lg border border-border bg-card p-4 text-[12px] leading-relaxed font-mono whitespace-pre-wrap select-all">
                        {ocrResult.text}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
