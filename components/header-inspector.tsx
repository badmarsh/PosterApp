"use client"

import { useState, useRef, useEffect } from "react"
import {
  Lock,
  Sparkles,
  Download,
  Check,
  Palette,
  RotateCcw,
  MonitorPlay,
  BookOpen,
  LayoutTemplate,
  Info,
  Upload,
  Loader2,
  QrCode,
} from "lucide-react"
import { apiFetch } from "@/lib/api-fetch"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useEditor } from "@/components/editor-store"
import { useShallow } from "zustand/react/shallow"
import { generateFullTemplate } from "@/lib/latex"
import { OUTPUT_TYPE_LABELS, getTemplateDef, getTemplatesForType } from "@/lib/output-types"
import { resolveOutputMetadata } from "@/lib/poster-types"
import type { OutputType } from "@/lib/output-types"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const SKIP_PATTERNS = new Set(["title-slide", "references"])

const ITEM_UNITS: Record<OutputType, { singular: string; plural: string }> = {
  slides: { singular: "slide", plural: "slides" },
  paper: { singular: "page", plural: "pages" },
  poster: { singular: "card", plural: "cards" },
}

/* -------------------------------------------------------------------------
 * Micro-Illustrations for Operations
 * ------------------------------------------------------------------------- */

function ScaffoldIllustration({ outputType }: { outputType: OutputType }) {
  if (outputType === "slides") {
    return (
      <svg
        viewBox="0 0 56 40"
        className="size-full shrink-0"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Slide 3 (back) */}
        <rect x="14" y="4" width="36" height="22" rx="2.5" className="fill-muted stroke-border/70" strokeWidth="1" />
        {/* Slide 2 (middle) */}
        <rect x="8" y="9" width="36" height="22" rx="2.5" className="fill-card stroke-border" strokeWidth="1" />
        {/* Slide 1 (front) */}
        <rect x="2" y="14" width="36" height="22" rx="2.5" className="fill-background stroke-primary/50" strokeWidth="1.2" />
        <rect x="5" y="17" width="14" height="2" rx="0.5" className="fill-primary" />
        <rect x="5" y="21" width="22" height="1.5" rx="0.5" className="fill-muted-foreground/40" />
        <rect x="5" y="24" width="18" height="1.5" rx="0.5" className="fill-muted-foreground/30" />
        <rect x="5" y="27" width="26" height="1.5" rx="0.5" className="fill-muted-foreground/30" />
        <rect x="5" y="30" width="12" height="1.5" rx="0.5" className="fill-primary/60" />
        {/* Sparkle */}
        <path d="M46 16L47.5 20L51.5 21.5L47.5 23L46 27L44.5 23L40.5 21.5L44.5 20L46 16Z" className="fill-amber-500" />
      </svg>
    )
  }
  if (outputType === "paper") {
    return (
      <svg
        viewBox="0 0 56 40"
        className="size-full shrink-0"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Page */}
        <rect x="10" y="3" width="36" height="34" rx="2" className="fill-background stroke-primary/50" strokeWidth="1.2" />
        <rect x="15" y="6" width="26" height="2" rx="0.5" className="fill-primary" />
        <rect x="18" y="10" width="20" height="1.5" rx="0.5" className="fill-muted-foreground/40" />
        {/* Two columns */}
        <rect x="14" y="14" width="12" height="2" rx="0.5" className="fill-primary/70" />
        <rect x="14" y="18" width="12" height="1.5" rx="0.5" className="fill-muted-foreground/30" />
        <rect x="14" y="21" width="12" height="1.5" rx="0.5" className="fill-muted-foreground/30" />
        <rect x="14" y="24" width="10" height="1.5" rx="0.5" className="fill-muted-foreground/30" />
        <rect x="14" y="27" width="12" height="6" rx="1" className="fill-muted stroke-border" strokeWidth="0.8" />

        <rect x="30" y="14" width="12" height="2" rx="0.5" className="fill-primary/70" />
        <rect x="30" y="18" width="12" height="1.5" rx="0.5" className="fill-muted-foreground/30" />
        <rect x="30" y="21" width="12" height="1.5" rx="0.5" className="fill-muted-foreground/30" />
        <rect x="30" y="24" width="12" height="1.5" rx="0.5" className="fill-muted-foreground/30" />
        <rect x="30" y="27" width="9" height="1.5" rx="0.5" className="fill-muted-foreground/30" />
        {/* Sparkle */}
        <path d="M48 6L49 9L52 10L49 11L48 14L47 11L44 10L47 9L48 6Z" className="fill-amber-500" />
      </svg>
    )
  }
  // Poster
  return (
    <svg
      viewBox="0 0 56 40"
      className="size-full shrink-0"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="6" y="3" width="44" height="34" rx="2" className="fill-background stroke-primary/50" strokeWidth="1.2" />
      {/* Header bar */}
      <rect x="8" y="5" width="40" height="5" rx="1" className="fill-primary/20 stroke-primary/40" strokeWidth="0.8" />
      <rect x="10" y="7" width="22" height="1.5" rx="0.5" className="fill-primary" />
      {/* Col 1 */}
      <rect x="8" y="12" width="11" height="9" rx="1" className="fill-muted stroke-border" strokeWidth="0.8" />
      <rect x="8" y="23" width="11" height="12" rx="1" className="fill-muted stroke-border" strokeWidth="0.8" />
      {/* Col 2 */}
      <rect x="22" y="12" width="12" height="14" rx="1" className="fill-muted stroke-border" strokeWidth="0.8" />
      <rect x="22" y="28" width="12" height="7" rx="1" className="fill-muted stroke-border" strokeWidth="0.8" />
      {/* Col 3 */}
      <rect x="37" y="12" width="11" height="11" rx="1" className="fill-muted stroke-border" strokeWidth="0.8" />
      <rect x="37" y="25" width="11" height="10" rx="1" className="fill-muted stroke-border" strokeWidth="0.8" />
      {/* Sparkle */}
      <path d="M49 4L50 7L53 8L50 9L49 12L48 9L45 8L48 7L49 4Z" className="fill-amber-500" />
    </svg>
  )
}

