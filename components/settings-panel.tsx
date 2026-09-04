"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { useShallow } from "zustand/react/shallow"
import {
  Palette,
  Languages,
  Bot,
  Monitor,
  Settings2,
  Keyboard,
  Database,
  RotateCcw,
  Sparkles,
  FileDown,
  Loader2,
  Shield,
} from "lucide-react"
import { toast } from "sonner"
import { AgentIntegrationPanel } from "@/components/settings/agent-integration-panel"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { THEMES } from "@/components/theme-picker"
import { useEditor } from "@/components/editor-store"
import { useSettings, SETTINGS_STORAGE_KEY } from "@/lib/settings-store"
import { apiFetch } from "@/lib/api-fetch"
import { DEMO_PROJECT_ID } from "@/lib/mock-data"
import { DEFAULT_AI_MODELS, type AiModelRole } from "@/lib/ai/models"
import type { ReviewLanguage } from "@/lib/ai/thesis-rubric"
import { cn } from "@/lib/utils"
import pkg from "../package.json"

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

const SHORTCUTS: { keys: string[]; action: string; hint?: string }[] = [
  { keys: ["⌘", "K"], action: "Open command palette" },
  { keys: ["⌘", "S"], action: "Save workspace" },
  {
    keys: ["⌘", "⏎"],
    action: "Compile preview",
    hint: "Can be disabled in the Editor tab",
  },
  { keys: ["Esc"], action: "Close dialogs & drawers" },
  { keys: ["Tab"], action: "Move focus between controls" },
  { keys: ["←", "→", "↑", "↓"], action: "Navigate menus, tabs & lists" },
]

type SettingsTab =
  | "theme"
  | "appearance"
  | "editor"
  | "language"
  | "ai"
  | "shortcuts"
  | "data"
  | "deerflow"

