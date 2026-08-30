"use client"

import { useState, useMemo } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Plus,
  Search,
  Copy,
  Check,
  Trash2,
  Edit2,
  FileText,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Info,
  CornerDownLeft,
  Camera,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import katex from "katex"
import "katex/dist/katex.min.css"
import { cleanFormula, slugifyEquationKey, type EquationItem } from "@/lib/equation-types"
import { cn } from "@/lib/utils"

function EquationMathPreview({ formula, className }: { formula: string; className?: string }) {
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
      <div className={cn("overflow-x-auto rounded border border-border/80 bg-muted/40 px-3 py-2 font-mono text-[11px] text-foreground select-all", className)}>
        {formula || "% empty formula"}
      </div>
    )
  }

  return (
    <div
      className={cn("my-1 overflow-x-auto rounded border border-border/60 bg-muted/20 px-3 py-2 text-center text-foreground [&_.katex-display]:my-0 select-all", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

export function EquationRegistryDialog() {
  const {
    project,
    equations,
    isEquationLibraryOpen,
    setIsEquationLibraryOpen,
    setIsScannerOpen,
    addEquation,
    updateEquation,
    deleteEquation,
    insertEquation,
    selectedCardId,
  } = useEditor(
    useShallow((s) => ({
      project: s.project,
      equations: s.equations,
      isEquationLibraryOpen: s.isEquationLibraryOpen,
      setIsEquationLibraryOpen: s.setIsEquationLibraryOpen,
      setIsScannerOpen: s.setIsScannerOpen,
      addEquation: s.addEquation,
      updateEquation: s.updateEquation,
      deleteEquation: s.deleteEquation,
      insertEquation: s.insertEquation,
      selectedCardId: s.selectedCardId,
    }))
  )

  const [searchQuery, setSearchQuery] = useState("")
  const [editingEquation, setEditingEquation] = useState<EquationItem | null>(null)
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Form states for Add / Edit
  const [formKey, setFormKey] = useState("")
  const [formName, setFormName] = useState("")
  const [formFormula, setFormFormula] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formContext, setFormContext] = useState("")

  const activeOutput = project.outputs?.find((o) => o.id === project.activeOutputId)
  const activeCards = activeOutput?.cards ?? []
  const selectedCard = activeCards.find((c) => c.id === selectedCardId)

  // Filtered equations
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return equations
    const q = searchQuery.toLowerCase()
    return equations.filter(
      (e) =>
        e.key.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q) ||
        e.formula.toLowerCase().includes(q) ||
        (e.description && e.description.toLowerCase().includes(q))
    )
  }, [equations, searchQuery])

  const startAddNew = () => {
    setEditingEquation(null)
    setFormKey(`eq:custom_${equations.length + 1}`)
    setFormName("")
    setFormFormula("")
    setFormDescription("")
    setFormContext("")
    setIsAddingNew(true)
  }

  const startEdit = (eq: EquationItem) => {
    setIsAddingNew(false)
    setEditingEquation(eq)
    setFormKey(eq.key)
    setFormName(eq.name)
    setFormFormula(eq.formula)
    setFormDescription(eq.description || "")
    setFormContext(eq.contextSnippet || "")
  }

  const cancelForm = () => {
    setIsAddingNew(false)
    setEditingEquation(null)
  }

  const handleSave = async () => {
    if (!formFormula.trim()) return
    const key = formKey.trim() || slugifyEquationKey(formName, equations.length + 1)
    const name = formName.trim() || `Equation: ${cleanFormula(formFormula).slice(0, 30)}`

    if (isAddingNew) {
      await addEquation({
        key,
        name,
        formula: cleanFormula(formFormula),
        description: formDescription.trim() || undefined,
        contextSnippet: formContext.trim() || undefined,
      })
      setIsAddingNew(false)
    } else if (editingEquation) {
      await updateEquation(editingEquation.id, {
        key,
        name,
        formula: cleanFormula(formFormula),
        description: formDescription.trim() || undefined,
        contextSnippet: formContext.trim() || undefined,
      })
      setEditingEquation(null)
    }
  }

  const handleCopy = (formula: string, id: string) => {
    navigator.clipboard.writeText(formula)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1800)
  }

  // Live KaTeX validation for form
  const formulaValidation = useMemo(() => {
    if (!formFormula.trim()) return { valid: true }
    try {
      katex.renderToString(cleanFormula(formFormula), { throwOnError: true })
      return { valid: true }
    } catch (err: any) {
      const msg = err instanceof Error ? err.message.replace(/^KaTeX parse error:\s*/i, "") : String(err)
      return { valid: false, error: msg }
    }
  }, [formFormula])

  return (
    <Dialog open={isEquationLibraryOpen} onOpenChange={setIsEquationLibraryOpen}>
      <DialogContent showCloseButton className="w-[95vw] sm:max-w-4xl md:max-w-5xl h-[85vh] p-0 overflow-hidden flex flex-col shadow-2xl border border-border bg-background">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-b border-border bg-card shrink-0 pr-12">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <DialogTitle className="text-base font-semibold tracking-tight text-foreground">
                Equation Library &amp; Registry
              </DialogTitle>
              <span className="inline-flex items-center whitespace-nowrap rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-mono font-medium text-primary border border-primary/20">
                {equations.length} {equations.length === 1 ? "equation" : "equations"}
              </span>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Manage mathematical formulations extracted from sources or user pre-configured formulas.
            </DialogDescription>
          </div>

          {!isAddingNew && !editingEquation && (
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsEquationLibraryOpen(false)
                  setIsScannerOpen(true)
                }}
                className="h-8 text-xs gap-1.5"
              >
                <Camera className="size-3.5 text-primary" />
                Scan from Photo
              </Button>
              <Button size="sm" onClick={startAddNew} className="h-8 text-xs gap-1.5 shadow-xs">
                <Plus className="size-3.5" />
                Add Equation
              </Button>
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex flex-1 min-h-0">
          {/* Add / Edit Form Pane */}
          {isAddingNew || editingEquation ? (
            <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-card">
              <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
                <h3 className="text-sm font-bold">
                  {isAddingNew ? "Add New Equation" : `Edit Equation: ${editingEquation?.key}`}
                </h3>
                <Button variant="ghost" size="sm" onClick={cancelForm} className="h-7 text-[11px]">
                  Cancel
                </Button>
              </div>

              <div className="flex flex-col gap-4 max-w-2xl">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="eq-key" className="text-[11px] font-medium text-muted-foreground uppercase">
                      Equation Key
                    </Label>
                    <Input
                      id="eq-key"
                      value={formKey}
                      onChange={(e) => setFormKey(e.target.value)}
                      placeholder="eq:gain_variance"
                      className="font-mono text-[12px] h-8"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="eq-name" className="text-[11px] font-medium text-muted-foreground uppercase">
                      Descriptive Title
                    </Label>
                    <Input
                      id="eq-name"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="PMT Anode Current Gain"
                      className="text-[12px] h-8"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="eq-formula" className="text-[11px] font-medium text-muted-foreground uppercase">
                      LaTeX Formula
                    </Label>
                    {!formulaValidation.valid ? (
                      <span className="flex items-center gap-1 text-[10px] text-destructive font-medium">
                        <AlertCircle className="size-3" />
                        {formulaValidation.error}
                      </span>
                    ) : formFormula.trim() ? (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="size-3" />
                        Valid KaTeX Syntax
                      </span>
                    ) : null}
                  </div>
                  <Textarea
                    id="eq-formula"
                    value={formFormula}
                    onChange={(e) => setFormFormula(e.target.value)}
                    placeholder="I_C = I_S \left( e^{\frac{V_{BE}}{V_T}} - 1 \right)"
                    className={cn(
                      "font-mono text-[12px] min-h-[90px] leading-relaxed",
                      !formulaValidation.valid && "border-destructive focus-visible:ring-destructive"
                    )}
                  />
                </div>

                {/* Live KaTeX rendering box */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Live Rendering Preview
                  </span>
                  <EquationMathPreview formula={formFormula} className="min-h-[50px] flex items-center justify-center bg-card border-dashed" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="eq-desc" className="text-[11px] font-medium text-muted-foreground uppercase">
                    Description &amp; Variables Glossary
                  </Label>
                  <Input
                    id="eq-desc"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Relates collector current to base-emitter voltage where V_T is thermal voltage."
                    className="text-[12px] h-8"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="eq-context" className="text-[11px] font-medium text-muted-foreground uppercase">
                    MinerU / Source Context Snippet
                  </Label>
                  <Textarea
                    id="eq-context"
                    value={formContext}
                    onChange={(e) => setFormContext(e.target.value)}
                    placeholder="Original surrounding text from the ingested PDF..."
                    className="text-[11px] min-h-[60px] leading-relaxed bg-muted/20"
                  />
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-border">
                  <Button onClick={handleSave} disabled={!formFormula.trim() || !formulaValidation.valid} className="h-8 text-[12px] px-5">
                    {isAddingNew ? "Add to Library" : "Save Changes"}
                  </Button>
                  <Button variant="ghost" onClick={cancelForm} className="h-8 text-[12px]">
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* Equations List View */
            <div className="flex-1 flex flex-col min-h-0 bg-muted/10">
              {/* Search & Filter Bar */}
              <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-card">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by key, formula, or descriptive title..."
                    className="pl-8 h-8 text-[12px] bg-muted/30"
                  />
                </div>
              </div>

              {/* List */}
              <ScrollArea className="flex-1 min-h-0 p-6">
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Sparkles className="size-8 text-muted-foreground/40 mb-3" />
                    <p className="text-sm font-semibold text-foreground">No equations found</p>
                    <p className="text-[12px] text-muted-foreground max-w-sm mt-1">
                      {equations.length === 0
                        ? "Upload papers in the Ingestion Drawer to extract equations automatically, or click '+ Add Equation' to pre-configure your own."
                        : "No equations matching your search query."}
                    </p>
                    {equations.length === 0 && (
                      <Button size="sm" onClick={startAddNew} className="mt-4 h-8 text-[12px] gap-1.5">
                        <Plus className="size-3.5" />
                        Create First Equation
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3.5 pb-6">
                    {filtered.map((eq) => (
                      <div
                        key={eq.id}
                        className="rounded-lg border border-border bg-card p-4 shadow-xs transition-all hover:border-muted-foreground/40 flex flex-col gap-2.5"
                      >
                        {/* Top Meta Row */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <span className="font-mono text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                              {eq.key}
                            </span>
                            <span className="text-[13px] font-bold text-foreground truncate">
                              {eq.name}
                            </span>
                            {eq.page && (
                              <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-px rounded">
                                p.{eq.page}
                              </span>
                            )}
                          </div>

                          {/* Quick Actions */}
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopy(eq.formula, eq.id)}
                              className="h-7 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                              title="Copy LaTeX Formula"
                            >
                              {copiedId === eq.id ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                              {copiedId === eq.id ? "Copied" : "Copy"}
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEdit(eq)}
                              className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                              title="Edit Equation"
                            >
                              <Edit2 className="size-3" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteEquation(eq.id)}
                              className="h-7 px-2 text-[11px] text-muted-foreground hover:text-destructive"
                              title="Delete Equation"
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          </div>
                        </div>

                        {/* Rendered Math Box */}
                        <EquationMathPreview formula={eq.formula} />

                        {/* Description & MinerU Context */}
                        {eq.description && (
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            <span className="font-semibold text-foreground/80">Definition: </span>
                            {eq.description}
                          </p>
                        )}

                        {eq.contextSnippet && (
                          <div className="rounded bg-muted/40 p-2 border border-border/50 text-[10px] text-muted-foreground font-mono leading-relaxed line-clamp-2">
                            <span className="font-sans font-semibold text-[9px] uppercase tracking-wider text-muted-foreground block mb-0.5">
                              📄 MinerU Context:
                            </span>
                            {eq.contextSnippet}
                          </div>
                        )}

                        {/* Footer: Insert Actions */}
                        <div className="flex items-center justify-between pt-2 border-t border-border/60 mt-1">
                          <div className="flex items-center gap-2">
                            {selectedCard && (
                              <span className="text-[10px] text-muted-foreground truncate max-w-[240px]">
                                Target: <span className="font-semibold text-foreground">{selectedCard.title || "Selected card"}</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {selectedCardId ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  render={
                                    <Button size="sm" variant="default" className="h-7 text-[11px] gap-1.5 shadow-xs">
                                      <CornerDownLeft className="size-3" />
                                      Insert into Card
                                      <ChevronDown className="size-3 opacity-60" />
                                    </Button>
                                  }
                                />
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => insertEquation(eq.id, selectedCardId, "display")}>
                                    Display Math ($$...$$)
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => insertEquation(eq.id, selectedCardId, "inline")}>
                                    Inline Math ($...$)
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <span className="text-[10px] text-muted-foreground italic">
                                Select a card on canvas to insert
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
