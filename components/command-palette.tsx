"use client"

import { useMemo, useState } from "react"
import { useTheme } from "next-themes"
import {
  CodeIcon,
  Download,
  FileStack,
  FolderOpen,
  Folders,
  LayoutTemplate,
  Moon,
  PanelLeft,
  Play,
  Plus,
  Save,
  Sparkles,
  Sun,
  Clock,
  Copy,
} from "lucide-react"
import { useShallow } from "zustand/react/shallow"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { useEditor } from "@/components/editor-store"
import { generateFullTemplate } from "@/lib/latex"

type CommandPaletteProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onToggleStructure: () => void
  onOpenWorkspaceSelector: () => void
}

export function CommandPalette({
  open,
  onOpenChange,
  onToggleStructure,
  onOpenWorkspaceSelector,
}: CommandPaletteProps) {
  const { setTheme, resolvedTheme } = useTheme()
  const [search, setSearch] = useState("")
  // Reset the search text whenever the palette transitions to open, without an effect —
  // adjust state during render per https://react.dev/learn/you-might-not-need-an-effect.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setSearch("")
  }

  const {
    project,
    pushEvent,
    selectCard,
    switchOutput,
    openIngestion,
    aiReview,
    autoFillAllCardsAction,
    saveProject,
    duplicateProject,
    newProject,
    compileProject,
    toggleLatexSource,
    setIsHistoryOpen,
    setIsAcademicSearchOpen,
    isDirty,
  } = useEditor(
    useShallow((s) => ({
      project: s.project,
      pushEvent: s.pushEvent,
      selectCard: s.selectCard,
      switchOutput: s.switchOutput,
      openIngestion: s.openIngestion,
      aiReview: s.aiReview,
      autoFillAllCardsAction: s.autoFillAllCardsAction,
      saveProject: s.saveProject,
      duplicateProject: s.duplicateProject,
      newProject: s.newProject,
      compileProject: s.compileProject,
      toggleLatexSource: s.toggleLatexSource,
      setIsHistoryOpen: s.setIsHistoryOpen,
      setIsAcademicSearchOpen: s.setIsAcademicSearchOpen,
      isDirty: s.isDirty,
    }))
  )

  const activeOutput = useMemo(
    () => project.outputs?.find((o) => o.id === project.activeOutputId) ?? project.outputs?.[0],
    [project.outputs, project.activeOutputId]
  )
  const cards = activeOutput?.cards ?? []

  function run(action: () => void) {
    onOpenChange(false)
    // Defer slightly so the dialog closes before triggering potentially heavy work.
    setTimeout(action, 0)
  }

  function exportTex() {
    if (!activeOutput) {
      pushEvent({ kind: "info", status: "error", title: "Export Failed", detail: "No active output found." })
      return
    }
    const tex = generateFullTemplate(project, activeOutput, project.id)
    const blob = new Blob([tex], { type: "text/x-tex" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${project.id}_${activeOutput.outputType}.tex`
    a.click()
    URL.revokeObjectURL(url)
    pushEvent({ kind: "info", status: "done", title: `Exported ${activeOutput.outputType}.tex`, detail: "LaTeX source file downloaded." })
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command Palette"
      description="Search for actions, cards, or outputs"
    >
      <CommandInput placeholder="Type a command or search…" value={search} onValueChange={setSearch} />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Project">
          <CommandItem onSelect={() => run(() => saveProject())} disabled={!isDirty}>
            <Save />
            Save project
            <CommandShortcut>⌘S</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(exportTex)}>
            <Download />
            Export LaTeX (.tex)
          </CommandItem>
          <CommandItem onSelect={() => run(() => compileProject())}>
            <Play />
            Compile PDF
          </CommandItem>
          <CommandItem onSelect={() => run(() => aiReview())}>
            <Sparkles />
            Run AI review
          </CommandItem>
          <CommandItem onSelect={() => run(() => autoFillAllCardsAction())}>
            <Sparkles />
            Auto-fill all cards
          </CommandItem>
          <CommandItem onSelect={() => run(duplicateProject)}>
            <Copy />
            Duplicate workspace
          </CommandItem>
          <CommandItem onSelect={() => run(newProject)}>
            <Plus />
            New workspace
          </CommandItem>
          <CommandItem onSelect={() => run(onOpenWorkspaceSelector)}>
            <Folders />
            View all workspaces…
          </CommandItem>
          <CommandItem onSelect={() => run(openIngestion)}>
            <FileStack />
            Ingest source PDFs
          </CommandItem>
          <CommandItem onSelect={() => run(() => setIsAcademicSearchOpen(true))}>
            <Sparkles />
            Search Academic Literature (Perplexity)
          </CommandItem>
        </CommandGroup>

        {project.outputs && project.outputs.length > 0 && (
          <CommandGroup heading="Outputs">
            {project.outputs.map((o) => (
              <CommandItem
                key={o.id}
                value={`output ${o.title} ${o.outputType}`}
                onSelect={() => run(() => switchOutput(o.id))}
              >
                <FolderOpen />
                {o.title}
                <CommandShortcut className="capitalize">{o.outputType}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {cards.length > 0 && (
          <CommandGroup heading="Jump to card">
            {cards.map((c) => (
              <CommandItem
                key={c.id}
                value={`card ${c.title}`}
                onSelect={() => run(() => selectCard(c.id))}
              >
                <LayoutTemplate />
                {c.title || "Untitled card"}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading="View">
          <CommandItem onSelect={() => run(onToggleStructure)}>
            <PanelLeft />
            Toggle structure panel
          </CommandItem>
          <CommandItem onSelect={() => run(toggleLatexSource)}>
            <CodeIcon />
            Toggle LaTeX source view
          </CommandItem>
          <CommandItem onSelect={() => run(() => setIsHistoryOpen(true))}>
            <Clock />
            Open save history
          </CommandItem>
          <CommandItem
            onSelect={() => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}
          >
            {resolvedTheme === "dark" ? <Sun /> : <Moon />}
            Toggle theme
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