function FillEmptyIllustration() {
  return (
    <svg
      viewBox="0 0 56 40"
      className="size-full shrink-0"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Left empty skeleton block (dashed) */}
      <rect
        x="3"
        y="8"
        width="18"
        height="24"
        rx="2"
        className="fill-background stroke-muted-foreground/40"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      <rect x="6" y="12" width="10" height="2" rx="0.5" className="fill-muted-foreground/30" />
      <path d="M12 19V25M9 22H15" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-muted-foreground/40" />

      {/* Arrow / transition stream */}
      <path
        d="M24 20H30M30 20L27.5 17.5M30 20L27.5 22.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-blue-500"
      />
      <circle cx="27" cy="14" r="1" className="fill-amber-400" />

      {/* Right filled card */}
      <rect
        x="34"
        y="8"
        width="19"
        height="24"
        rx="2"
        className="fill-card stroke-blue-500/60"
        strokeWidth="1.2"
      />
      <rect x="37" y="11" width="10" height="2" rx="0.5" className="fill-blue-600 dark:fill-blue-400" />
      <rect x="37" y="15" width="13" height="1.2" rx="0.5" className="fill-muted-foreground/40" />
      <rect x="37" y="18" width="11" height="1.2" rx="0.5" className="fill-muted-foreground/30" />
      <rect x="37" y="21" width="13" height="6" rx="1" className="fill-blue-500/10 stroke-blue-500/30" strokeWidth="0.8" />
      <circle cx="49" cy="9" r="3.5" className="fill-blue-600 text-white" />
      <path d="M47.5 9L48.5 10L50.5 8" stroke="white" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function AiReviewIllustration() {
  return (
    <svg
      viewBox="0 0 56 40"
      className="size-full shrink-0"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="scanBeam" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#10B981" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      {/* Base doc */}
      <rect x="8" y="5" width="40" height="30" rx="2.5" className="fill-card stroke-border" strokeWidth="1" />
      <rect x="12" y="9" width="16" height="2" rx="0.5" className="fill-foreground/60" />
      <rect x="12" y="14" width="32" height="1.5" rx="0.5" className="fill-muted-foreground/30" />
      <rect x="12" y="18" width="24" height="1.5" rx="0.5" className="fill-muted-foreground/30" />
      <rect x="12" y="22" width="28" height="1.5" rx="0.5" className="fill-muted-foreground/30" />

      {/* Scanning radar beam */}
      <path d="M8 12L48 24V32L8 20Z" fill="url(#scanBeam)" />
      <line x1="8" y1="16" x2="48" y2="28" stroke="#10B981" strokeWidth="1" strokeDasharray="3 2" className="opacity-70" />

      {/* Check badge */}
      <circle cx="39" cy="11" r="4.5" className="fill-emerald-500/20 stroke-emerald-500" strokeWidth="1" />
      <path d="M37.5 11L38.5 12L40.5 10" stroke="#10B981" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />

      {/* Sparkle */}
      <path d="M46 2L47 5L50 6L47 7L46 10L45 7L42 6L45 5L46 2Z" className="fill-amber-400" />
    </svg>
  )
}

function ExportIllustration() {
  return (
    <svg
      viewBox="0 0 56 40"
      className="size-full shrink-0"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* File Page */}
      <path
        d="M14 6C14 4.89543 14.8954 4 16 4H32L42 14V34C42 35.1046 41.1046 36 40 36H16C14.8954 36 14 35.1046 14 34V6Z"
        className="fill-card stroke-border"
        strokeWidth="1"
      />
      {/* Folded corner */}
      <path d="M32 4V14H42" className="fill-muted stroke-border" strokeWidth="1" />
      {/* TeX code icon / tag */}
      <rect x="18" y="12" width="11" height="5" rx="1" className="fill-primary/10 stroke-primary/30" strokeWidth="0.8" />
      <text x="19.2" y="15.8" fontSize="3.2" fontWeight="bold" fill="currentColor" className="text-primary font-mono">
        TEX
      </text>

      <rect x="18" y="20" width="18" height="1.5" rx="0.5" className="fill-muted-foreground/30" />
      <rect x="18" y="23" width="14" height="1.5" rx="0.5" className="fill-muted-foreground/30" />

      {/* Download Tray & Arrow */}
      <circle cx="36" cy="27" r="7" className="fill-background stroke-border shadow-sm" strokeWidth="1" />
      <path
        d="M36 23V29M36 29L33.5 26.5M36 29L38.5 26.5M32.5 31H39.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-primary"
      />
    </svg>
  )
}