export function SettingsPanel() {
  const [tab, setTab] = useState<SettingsTab>("theme")
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  const {
    project,
    autoCompile,
    setAutoCompile,
    compactMode,
    setCompactMode,
    layoutCheckEnabled,
    setLayoutCheckEnabled,
    compileAutoFixEnabled,
    setCompileAutoFixEnabled,
    compileOnCmdEnter,
    setCompileOnCmdEnter,
    agentPanelOpenOnLoad,
    setAgentPanelOpenOnLoad,
    structurePanelOpenOnLoad,
    setStructurePanelOpenOnLoad,
    inspectorDefaultTab,
    setInspectorDefaultTab,
  } = useEditor(
    useShallow((s) => ({
      project: s.project,
      autoCompile: s.autoCompile,
      setAutoCompile: s.setAutoCompile,
      compactMode: s.compactMode,
      setCompactMode: s.setCompactMode,
      layoutCheckEnabled: s.layoutCheckEnabled,
      setLayoutCheckEnabled: s.setLayoutCheckEnabled,
      compileAutoFixEnabled: s.compileAutoFixEnabled,
      setCompileAutoFixEnabled: s.setCompileAutoFixEnabled,
      compileOnCmdEnter: s.compileOnCmdEnter,
      setCompileOnCmdEnter: s.setCompileOnCmdEnter,
      agentPanelOpenOnLoad: s.agentPanelOpenOnLoad,
      setAgentPanelOpenOnLoad: s.setAgentPanelOpenOnLoad,
      structurePanelOpenOnLoad: s.structurePanelOpenOnLoad,
      setStructurePanelOpenOnLoad: s.setStructurePanelOpenOnLoad,
      inspectorDefaultTab: s.inspectorDefaultTab,
      setInspectorDefaultTab: s.setInspectorDefaultTab,
    }))
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
    { id: "appearance" as const, icon: Monitor, label: "Appearance" },
    { id: "editor" as const, icon: Settings2, label: "Editor" },
    { id: "language" as const, icon: Languages, label: "Language" },
    { id: "ai" as const, icon: Bot, label: "AI Models" },
    { id: "shortcuts" as const, icon: Keyboard, label: "Shortcuts" },
    { id: "data" as const, icon: Database, label: "Data" },
    { id: "deerflow" as const, icon: Shield, label: "DeerFlow Agent" },
  ]

  return (
    <div className="flex h-full min-h-[400px]">
      {/* Vertical tab sidebar */}
      <div
        role="tablist"
        aria-label="Settings sections"
        className="flex w-48 shrink-0 flex-col gap-1 border-r border-border bg-muted/20 p-2"
      >
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
        {tab === "appearance" && (
          <div className="space-y-6">
            <div>
              <SectionHeader
                icon={Monitor}
                title="Density"
                description="How much room the interface gives you."
              />
              <Segmented
                label="Interface density"
                value={compactMode ? "compact" : "comfortable"}
                onChange={(v) => setCompactMode(v === "compact")}
                options={[
                  { value: "comfortable", label: "Comfortable" },
                  { value: "compact", label: "Compact" },
                ]}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Compact tightens the top bar, card list and inspector chrome so
                more of the poster stays visible.
              </p>
            </div>
            <Separator />
            <div>
              <SectionHeader
                icon={Monitor}
                title="Inspector default tab"
                description="Which panel opens when you first select a card."
              />
              <Segmented
                label="Inspector default tab"
                value={inspectorDefaultTab}
                onChange={setInspectorDefaultTab}
                options={[
                  { value: "editor", label: "Card Editor" },
                  { value: "pdf", label: "PDF Preview" },
                ]}
              />
            </div>
          </div>
        )}
        {tab === "editor" && (
          <div className="space-y-4">
            <SectionHeader
              icon={Settings2}
              title="Editor Behavior"
              description="Compile, layout checks and startup panels."
            />
            <div className="space-y-3">
              <SettingRow
                title="Auto-compile"
                description="Automatically compile the PDF after changes settle."
                checked={autoCompile}
                onChange={setAutoCompile}
              />
              <SettingRow
                title="Layout check after compile"
                description="Run the background VLM layout inspection after each successful compile to catch overflows."
                checked={layoutCheckEnabled}
                onChange={setLayoutCheckEnabled}
              />
              <SettingRow
                title="Auto-fix compile errors"
                description="Let the LLM patch broken LaTeX and retry (up to 3 attempts) before handing the log to the agent."
                checked={compileAutoFixEnabled}
                onChange={setCompileAutoFixEnabled}
              />
              <SettingRow
                title="Compile with ⌘⏎"
                description="Bind the ⌘⏎ / Ctrl+Enter shortcut to compiling the preview."
                checked={compileOnCmdEnter}
                onChange={setCompileOnCmdEnter}
              />
              <SettingRow
                title="Open Agent panel on load"
                description="Start each session with the Agent panel expanded (desktop)."
                checked={agentPanelOpenOnLoad}
                onChange={setAgentPanelOpenOnLoad}
              />
              <SettingRow
                title="Open Structure panel on load"
                description="Start each session with the structure sidebar expanded (desktop)."
                checked={structurePanelOpenOnLoad}
                onChange={setStructurePanelOpenOnLoad}
              />
            </div>
          </div>
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
        {tab === "shortcuts" && (
          <div>
            <SectionHeader
              icon={Keyboard}
              title="Keyboard Shortcuts"
              description="Every core action is reachable without a mouse."
            />
            <div className="overflow-hidden rounded-lg border border-border">
              {SHORTCUTS.map((s, i) => (
                <div
                  key={s.action}
                  className={cn(
                    "flex items-center justify-between gap-4 bg-card px-3 py-2.5",
                    i > 0 && "border-t border-border"
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{s.action}</p>
                    {s.hint && (
                      <p className="text-[11px] text-muted-foreground">{s.hint}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1" aria-hidden="true">
                    {s.keys.map((k, j) => (
                      <kbd
                        key={j}
                        className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === "data" && (
          <DataSettings
            workspaceId={project.id}
            workspaceName={project.name}
          />
        )}
        {tab === "deerflow" && <AgentIntegrationPanel />}
      </div>
    </div>
  )
}

/* ---------------------------------- shared ---------------------------------- */

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType
  title: string
  description: string
}) {
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

function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  label: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid w-fit grid-cols-2 gap-1 rounded-lg bg-muted p-1"
    >
      {options.map((o) => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-8 rounded-md px-3 text-xs font-medium transition-all duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function SettingRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-card p-3">
      <div className="min-w-0">
        <Label className="text-sm font-medium">{title}</Label>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        aria-label={title}
        className="shrink-0"
      />
    </div>
  )
}

/* ---------------------------------- theme ---------------------------------- */

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
        description="Choose a color palette for the workspace. Light family first, then dark."
      />
      <div className="grid gap-2 sm:grid-cols-2">
        {THEMES.map((t) => {
          const isActive = mounted && currentTheme === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onThemeChange(t.id)}
              aria-pressed={isActive}
              className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
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
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-medium text-foreground">
                  {t.name}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {t.desc}
                </span>
              </div>
              {isActive && (
                <Badge variant="secondary" className="shrink-0 text-[10px]">
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

/* --------------------------------- language --------------------------------- */

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
        title="Language"
        description="Used for new thesis reviews, the academic search dialog and generated review documents. The poster editor itself is currently English-only."
      />
      <Select value={currentLanguage} onValueChange={(val) => val && onLanguageChange(val as ReviewLanguage)}>
        <SelectTrigger className="w-full" aria-label="Review language">
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

/* ----------------------------------- ai ----------------------------------- */

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
      className="flex w-full items-center gap-2 rounded-md border border-transparent p-2 text-left transition-colors hover:border-border hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

/* ----------------------------------- data ----------------------------------- */

function DataSettings({
  workspaceId,
  workspaceName,
}: {
  workspaceId: string
  workspaceName: string
}) {
  const [exporting, setExporting] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)

  async function exportWorkspace() {
    setExporting(true)
    try {
      const res = await apiFetch(`/api/workspaces/${workspaceId}`)
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${workspaceName.toLowerCase().replace(/[^a-z0-9_-]/g, "_") || "workspace"}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Workspace exported", {
        description: "The full workspace (outputs, cards, assets) was downloaded as JSON.",
      })
    } catch (err) {
      toast.error("Export failed", {
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setExporting(false)
    }
  }

  function resetAllSettings() {
    window.localStorage.removeItem(SETTINGS_STORAGE_KEY)
    window.localStorage.removeItem("posterapp-editor-storage")
    window.location.reload()
  }

  return (
    <div className="space-y-6">
      <div>
        <SectionHeader
          icon={FileDown}
          title="Export"
          description="Take your work with you."
        />
        <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-card p-3">
          <div className="min-w-0">
            <Label className="text-sm font-medium">Workspace as JSON</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Download {workspaceName || "the current workspace"} with all
              outputs, cards and assets.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={exporting || workspaceId === DEMO_PROJECT_ID}
            onClick={() => void exportWorkspace()}
            className="shrink-0 gap-1.5"
          >
            {exporting ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <FileDown className="size-3.5" aria-hidden="true" />
            )}
            {exporting ? "Exporting…" : "Export JSON"}
          </Button>
        </div>
      </div>

      <Separator />

      <div>
        <SectionHeader
          icon={RotateCcw}
          title="Reset"
          description="Restore every local preference to its default."
        />
        <div className="flex items-center justify-between gap-4 rounded-md border border-destructive/30 bg-card p-3">
          <div className="min-w-0">
            <Label className="text-sm font-medium text-destructive">
              Reset all settings
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Clears display preferences, compile behavior, language and AI
              model overrides. Workspace content is not affected. Reloads the
              app.
            </p>
          </div>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setResetOpen(true)}
            className="shrink-0 gap-1.5"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Reset
          </Button>
        </div>
        <ConfirmDialog
          open={resetOpen}
          onOpenChange={setResetOpen}
          title="Reset all settings?"
          description="Every local preference (theme is kept, it is stored separately) will return to its default. This cannot be undone."
          confirmLabel="Reset settings"
          onConfirm={resetAllSettings}
        />
      </div>

      <Separator />

      <div>
        <SectionHeader
          icon={Database}
          title="About"
          description="Build information."
        />
        <div className="rounded-md border border-border bg-card p-3">
          <p className="text-sm font-medium text-foreground">
            Poster Block Studio
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            v{pkg.version} · tikzposter editor for structured academic posters
          </p>
        </div>
      </div>
    </div>
  )
}
