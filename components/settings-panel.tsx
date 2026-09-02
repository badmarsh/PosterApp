"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { useShallow } from "zustand/react/shallow"
import {
  Palette,
  Languages,
  Bot,
  Monitor,
  RotateCcw,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { THEMES, type ThemeEntry } from "@/components/theme-picker"
import { useEditor } from "@/components/editor-store"
import { useSettings } from "@/lib/settings-store"
import { DEFAULT_AI_MODELS, type AiModelRole } from "@/lib/ai/models"
import type { ReviewLanguage } from "@/lib/ai/thesis-rubric"

const LANGUAGES: { value: ReviewLanguage; label: string; flag: string }[] = [
  { value: "sk", label: "Slovenčina", flag: "🇸🇰" },
  { value: "cs", label: "Čeština", flag: "🇨🇿" },
  { value: "en", label: "English", flag: "🇬🇧" },
]

const AI_ROLE_LABELS: Record<AiModelRole, string> = {
  default: "Default",
  generation: "Card Auto-fill",
  structure: "Structure Generation",
  convert: "Format Conversion",
  shrink: "Content Condensing",
  review: "Poster Review",
  reviewLayout: "Layout Review (VLM)",
  vision: "Image Understanding",
  ocr: "OCR",
  chat: "Chat Assistant",
  bibtex: "BibTeX Extraction",
  labeler: "Snapshot Labeler",
  autofix: "Compile Autofix",
  thesis: "Thesis Review",
}

type SettingsTab = "theme" | "language" | "ai" | "display"

export function SettingsPanel() {
  const [tab, setTab] = useState<SettingsTab>("theme")
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  const { autoCompile, setAutoCompile } = useEditor(
    useShallow((s) => ({ autoCompile: s.autoCompile, setAutoCompile: s.setAutoCompile }))
  )
  const { compactMode, setCompactMode } = useEditor(
    useShallow((s) => ({ compactMode: s.compactMode, setCompactMode: s.setCompactMode }))
  )

  const {
    defaultReviewLanguage,
    setDefaultReviewLanguage,
    aiModelOverrides,
    setAiModelOverride,
    clearAiModelOverride,
    clearAllAiModelOverrides,
  } = useSettings(
    useShallow((s) => ({
      defaultReviewLanguage: s.defaultReviewLanguage,
      setDefaultReviewLanguage: s.setDefaultReviewLanguage,
      aiModelOverrides: s.aiModelOverrides,
      setAiModelOverride: s.setAiModelOverride,
      clearAiModelOverride: s.clearAiModelOverride,
      clearAllAiModelOverrides: s.clearAllAiModelOverrides,
    }))
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  const tabs = [
    { id: "theme" as const, icon: Palette, label: "Theme" },
    { id: "language" as const, icon: Languages, label: "Language" },
    { id: "ai" as const, icon: Bot, label: "AI Models" },
    { id: "display" as const, icon: Monitor, label: "Display" },
  ]

  return (
    <div className="flex h-full min-h-[400px]">
      {/* Vertical tab sidebar */}
      <div className="flex w-48 shrink-0 flex-col gap-1 border-r border-border bg-muted/20 p-2">
        {tabs.map((t) => {
          const Icon = t.icon
          const isActive = tab === t.id
          return (
            <Button
              key={t.id}
              variant={isActive ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setTab(t.id)}
              className={`h-10 w-full gap-2.5 justify-start text-sm ${!isActive ? "text-muted-foreground" : ""}`}
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{t.label}</span>
            </Button>
          )
        })}
      </div>

      {/* Content area */}
      <div className="min-w-0 flex-1 overflow-y-auto p-6">
        {tab === "theme" && (
          <ThemeSettings
            mounted={mounted}
            currentTheme={theme}
            onThemeChange={(val) => val && setTheme(val)}
          />
        )}
        {tab === "language" && (
          <LanguageSettings
            currentLanguage={defaultReviewLanguage}
            onLanguageChange={setDefaultReviewLanguage}
          />
        )}
        {tab === "ai" && (
          <AiModelSettings
            overrides={aiModelOverrides}
            onOverride={setAiModelOverride}
            onClear={clearAiModelOverride}
            onClearAll={clearAllAiModelOverrides}
          />
        )}
        {tab === "display" && (
          <DisplaySettings
            autoCompile={autoCompile}
            onAutoCompileChange={setAutoCompile}
            compactMode={compactMode}
            onCompactModeChange={setCompactMode}
          />
        )}
      </div>
    </div>
  )
}

function SectionHeader({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-4" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function ThemeSettings({
  mounted,
  currentTheme,
  onThemeChange,
}: {
  mounted: boolean
  currentTheme?: string
  onThemeChange: (val: string) => void
}) {
  return (
    <div>
      <SectionHeader
        icon={Palette}
        title="Appearance"
        description="Choose a color palette for the workspace."
      />
      <div className="grid gap-2">
        {THEMES.map((t) => {
          const isActive = mounted && currentTheme === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onThemeChange(t.id)}
              className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                isActive
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border hover:border-foreground/20 hover:bg-muted/50"
              }`}
            >
              <span
                className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md shadow-xs ring-1 ring-inset ring-border"
                aria-hidden="true"
              >
                {t.palette.map((color, i) => (
                  <span
                    key={i}
                    className="block size-full"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </span>
              <div className="flex flex-1 flex-col">
                <span className="text-sm font-medium text-foreground">
                  {t.name}
                </span>
                <span className="text-xs text-muted-foreground">{t.desc}</span>
              </div>
              {isActive && (
                <Badge variant="secondary" className="text-[10px]">
                  Active
                </Badge>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function LanguageSettings({
  currentLanguage,
  onLanguageChange,
}: {
  currentLanguage: ReviewLanguage
  onLanguageChange: (lang: ReviewLanguage) => void
}) {
  return (
    <div>
      <SectionHeader
        icon={Languages}
        title="Default Review Language"
        description="Language used for new thesis reviews."
      />
      <Select value={currentLanguage} onValueChange={(val) => val && onLanguageChange(val as ReviewLanguage)}>
        <SelectTrigger className="w-full">
          <SelectValue>
            {LANGUAGES.find((l) => l.value === currentLanguage)?.flag}{" "}
            {LANGUAGES.find((l) => l.value === currentLanguage)?.label ?? "Slovenčina"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {LANGUAGES.map((l) => (
            <SelectItem key={l.value} value={l.value}>
              {l.flag} {l.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function AiModelSettings({
  overrides,
  onOverride,
  onClear,
  onClearAll,
}: {
  overrides: Partial<Record<AiModelRole, string>>
  onOverride: (role: AiModelRole, model: string) => void
  onClear: (role: AiModelRole) => void
  onClearAll: () => void
}) {
  const roles = Object.keys(DEFAULT_AI_MODELS) as AiModelRole[]
  const hasOverrides = Object.keys(overrides).length > 0

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <SectionHeader
          icon={Bot}
          title="AI Model Overrides"
          description="Override default models for specific tasks."
        />
        {hasOverrides && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-destructive"
          >
            <RotateCcw className="size-3" />
            Reset All
          </Button>
        )}
      </div>
      <div className="space-y-3">
        {roles.map((role) => (
          <AiModelRow
            key={role}
            role={role}
            defaultModel={DEFAULT_AI_MODELS[role]}
            currentOverride={overrides[role]}
            onOverride={(model) => onOverride(role, model)}
            onClear={() => onClear(role)}
          />
        ))}
      </div>
    </div>
  )
}

function AiModelRow({
  role,
  defaultModel,
  currentOverride,
  onOverride,
  onClear,
}: {
  role: AiModelRole
  defaultModel: string
  currentOverride?: string
  onOverride: (model: string) => void
  onClear: () => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const effectiveModel = currentOverride || defaultModel
  const isOverridden = Boolean(currentOverride)

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-card p-2">
        <Label className="w-28 shrink-0 text-xs">{AI_ROLE_LABELS[role]}</Label>
        <input
          type="text"
          defaultValue={effectiveModel}
          placeholder={defaultModel}
          className="h-7 flex-1 rounded border border-border bg-background px-2 text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const val = (e.target as HTMLInputElement).value.trim()
              if (val) onOverride(val)
              setIsEditing(false)
            } else if (e.key === "Escape") {
              setIsEditing(false)
            }
          }}
          onBlur={(e) => {
            const val = e.target.value.trim()
            if (val) onOverride(val)
            setIsEditing(false)
          }}
          autoFocus
        />
        {isOverridden && (
          <Button variant="ghost" size="sm" onClick={onClear} className="h-7 px-2 text-xs">
            <RotateCcw className="size-3" />
          </Button>
        )}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className="flex w-full items-center gap-2 rounded-md border border-transparent p-2 text-left transition-colors hover:border-border hover:bg-muted/50"
    >
      <Label className="w-28 shrink-0 text-xs font-medium text-foreground">
        {AI_ROLE_LABELS[role]}
      </Label>
      <span className={`flex-1 truncate text-xs ${isOverridden ? "text-primary" : "text-muted-foreground"}`}>
        {effectiveModel}
      </span>
      {isOverridden && (
        <Badge variant="secondary" className="h-4 gap-1 px-1.5 text-[9px]">
          <Sparkles className="size-2.5" />
          Custom
        </Badge>
      )}
    </button>
  )
}

function DisplaySettings({
  autoCompile,
  onAutoCompileChange,
  compactMode,
  onCompactModeChange,
}: {
  autoCompile: boolean
  onAutoCompileChange: (v: boolean) => void
  compactMode: boolean
  onCompactModeChange: (v: boolean) => void
}) {
  return (
    <div className="space-y-4">
      <SectionHeader
        icon={Monitor}
        title="Display Preferences"
        description="Tune the editor interface."
      />
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-md border border-border bg-card p-3">
          <div>
            <Label className="text-sm font-medium">Auto-compile</Label>
            <p className="text-xs text-muted-foreground">
              Automatically compile PDF after changes
            </p>
          </div>
          <Switch checked={autoCompile} onCheckedChange={onAutoCompileChange} />
        </div>
        <div className="flex items-center justify-between rounded-md border border-border bg-card p-3">
          <div>
            <Label className="text-sm font-medium">Compact mode</Label>
            <p className="text-xs text-muted-foreground">
              Reduce spacing for more content area
            </p>
          </div>
          <Switch checked={compactMode} onCheckedChange={onCompactModeChange} />
        </div>
      </div>
    </div>
  )
}