function RagSourcesIllustration() {
  return (
    <svg
      viewBox="0 0 56 40"
      className="size-full shrink-0"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Back doc */}
      <rect x="14" y="6" width="22" height="28" rx="2" className="fill-muted stroke-border/70" strokeWidth="1" />
      {/* Front doc */}
      <rect x="8" y="10" width="22" height="28" rx="2" className="fill-card stroke-border" strokeWidth="1.2" />
      <rect x="12" y="14" width="8" height="2" rx="0.5" className="fill-primary" />
      <rect x="12" y="18" width="14" height="1.5" rx="0.5" className="fill-muted-foreground/40" />
      <rect x="12" y="21" width="12" height="1.5" rx="0.5" className="fill-muted-foreground/30" />
      <rect x="12" y="24" width="14" height="1.5" rx="0.5" className="fill-muted-foreground/30" />

      {/* RAG Context Filter Shield / Funnel */}
      <circle cx="38" cy="22" r="10" className="fill-background stroke-primary/50" strokeWidth="1.2" />
      <path
        d="M33 17H43L39 22V27L37 28V22L33 17Z"
        className="fill-primary/20 stroke-primary"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {/* Sparkle */}
      <path d="M47 8L48 11L51 12L48 13L47 16L46 13L43 12L46 11L47 8Z" className="fill-amber-500" />
    </svg>
  )
}

/* -------------------------------------------------------------------------
 * Main Header Inspector Component
 * ------------------------------------------------------------------------- */

