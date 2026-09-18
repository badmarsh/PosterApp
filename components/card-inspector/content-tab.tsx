"use client"

import { useRef, useState } from "react"
import { Bold, Code as CodeIcon, Italic, Link as LinkIcon, Loader2, RotateCcw, Sparkles } from "lucide-react"
import { useEditor } from "@/components/editor-store"
import { useShallow } from "zustand/react/shallow"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { EvidenceChip } from "@/components/grounding/evidence-chip"
import { SuggestedAssetsTray } from "@/components/grounding/suggested-assets-tray"
import { LayoutTruthBanner } from "@/components/grounding/layout-truth-banner"
import { FieldLabel, HeightMeter, RagSourcesIllustration } from "./shared"
import type { Card } from "@/lib/poster-types"
import { OUTPUT_TYPE_LABELS, type OutputType } from "@/lib/output-types"

export function ContentTab({ card }: { card: Card }) {
  const { updateCard, project, bibKeys, bibEntries, autoFillCardAction, autoShrinkCardAction, attachSuggestedAsset, generatingIds } = useEditor(
    useShallow((s) => ({
      updateCard: s.updateCard,
      project: s.project,
      bibKeys: s.bibKeys,
      bibEntries: s.bibEntries,
      autoFillCardAction: s.autoFillCardAction,
      autoShrinkCardAction: s.autoShrinkCardAction,
      attachSuggestedAsset: s.attachSuggestedAsset,
      generatingIds: s.generatingIds,
    }))
  )
  const ingestFiles = project.ingestFiles || []
  const disabled = card.pattern === "image-focused" || card.pattern === "figure-slide" || card.pattern === "references"
  const isReferences = card.pattern === "references"
  const isGenerating = generatingIds.includes(card.id)
  const contentRef = useRef<HTMLTextAreaElement>(null)
  const [citationMenu, setCitationMenu] = useState<{ query: string; start: number; end: number } | null>(null)
  const [isShrinking, setIsShrinking] = useState(false)

  const filteredCitationEntries = bibEntries
    .filter((entry) => !citationMenu || entry.key.toLowerCase().includes(citationMenu.query.toLowerCase()) || entry.title.toLowerCase().includes(citationMenu.query.toLowerCase()))
    .slice(0, 7)

  function updateContent(value: string, cursor: number) {
    updateCard(card.id, { content: value })
    const beforeCursor = value.slice(0, cursor)
    const match = /(?:\\cite\{([^{}]*)$|\[([^\]]*)$)/.exec(beforeCursor)
    if (match) {
      const query = match[1] ?? match[2] ?? ""
      setCitationMenu({ query, start: cursor - match[0].length, end: cursor })
    } else {
      setCitationMenu(null)
    }
  }

  function insertAutocompleteCitation(key: string) {
    const el = contentRef.current
    if (!el || !citationMenu) return
    const replacement = `\\cite{${key}}`
    const next = card.content.slice(0, citationMenu.start) + replacement + card.content.slice(citationMenu.end)
    updateCard(card.id, { content: next })
    setCitationMenu(null)
    window.setTimeout(() => {
      el.focus()
      const position = citationMenu.start + replacement.length
      el.setSelectionRange(position, position)
    }, 0)
  }

  function insertMarkdown(prefix: string, suffix: string) {
    const el = contentRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const text = card.content
    const selected = text.slice(start, end)
    const before = text.slice(0, start)
    const after = text.slice(end)
    const replacement = selected || "text"
    const next = `${before}${prefix}${replacement}${suffix}${after}`
    updateCard(card.id, { content: next })
    
    window.setTimeout(() => {
      el.focus()
      el.setSelectionRange(
        start + prefix.length,
        start + prefix.length + replacement.length,
      )
    }, 0)
  }

  function insertCiteKey(key: string) {
    const el = contentRef.current
    if (!el || !key) return
    const cite = `\\cite{${key}}`
    const start = el.selectionStart
    const end = el.selectionEnd
    const text = card.content
    const next = text.slice(0, start) + cite + text.slice(end)
    updateCard(card.id, { content: next })
    window.setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + cite.length, start + cite.length)
    }, 0)
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <LayoutTruthBanner
        layout={card.grounding?.layout}
        onAutoShrink={() => {
          setIsShrinking(true)
          void autoShrinkCardAction(card.id).finally(() => setIsShrinking(false))
        }}
        isShrinking={isShrinking}
      />
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <FieldLabel hint="markdown supported">Card Content</FieldLabel>
          <Button
            size="sm"
            variant="outline"
            className="h-6 gap-1 bg-primary/10 text-[10px] text-primary hover:bg-primary/15 border-primary/30"
            onClick={() => autoFillCardAction(card.id)}
            disabled={isGenerating || disabled}
          >
            {isGenerating ? <Loader2 className="size-3 animate-spin" /> : "✨"}
            Auto-Fill
          </Button>
        </div>
        {disabled ? (
          <p className="rounded-md border border-dashed border-border bg-muted/40 px-2.5 py-3 text-center text-[11px] text-muted-foreground">
            {isReferences
              ? "The references pattern automatically generates the bibliography. No text content is needed."
              : "The image-focused pattern has no text content. Switch pattern in Basics to enable."}
          </p>
        ) : (
          <div className="relative flex flex-col rounded-md border border-input focus-within:ring-1 focus-within:ring-ring">
            <div className="flex items-center gap-1 border-b border-border bg-muted/40 p-1">
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Insert bold formatting"
                onClick={() => insertMarkdown("**", "**")}
                title="Bold"
              >
                <Bold className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Insert italic formatting"
                onClick={() => insertMarkdown("*", "*")}
                title="Italic"
              >
                <Italic className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Insert inline code"
                onClick={() => insertMarkdown("`", "`")}
                title="Inline Code"
              >
                <CodeIcon className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Insert link"
                onClick={() => insertMarkdown("[", "](url)")}
                title="Link"
              >
                <LinkIcon className="size-3.5" />
              </Button>
            </div>
            <Textarea
              ref={contentRef}
              aria-label="Card content"
              value={card.content}
              onChange={(e) => updateContent(e.target.value, e.target.selectionStart)}
              onSelect={(e) => {
                const target = e.currentTarget
                const before = target.value.slice(0, target.selectionStart)
                const match = /(?:\\cite\{([^{}]*)$|\[([^\]]*)$)/.exec(before)
                setCitationMenu(match ? { query: match[1] ?? match[2] ?? "", start: target.selectionStart - match[0].length, end: target.selectionStart } : null)
              }}
              onKeyDown={(e) => { if (e.key === "Escape") setCitationMenu(null) }}
              placeholder="Use - or * for bulleted lists... Type \\cite{ or [ for citations"
              className="min-h-[16rem] resize-y border-0 text-[13px] shadow-none focus-visible:ring-0"
            />
            {citationMenu && filteredCitationEntries.length > 0 && (
              <div className="absolute left-2 right-2 top-full z-20 mt-1 overflow-hidden rounded-md border border-border bg-popover p-1 shadow-lg" role="listbox" aria-label="Bibliography autocomplete">
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Insert citation</div>
                {filteredCitationEntries.map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    role="option"
                    className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertAutocompleteCitation(entry.key)}
                  >
                    <span className="font-mono text-[10px] font-semibold text-primary">{entry.key}</span>
                    <span className="line-clamp-2 text-[10px] text-foreground">{entry.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {!disabled && card.grounding?.citations?.length ? (
        <div className="space-y-1.5 rounded-md border border-border bg-muted/20 p-2.5">
          <FieldLabel>Evidence anchors</FieldLabel>
          {card.grounding.citations.map((citation) => (
            <div key={`${citation.bulletIndex}-${citation.chunkIds.join("-")}`} className="flex items-start gap-2 text-[10px] text-muted-foreground">
              <span className="min-w-0 flex-1 line-clamp-2">{card.content.split(/\\n\\n/)[citation.bulletIndex] || `Bullet ${citation.bulletIndex + 1}`}</span>
              <EvidenceChip citation={citation} compact />
            </div>
          ))}
        </div>
      ) : null}
      {!disabled && card.grounding?.suggestedAssets?.length ? (
        <SuggestedAssetsTray
          assets={card.grounding.suggestedAssets}
          attachedIds={project.assets.filter((asset) => asset.assignedCardId === card.id).map((asset) => asset.id)}
          onAttach={(assetId) => attachSuggestedAsset(card.id, assetId)}
        />
      ) : null}
      {!disabled && bibKeys.length > 0 && (
        <div className="flex flex-col gap-1">
          <FieldLabel>Insert cite key</FieldLabel>
          <select
            aria-label="Insert citation key"
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            defaultValue=""
            onChange={(e) => {
              insertCiteKey(e.target.value)
              e.target.value = ""
            }}
          >
            <option value="" disabled>
              — pick a key to insert \cite{'{'}…{'}'} —
            </option>
            {bibKeys.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
      )}

      {!disabled && (
        <div className="flex flex-col gap-1">
          <FieldLabel>Height Budget (u)</FieldLabel>
          <Input
            aria-label="Height budget"
            type="number"
            value={card.heightBudget || ""}
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : null
              updateCard(card.id, { heightBudget: val })
            }}
            placeholder="Auto (fit remaining space)"
            className="h-8 text-xs"
          />
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Target height in layout units (Column max: 900u). Leave empty to automatically fit the remaining space in the column. The AI calculates character limits based on: Title (70u) + Images (~190u) + Text (14u per 60 chars).
          </p>
        </div>
      )}

      {!disabled && (() => {
        const activeOutput = project.outputs?.find((o) => o.id === project.activeOutputId)
        return <HeightMeter card={card} templateId={activeOutput?.templateId} />
      })()}

      {!disabled && ingestFiles.length > 0 && (() => {
        const activeOutput = project.outputs?.find((o) => o.id === project.activeOutputId)
        const outputType = (activeOutput?.outputType ?? "poster") as OutputType
        const outputTypeLabel = OUTPUT_TYPE_LABELS[outputType]
        const isCardOverridden = Array.isArray(card.sourceIds) && card.sourceIds.length > 0
        const inheritedSourceIds = activeOutput?.sourceIds || []

        return (
          <div className="rounded-lg border border-border bg-card p-3 space-y-2.5 shadow-sm">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-semibold text-foreground">
                Data Sources for Autofill
              </Label>
              {isCardOverridden ? (
                <button
                  type="button"
                  onClick={() => updateCard(card.id, { sourceIds: [] })}
                  className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                >
                  <RotateCcw className="size-2.5" /> Inherit from {outputTypeLabel}
                </button>
              ) : (
                <span className="text-[10px] font-mono text-muted-foreground">
                  (Inherited from {outputTypeLabel})
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="w-12 h-9 shrink-0">
                <RagSourcesIllustration />
              </div>
              <p className="text-[10px] text-muted-foreground leading-snug">
                Restrict the Gemini RAG context for this item. Overrides the {outputTypeLabel} setting when toggled.
              </p>
            </div>

            <div className="flex flex-col gap-1.5 pt-1.5 border-t border-border/50">
              {ingestFiles.map((file: { id: string; name: string }) => {
                const isSelected = isCardOverridden
                  ? (card.sourceIds || []).includes(file.id)
                  : inheritedSourceIds.length === 0 || inheritedSourceIds.includes(file.id)

                return (
                  <div key={file.id} className="flex items-center justify-between gap-2 py-0.5">
                    <span className="truncate text-[11px] text-foreground font-medium" title={file.name}>
                      {file.name}
                    </span>
                    <Switch
                      size="sm"
                      checked={isSelected}
                      onCheckedChange={(checked) => {
                        const currentSelection = isCardOverridden
                          ? card.sourceIds || []
                          : inheritedSourceIds.length === 0
                          ? ingestFiles.map((f: { id: string }) => f.id)
                          : inheritedSourceIds

                        const next = checked
                          ? [...currentSelection.filter((id: string) => id !== file.id), file.id]
                          : currentSelection.filter((id: string) => id !== file.id)

                        updateCard(card.id, { sourceIds: next })
                      }}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