export function HeaderInspector() {
  const {
    project,
    updateActiveOutput,
    updateActiveThemeColor,
    autoFillAllCardsAction,
    generateNewOutputStructure,
    aiReview,
    pushEvent,
    setHeaderUnlocked,
    generatingIds,
  } = useEditor(
    useShallow((s) => ({
      project: s.project,
      updateActiveOutput: s.updateActiveOutput,
      updateActiveThemeColor: s.updateActiveThemeColor,
      autoFillAllCardsAction: s.autoFillAllCardsAction,
      generateNewOutputStructure: s.generateNewOutputStructure,
      aiReview: s.aiReview,
      pushEvent: s.pushEvent,
      setHeaderUnlocked: s.setHeaderUnlocked,
      generatingIds: s.generatingIds,
    }))
  )

  const activeOutput = project.outputs?.find((o) => o.id === project.activeOutputId)
  const activeOutputType = (activeOutput?.outputType ?? "poster") as OutputType
  const templateDef = getTemplateDef(activeOutput?.templateId ?? "atlas")
  const activeThemeColor = activeOutput?.themeColor ?? null
  const outputTypeLabel = OUTPUT_TYPE_LABELS[activeOutputType]

  const ITEM_COUNT_DEFAULTS: Record<OutputType, number> = { poster: 9, slides: 10, paper: 6 }
  const [itemCount, setItemCount] = useState<number>(ITEM_COUNT_DEFAULTS[activeOutputType])
  const headerLogoInputRef = useRef<HTMLInputElement>(null)
  const [isUploadingHeaderLogo, setIsUploadingHeaderLogo] = useState(false)

  // QR Code state
  const [qrUrl, setQrUrl] = useState("")
  const [qrLabel, setQrLabel] = useState("Scan for Paper & Code")
  const [isGeneratingQr, setIsGeneratingQr] = useState(false)
  const [qrAssetUrl, setQrAssetUrl] = useState<string | null>(null)

  useEffect(() => {
    const existingQr = project.assets?.find((a) => a.filename === "qrcode.png")
    if (existingQr) {
      setQrAssetUrl(existingQr.url ?? null)
    }
  }, [project.assets])

  async function handleGenerateQr() {
    if (!qrUrl.trim() || isGeneratingQr) return
    setIsGeneratingQr(true)
    try {
      const res = await apiFetch(`/api/workspaces/${project.id}/qr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: qrUrl.trim(), label: qrLabel.trim() }),
      })
      const data = await res.json()
      if (data.ok) {
        setQrAssetUrl(data.url)
        pushEvent({
          kind: "info",
          status: "done",
          title: "QR Code Generated",
          detail: `Generated interactive QR code asset linking to ${qrUrl}`,
        })
      }
    } finally {
      setIsGeneratingQr(false)
    }
  }

  useEffect(() => {
    setItemCount(ITEM_COUNT_DEFAULTS[activeOutputType])
  }, [activeOutputType])

  const metadata = resolveOutputMetadata(project, activeOutput)

  const isBulkRunning = generatingIds.length > 0

  const unit = ITEM_UNITS[activeOutputType]

  const emptyCardsCount = (activeOutput?.cards ?? []).filter(
    (c) => !SKIP_PATTERNS.has(c.pattern) && (!c.content || c.content.trim() === "")
  ).length

  const handleGenerateNew = async () => {
    if (
      confirm(
        `Generate new ${activeOutputType} (${itemCount} ${unit.plural})?\n\nThis will replace existing ${unit.plural} with a fresh structure tailored to your RAG sources, and fill it with grounded content.`
      )
    ) {
      await generateNewOutputStructure(activeOutputType, itemCount)
    }
  }

  function exportTex() {
    const targetOutput = activeOutput || project.outputs?.[0]
    if (!targetOutput) {
      pushEvent({
        kind: "info",
        status: "error",
        title: "Export Failed",
        detail: "No active output found.",
      })
      return
    }
    const tex = generateFullTemplate(project, targetOutput, project.id)
    const blob = new Blob([tex], { type: "text/x-tex" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${project.id}_${targetOutput.outputType}.tex`
    a.click()
    URL.revokeObjectURL(url)
    pushEvent({
      kind: "info",
      status: "done",
      title: `Exported ${targetOutput.outputType}.tex`,
      detail: "LaTeX source file downloaded.",
    })
  }

  const OutputIcon =
    activeOutputType === "slides"
      ? MonitorPlay
      : activeOutputType === "paper"
      ? BookOpen
      : LayoutTemplate

  return (
    <section
      aria-label={`${outputTypeLabel} header settings`}
      className="flex w-full shrink-0 flex-col border-l border-border bg-card lg:w-[26rem] h-full min-h-0"
    >
      {/* Header bar */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border p-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
            <OutputIcon className="size-4" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">
              {outputTypeLabel} Header & Actions
            </h2>
            <p className="text-[10px] text-muted-foreground">
              Overrides project defaults for this {activeOutputType}
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-[11px]"
          onClick={() => setHeaderUnlocked(false)}
          title="Lock template header"
        >
          <Lock className="size-3" />
          Lock
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-6 p-4">
          {/* Section: Operations */}
          <div className="space-y-3">
            {/* Operation 1: Generate New Document */}
            <div className="rounded-lg border border-border bg-card p-3 space-y-2.5 shadow-sm">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-semibold text-foreground">
                  Generate New {outputTypeLabel}
                </Label>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono font-medium">
                  (Replaces all {unit.plural})
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-12 h-9 shrink-0">
                  <ScaffoldIllustration outputType={activeOutputType} />
                </div>
                <p className="text-[10px] text-muted-foreground leading-snug">
                  Replaces existing {unit.plural} with a fresh {outputTypeLabel.toLowerCase()} structure and fills it with content from your sources.
                </p>
              </div>

              <div className="pt-0.5 space-y-1.5">
                {activeOutputType === "paper" && (
                  <p className="text-[10px] text-muted-foreground italic leading-snug">
                    Sections include Abstract + numbered body sections + References.
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {activeOutputType === "paper" ? "Sections:" : activeOutputType === "slides" ? "Slides:" : "Cards:"}
                    </span>
                    <Input
                      type="number"
                      min={activeOutputType === "paper" ? 3 : 3}
                      max={activeOutputType === "slides" ? 25 : activeOutputType === "poster" ? 15 : 12}
                      value={itemCount}
                      onChange={(e) => {
                        const maxVal = activeOutputType === "slides" ? 25 : activeOutputType === "poster" ? 15 : 12
                        setItemCount(
                          Math.max(3, Math.min(maxVal, parseInt(e.target.value) || 3))
                        )
                      }}
                      className="h-7 w-12 text-center text-xs bg-background px-1 font-mono"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 flex-1 justify-center gap-1.5 text-[11px]"
                    onClick={handleGenerateNew}
                    disabled={isBulkRunning}
                  >
                    <Sparkles className="size-3 text-amber-500 dark:text-amber-400" />
                    Generate New {outputTypeLabel}
                  </Button>
                </div>
              </div>
            </div>

            {/* Operation 2: Generate contents for empty items */}
            <div className="rounded-lg border border-border bg-card p-3 space-y-2.5 shadow-sm">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-semibold text-foreground">
                  Generate Contents for Empty Items
                </Label>
                {emptyCardsCount > 0 && (
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono font-medium">
                    ({emptyCardsCount} empty)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="w-12 h-9 shrink-0">
                  <FillEmptyIllustration />
                </div>
                <p className="text-[10px] text-muted-foreground leading-snug">
                  Fills empty {unit.plural} on canvas with content based on your structure and sources.
                </p>
              </div>

              <div className="pt-0.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-center gap-1.5 text-[11px] h-7"
                  onClick={() => autoFillAllCardsAction()}
                  disabled={isBulkRunning}
                >
                  <Sparkles className="size-3 text-blue-500 dark:text-blue-400" />
                  Generate contents for empty {unit.plural}
                </Button>
              </div>
            </div>

            {/* Operation 3: Run AI Review */}
            <div className="rounded-lg border border-border bg-card p-3 space-y-2.5 shadow-sm">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-semibold text-foreground">
                  AI Quality Review
                </Label>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-12 h-9 shrink-0">
                  <AiReviewIllustration />
                </div>
                <p className="text-[10px] text-muted-foreground leading-snug">
                  Reviews layout balance, overflows, missing citations, and posts actionable suggestions to the AI Assistant.
                </p>
              </div>

              <div className="pt-0.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-center gap-1.5 text-[11px] h-7"
                  onClick={() => aiReview()}
                >
                  <Sparkles className="size-3 text-primary" />
                  Run AI Review
                </Button>
              </div>
            </div>

            {/* Operation: Data Sources for Autofill */}
            {(project.ingestFiles || []).length > 0 && (
              <div className="rounded-lg border border-border bg-card p-3 space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-semibold text-foreground">
                    Data Sources for Autofill
                  </Label>
                  {activeOutput?.sourceIds && activeOutput.sourceIds.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => updateActiveOutput({ sourceIds: [] })}
                      className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                    >
                      <RotateCcw className="size-2.5" /> Use all files
                    </button>
                  ) : (
                    <span className="text-[10px] font-mono text-muted-foreground/70">
                      (All files active)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-12 h-9 shrink-0">
                    <RagSourcesIllustration />
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-snug">
                    Restrict the Gemini RAG context to these specific files. All {unit.plural} inherit this setting.
                  </p>
                </div>

                <div className="flex flex-col gap-1.5 pt-1.5 border-t border-border/50">
                  {(project.ingestFiles || []).map((file) => {
                    const outputSources = activeOutput?.sourceIds || []
                    const isSelected = outputSources.length === 0 || outputSources.includes(file.id)

                    return (
                      <div key={file.id} className="flex items-center justify-between gap-2 py-0.5">
                        <span className="truncate text-[11px] text-foreground font-medium" title={file.name}>
                          {file.name}
                        </span>
                        <Switch
                          size="sm"
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            let next: string[]
                            if (outputSources.length === 0) {
                              next = checked
                                ? []
                                : (project.ingestFiles || []).filter((f) => f.id !== file.id).map((f) => f.id)
                            } else {
                              next = checked
                                ? [...outputSources, file.id]
                                : outputSources.filter((id) => id !== file.id)
                            }
                            if (next.length === (project.ingestFiles || []).length) {
                              next = []
                            }
                            updateActiveOutput({ sourceIds: next })
                          }}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Operation 4: Export Document */}
            <div className="rounded-lg border border-border bg-card p-3 space-y-2.5 shadow-sm">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-semibold text-foreground">
                  Export Document
                </Label>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-12 h-9 shrink-0">
                  <ExportIllustration />
                </div>
                <p className="text-[10px] text-muted-foreground leading-snug">
                  Downloads the complete standalone LaTeX source file ready for compilation.
                </p>
              </div>

              <div className="pt-0.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-center gap-1.5 text-[11px] h-7"
                  onClick={exportTex}
                >
                  <Download className="size-3 text-primary" />
                  Export LaTeX ({activeOutputType}.tex)
                </Button>
              </div>
            </div>
          </div>

          {/* Section: Header Overrides */}
          <div className="space-y-3.5 pt-2">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Document & Header Settings
              </span>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Info className="size-3" /> Inherits from left panel
              </span>
            </div>

            {/* Template Switcher */}
            <div className="space-y-1.5 pb-2 border-b border-border/50">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-medium text-foreground">
                  Active Template
                </Label>
                <span className="text-[10px] font-mono text-muted-foreground/70">
                  {getTemplatesForType(activeOutputType).length} available
                </span>
              </div>
              <Select
                value={activeOutput?.templateId ?? "atlas"}
                onValueChange={(val) => {
                  if (val) updateActiveOutput({ templateId: val })
                }}
              >
                <SelectTrigger className="w-full h-8 text-[12px] bg-background">
                  <SelectValue placeholder="Choose a template" />
                </SelectTrigger>
                <SelectContent>
                  {getTemplatesForType(activeOutputType).map((tmpl) => (
                    <SelectItem key={tmpl.id} value={tmpl.id} className="text-[12px]">
                      <div className="flex items-center justify-between gap-2 w-full">
                        <span>{tmpl.label}</span>
                        {tmpl.category === "institutional" && (
                          <span className="rounded bg-amber-100 dark:bg-amber-900/40 px-1 py-px text-[9px] font-bold text-amber-700 dark:text-amber-400">
                            ATLAS
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {templateDef && (
                <p className="text-[10px] text-muted-foreground leading-snug">
                  {templateDef.description}
                </p>
              )}
            </div>

            {/* Title */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-medium text-foreground">
                  {outputTypeLabel} Title
                </Label>
                {metadata.isTitleOverridden ? (
                  <button
                    type="button"
                    onClick={() => updateActiveOutput({ title: "" })}
                    className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                  >
                    <RotateCcw className="size-2.5" /> Reset to default
                  </button>
                ) : (
                  <span className="text-[10px] font-mono text-muted-foreground/70">
                    (Inherited)
                  </span>
                )}
              </div>
              <Textarea
                value={activeOutput?.title ?? ""}
                onChange={(e) => updateActiveOutput({ title: e.target.value })}
                placeholder={metadata.defaultTitle}
                className="min-h-16 resize-none text-[12px] font-medium leading-tight bg-background"
              />
              <p className="text-[10px] text-muted-foreground">
                Leave blank to inherit global title:{" "}
                <span className="font-semibold">{metadata.defaultTitle}</span>
              </p>
            </div>

            {/* Authors */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-medium text-foreground">
                  Authors & Affiliations
                </Label>
                {metadata.isAuthorsOverridden ? (
                  <button
                    type="button"
                    onClick={() => updateActiveOutput({ authors: null })}
                    className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                  >
                    <RotateCcw className="size-2.5" /> Reset to default
                  </button>
                ) : (
                  <span className="text-[10px] font-mono text-muted-foreground/70">
                    (Inherited)
                  </span>
                )}
              </div>
              <Textarea
                value={activeOutput?.authors ?? ""}
                onChange={(e) => updateActiveOutput({ authors: e.target.value })}
                placeholder={metadata.defaultAuthors || "e.g. A. Reyes, M. Okafor"}
                className="min-h-16 resize-none text-[11px] bg-background"
              />
              <p className="text-[10px] text-muted-foreground">
                Leave blank to inherit global authors:{" "}
                <span className="font-semibold">
                  {metadata.defaultAuthors || "None configured"}
                </span>
              </p>
            </div>

            {/* Venue */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-medium text-foreground">
                  Conference / Venue
                </Label>
                {metadata.isVenueOverridden ? (
                  <button
                    type="button"
                    onClick={() => updateActiveOutput({ venue: null })}
                    className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                  >
                    <RotateCcw className="size-2.5" /> Reset to default
                  </button>
                ) : (
                  <span className="text-[10px] font-mono text-muted-foreground/70">
                    (Inherited)
                  </span>
                )}
              </div>
              <Input
                value={activeOutput?.venue ?? ""}
                onChange={(e) => updateActiveOutput({ venue: e.target.value })}
                placeholder={metadata.defaultVenue || "e.g. CoRL 2026"}
                className="h-8 text-[11px] bg-background"
              />
              <p className="text-[10px] text-muted-foreground">
                Leave blank to inherit global venue:{" "}
                <span className="font-semibold">
                  {metadata.defaultVenue || "None configured"}
                </span>
              </p>
            </div>

            {/* Logo Override (for logo-enabled templates like ATLAS) */}
            {activeOutput?.templateId === "atlas" && (
              <div className="space-y-1.5 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-medium text-foreground">
                    Document Logo
                  </Label>
                  {metadata.isLogoOverridden ? (
                    <button
                      type="button"
                      onClick={() => updateActiveOutput({ logoUrl: null })}
                      className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                    >
                      <RotateCcw className="size-2.5" /> Reset to project logo
                    </button>
                  ) : (
                    <span className="text-[10px] font-mono text-muted-foreground/70">
                      (Inherited)
                    </span>
                  )}
                </div>

                {metadata.logoUrl ? (
                  <div className="flex items-center justify-between gap-2 p-2 rounded-md border border-border bg-muted/20">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="size-8 rounded border border-border bg-background flex items-center justify-center overflow-hidden p-0.5 shrink-0">
                        <img
                          src={metadata.logoUrl}
                          alt="Document Logo"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium truncate">
                          {metadata.isLogoOverridden ? "Custom Document Logo" : "Project Default Logo"}
                        </p>
                        <button
                          type="button"
                          onClick={() => headerLogoInputRef.current?.click()}
                          className="text-[9px] text-primary hover:underline"
                          disabled={isUploadingHeaderLogo}
                        >
                          {isUploadingHeaderLogo ? "Uploading..." : "Override logo"}
                        </button>
                      </div>
                    </div>
                    {metadata.isLogoOverridden && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => updateActiveOutput({ logoUrl: null })}
                        className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                        title="Remove override"
                      >
                        <RotateCcw className="size-3" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-center text-[11px] h-7 gap-1.5 border-dashed"
                    onClick={() => headerLogoInputRef.current?.click()}
                    disabled={isUploadingHeaderLogo}
                  >
                    {isUploadingHeaderLogo ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Upload className="size-3" />
                    )}
                    {isUploadingHeaderLogo ? "Uploading..." : "Override Document Logo"}
                  </Button>
                )}
                <input
                  ref={headerLogoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setIsUploadingHeaderLogo(true)
                      try {
                        const formData = new FormData()
                        formData.append("file", file)
                        const res = await apiFetch(`/api/workspaces/${project.id}/assets/upload`, {
                          method: "POST",
                          body: formData,
                        })
                        const data = await res.json()
                        if (data.ok) {
                          updateActiveOutput({ logoUrl: data.asset.url })
                        }
                      } finally {
                        setIsUploadingHeaderLogo(false)
                      }
                    }
                    e.target.value = ""
                  }}
                />
              </div>
            )}

            {/* Accent Theme Color */}
            {templateDef && templateDef.colors.length > 1 && (
              <div className="space-y-1.5 pt-2 border-t border-border">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Palette className="size-3 text-muted-foreground" />
                  <Label className="text-[11px] font-medium text-muted-foreground">
                    Template Accent Colour
                  </Label>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {templateDef.colors.map((c) => (
                    <button
                      key={c.id}
                      title={c.name}
                      onClick={() => updateActiveThemeColor(c.hex)}
                      className="group relative size-6 rounded-full border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      style={{
                        backgroundColor: c.hex,
                        borderColor: activeThemeColor === c.hex ? c.hex : "transparent",
                        boxShadow:
                          activeThemeColor === c.hex
                            ? `0 0 0 2px var(--background), 0 0 0 4px ${c.hex}`
                            : undefined,
                      }}
                      aria-pressed={activeThemeColor === c.hex}
                    />
                  ))}
                </div>
                {activeThemeColor && (
                  <p className="text-[10px] font-mono text-muted-foreground">
                    {activeThemeColor}
                  </p>
                )}
              </div>
            )}

            {/* Interactive QR Code Generator */}
            <div className="space-y-2 pt-3 border-t border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <QrCode className="size-3.5 text-primary" />
                  <Label className="text-[11px] font-medium text-foreground">
                    Interactive QR Code (Paper / GitHub)
                  </Label>
                </div>
                {qrAssetUrl && (
                  <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    Active
                  </span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground leading-snug">
                Generate a high-res vector QR code for conference attendees to scan and view your paper, GitHub repo, or supplementary materials.
              </p>

              <div className="space-y-1.5">
                <Input
                  value={qrUrl}
                  onChange={(e) => setQrUrl(e.target.value)}
                  placeholder="https://arxiv.org/abs/... or https://github.com/..."
                  className="h-7 text-xs bg-background"
                />
                <div className="flex items-center gap-1.5">
                  <Input
                    value={qrLabel}
                    onChange={(e) => setQrLabel(e.target.value)}
                    placeholder="Label (e.g. Scan for Paper & Code)"
                    className="h-7 text-xs bg-background flex-1"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleGenerateQr}
                    disabled={!qrUrl.trim() || isGeneratingQr}
                    className="h-7 text-xs px-2.5 gap-1 shrink-0 shadow-xs"
                  >
                    {isGeneratingQr ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Sparkles className="size-3 text-amber-500" />
                    )}
                    Generate QR
                  </Button>
                </div>
              </div>

              {qrAssetUrl && (
                <div className="flex items-center justify-between gap-3 p-2 rounded-md border border-border bg-muted/20 mt-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="size-10 rounded border border-border bg-white flex items-center justify-center p-0.5 shrink-0">
                      <img src={qrAssetUrl} alt="QR Code" className="max-h-full max-w-full object-contain" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-[10px] font-semibold text-foreground truncate">
                        qrcode.png
                      </p>
                      <p className="text-[9px] text-muted-foreground truncate">
                        Saved in assets · Available for cards &amp; headers
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="flex flex-col gap-2 border-t border-border bg-muted/30 p-3 shrink-0">
        <Button
          size="sm"
          className="w-full justify-center h-8 text-xs"
          onClick={() => setHeaderUnlocked(false)}
        >
          <Check className="size-3.5 mr-1.5" /> Done & Lock Header
        </Button>
      </div>
    </section>
  )
}
