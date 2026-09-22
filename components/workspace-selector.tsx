"use client"

import { useEffect, useState, useMemo } from "react"
import { apiFetch } from "@/lib/api-fetch"
import { TEMPLATE_REGISTRY as TEMPLATES, type OutputType } from "@/lib/output-types"
import {
  FolderOpen, Sparkles, Copy, AlertCircle, Search, X, ArrowRight,
  Layers, Presentation, FileText, Award, Atom, Cpu, Dna, Clock,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { ALL_SHOWCASE_PROJECTS } from "@/lib/showcases-data"
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const FLAGSHIP_SHOWCASES = [
  { id: "atlas-bose-einstein-correlations", posterImg: "/showcases/atlas-bose-einstein-correlations.png", icon: Atom, field: "Casticova fyzika", venue: "CERN LHC", title: "Two-Particle Bose-Einstein Correlations in 13 TeV pp Collisions", authors: "R. Astalos, ATLAS Collaboration", color: "#C8102E" },
  { id: "speculative-decoding-guarantees", posterImg: "/showcases/speculative-decoding-guarantees.png", icon: Cpu, field: "AI LLM Inference", venue: "NeurIPS 2026", title: "MartingaleTree: Lossless Speculative Decoding", authors: "Julian Richter, Maya Lin, Aris Thorne", color: "#4F46E5" },
  { id: "alphafold-protein-folding", posterImg: "/showcases/alphafold-protein-folding.png", icon: Dna, field: "Strukturna biologia", venue: "Nature 596", title: "Highly Accurate Protein Structure Prediction with AlphaFold 2", authors: "John Jumper, Richard Evans, Demis Hassabis et al.", color: "#059669" },
  { id: "vla-autonomous-surgery", posterImg: "/showcases/vla-autonomous-surgery.png", icon: Sparkles, field: "Robotika", venue: "CVPR 2027", title: "SurgiVLA: Safety-Constrained VLA Microsurgery", authors: "Maya Chen, Elias Novak, Priya Raman", color: "#00A6A6" },
  { id: "neural-wavefunction-superconductors", posterImg: "/showcases/neural-wavefunction-superconductors.png", icon: Cpu, field: "Kvantova fyzika", venue: "PRL", title: "Neural Quantum States for High-Temperature Superconductors", authors: "Elena Marchetti, Kai Nakamura, Tomas Barta", color: "#7C3AED" },
]

const FORMAT_OPTIONS: { id: OutputType; title: string; badge: string; icon: typeof Layers; defaultTemplate: string }[] = [
  { id: "poster", title: "Konferencny poster", badge: "A0 / A3", icon: Layers, defaultTemplate: "atlas" },
  { id: "slides", title: "Prezentacia", badge: "16:9 Beamer", icon: Presentation, defaultTemplate: "beamer-metropolis" },
  { id: "paper", title: "Vedecky clanok", badge: "Journal / Preprint", icon: FileText, defaultTemplate: "article-twocol" },
  { id: "thesis-review", title: "Akademicky posudok", badge: "ECTS normy", icon: Award, defaultTemplate: "posudok-sk" },
]
export function WorkspaceSelector({
  onSelect,
  onClose,
  initialCreating = false,
}: {
  onSelect: (id: string) => void
  onClose: () => void
  initialCreating?: boolean
}) {
  const [activeShowcase, setActiveShowcase] = useState<string | null>(null)
  const [workspaces, setWorkspaces] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const [searchExisting, setSearchExisting] = useState("")
  const [newId, setNewId] = useState("")
  const [newName, setNewName] = useState("")
  const [newOutputType, setNewOutputType] = useState<OutputType>("poster")
  const [newTemplate, setNewTemplate] = useState("atlas")
  const [idTouched, setIdTouched] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createMode, setCreateMode] = useState<"showcases" | "blank">(initialCreating ? "blank" : "showcases")

  useEffect(() => {
    apiFetch("/api/workspaces").then(async (r) => {
      if (!r.ok) throw new Error("HTTP " + r.status)
      const data = await r.json()
      if (!Array.isArray(data)) throw new Error("Neplatna odpoved")
      setWorkspaces(data); setLoading(false)
    }).catch((err) => { setError(err instanceof Error ? err.message : String(err)); setLoading(false) })
  }, [retryKey])

  const slugify = (v: string) =>
    v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/, "").slice(0, 32)

  const handleNameChange = (v: string) => { setNewName(v); if (!idTouched) setNewId(slugify(v)) }
  const templateOptions = useMemo(() => TEMPLATES.filter((t) => t.outputType === newOutputType), [newOutputType])
  useEffect(() => { if (!templateOptions.some((t) => t.id === newTemplate)) setNewTemplate(templateOptions[0]?.id ?? "") }, [newOutputType, templateOptions, newTemplate])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setCreateError(null)
    const trimmedName = newName.trim()
    let effectiveId = newId.trim()
    if (!effectiveId && trimmedName) { effectiveId = slugify(trimmedName); setNewId(effectiveId) }
    if (!trimmedName) { setCreateError("Zadajte nazov projektu"); return }
    if (!/^[a-zA-Z0-9_-]{3,32}$/.test(effectiveId)) { setCreateError("ID musi mat 3-32 znakov"); return }
    setIsSubmitting(true)
    try {
      const res = await apiFetch("/api/workspaces", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: effectiveId, name: trimmedName, outputType: newOutputType, templateId: newTemplate || undefined }),
      })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || err.message || "HTTP " + res.status) }
      toast.success("Projekt vytvoreny"); onSelect(effectiveId)
    } catch (err) { setCreateError(err instanceof Error ? err.message : String(err)); setIsSubmitting(false) }
  }

  const handleDuplicateShowcase = async (showcaseId: string) => {
    const showcase = ALL_SHOWCASE_PROJECTS.find((p) => p.id === showcaseId)
    if (!showcase) return
    setIsSubmitting(true)
    try {
      const suffix = Date.now().toString(36).slice(-4)
      const cleanBase = showcase.id.replace(/^demo_/, "").replace(/[^a-zA-Z0-9_-]/g, "-")
      const nId = (cleanBase + "-copy-" + suffix).slice(0, 64)
      const nName = showcase.name + " (Kopia)"
      const activeOut = showcase.outputs.find((o) => o.id === showcase.activeOutputId) || showcase.outputs[0]
      const res = await apiFetch("/api/workspaces", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: nId, name: nName, outputType: activeOut?.outputType ?? "poster", templateId: activeOut?.templateId ?? "atlas" }),
      })
      if (!res.ok) { toast.info("Demo rezim"); onSelect(showcase.id); onClose(); return }
      const created = await res.json() as { revision?: number }
      const outputs = showcase.outputs.map((o, i) => ({
        ...o, id: "out_" + o.outputType + "_" + suffix + "_" + i,
        cards: (o.cards || []).map((card: any, j: number) => ({ ...card, id: "card_" + suffix + "_" + i + "_" + j, figures: card.figures ?? [] })),
      }))
      await apiFetch("/api/workspaces/" + nId, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nName, authors: showcase.authors, venue: showcase.venue, outputs, activeOutputId: outputs[0]?.id, expectedRevision: created.revision ?? 0 }),
      })
      toast.success("Klonovanie dokoncene"); onSelect(nId); onClose()
    } catch (err) { console.error(err); onSelect(showcaseId); onClose() }
    finally { setIsSubmitting(false) }
  }

  const filteredWorkspaces = useMemo(() => {
    if (!searchExisting.trim()) return workspaces
    const q = searchExisting.toLowerCase()
    return workspaces.filter((ws) => ws.name?.toLowerCase().includes(q) || ws.id?.toLowerCase().includes(q))
  }, [workspaces, searchExisting])




  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent
        className="z-[60] w-[96vw] max-w-[1080px] p-0 overflow-hidden rounded-2xl border border-border/70 shadow-2xl bg-background flex flex-col"
        style={{ height: "88vh", maxHeight: "880px" }}
        showCloseButton
      >
        {/* Focus absorber - prevents search from auto-focusing on dialog open */}
        <button className="sr-only" tabIndex={0} aria-hidden="true" />
        {/* LOGO HEADER */}
        <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-border/60 shrink-0">
          <img src="/apple-icon.png" alt="PosterApp" className="size-8 rounded-lg" />
          <div>
            <DialogTitle className="text-sm font-bold tracking-tight leading-none text-foreground">PosterApp</DialogTitle>
            <DialogDescription className="text-[11px] text-muted-foreground mt-0.5 leading-none">Vedecke studio · LaTeX · AI</DialogDescription>
          </div>
        </div>

        {/* BODY: two columns, each with their own header */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* ── LEFT COLUMN ── */}
          <div className="w-[260px] shrink-0 border-r border-border/60 flex flex-col overflow-hidden bg-muted/50">

            {/* Left header — fixed 44px height, border-b */}
            <div className="h-[44px] flex items-center px-4 border-b border-border/60 shrink-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Otvorit existujuci</p>
            </div>

            {/* Search */}
            <div className="px-3 pt-2.5 pb-2 shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                <Input value={searchExisting} onChange={(e) => setSearchExisting(e.target.value)} placeholder="Hladat..." tabIndex={-1} className="h-8 pl-8 pr-7 text-xs bg-background border-border/50 focus-visible:ring-1 focus-visible:ring-border" />
                {searchExisting && <button type="button" onClick={() => setSearchExisting("")} className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"><X className="size-3.5" /></button>}
              </div>
            </div>

            {/* Workspace list */}
            <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
              {loading ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-3 rounded-lg border border-border/50 bg-card space-y-1.5"><Skeleton className="h-3 w-3/4" /><Skeleton className="h-2.5 w-1/2" /></div>
              )) : error ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs space-y-2">
                  <p className="font-medium text-destructive">{error}</p>
                  <button onClick={() => { setError(null); setLoading(true); setRetryKey((k) => k + 1) }} className="text-destructive/70 underline text-[11px] cursor-pointer">Skusit znova</button>
                </div>
              ) : filteredWorkspaces.length > 0 ? filteredWorkspaces.map((ws) => (
                <button key={ws.id} onClick={() => onSelect(ws.id)} className="group w-full text-left p-3 rounded-lg border border-border/50 bg-card hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="text-[10px] font-mono text-muted-foreground/60 truncate">{ws.id}</span>
                    <Clock className="size-3 text-muted-foreground/40 shrink-0" />
                  </div>
                  <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-2">{ws.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{ws.outputs?.length ? ws.outputs.length + " dokumenty" : "1 dokument"}</p>
                </button>
              )) : (
                <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                  <FolderOpen className="size-8 text-muted-foreground/30 stroke-1" />
                  <p className="text-xs text-muted-foreground">Ziadne ulozene projekty</p>
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

            {/* Right header — same fixed 44px height, border-b, with toggles */}
            <div className="h-[44px] flex items-center gap-2 px-5 border-b border-border/60 shrink-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex-1">Vytvorit novy</p>
              <button type="button" onClick={() => setCreateMode("showcases")} className={cn("text-xs font-semibold px-3 py-1 rounded-lg transition-all cursor-pointer", createMode === "showcases" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground hover:bg-muted/60")}>S predpripravenym obsahom</button>
              <button type="button" onClick={() => setCreateMode("blank")} className={cn("text-xs font-semibold px-3 py-1 rounded-lg transition-all cursor-pointer", createMode === "blank" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground hover:bg-muted/60")}>Prazdny projekt</button>
            </div>

            {/* Right content */}
            <div className="flex-1 overflow-y-auto">
              {createMode === "showcases" ? (
                <div className="p-5 pb-8">
                  <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                    {FLAGSHIP_SHOWCASES.map((item) => {
                      const isActive = activeShowcase === item.id
                      return (
                        <div key={item.id} className={cn("group relative flex flex-col rounded-xl border overflow-hidden cursor-pointer transition-all duration-150", isActive ? "border-primary shadow-md ring-2 ring-primary/20" : "border-border/70 hover:border-primary/50 hover:shadow-sm")} onClick={() => setActiveShowcase(isActive ? null : item.id)}>
                          <div className="relative aspect-[4/5] overflow-hidden bg-muted/30">
                            <img src={item.posterImg} alt={item.title} className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.04]" loading="lazy" />
                            <div className="absolute top-2 left-2">
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md text-white border border-white/10" style={{ backgroundColor: item.color + "cc" }}>{item.field}</span>
                            </div>
                          </div>
                          <div className="p-3 bg-background flex flex-col gap-0.5">
                            <p className="text-[10px] text-muted-foreground font-medium truncate">{item.venue}</p>
                            <h4 className={cn("text-xs font-bold leading-snug line-clamp-2 transition-colors", isActive ? "text-primary" : "text-foreground group-hover:text-primary")}>{item.title}</h4>
                            <p className="text-[10px] text-muted-foreground truncate">{item.authors}</p>
                          </div>
                          {isActive && (
                            <div className="px-3 pb-3 bg-background flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <Button size="sm" variant="outline" className="flex-1 h-7 text-[11px] gap-1 cursor-pointer" disabled={isSubmitting} onClick={() => handleDuplicateShowcase(item.id)}><Copy className="size-3" />Klonovat</Button>
                              <Button size="sm" className="flex-1 h-7 text-[11px] gap-1 cursor-pointer" onClick={() => { onSelect(item.id); onClose() }}>Otvorit<ArrowRight className="size-3" /></Button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-6 max-w-md">
                  <p className="text-sm font-semibold text-foreground mb-4">Novy prazdny projekt</p>
                  <div className="grid grid-cols-2 gap-2 mb-5">
                    {FORMAT_OPTIONS.map((f) => {
                      const Icon = f.icon
                      const isSelected = newOutputType === f.id
                      return (
                        <button key={f.id} type="button" onClick={() => { setNewOutputType(f.id); const opt = FORMAT_OPTIONS.find((x) => x.id === f.id); if (opt) setNewTemplate(opt.defaultTemplate) }} className={cn("flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer", isSelected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border/70 bg-card hover:border-primary/40")}>
                          <span className={cn("size-7 rounded-lg flex items-center justify-center shrink-0", isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}><Icon className="size-3.5" /></span>
                          <div className="min-w-0"><p className="text-xs font-semibold text-foreground leading-tight">{f.title}</p><p className="text-[10px] text-muted-foreground">{f.badge}</p></div>
                        </button>
                      )
                    })}
                  </div>
                  {createError && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive flex items-center gap-2 mb-4"><AlertCircle className="size-3.5 shrink-0" /><span>{createError}</span></div>}
                  <form onSubmit={handleCreate} className="flex flex-col gap-3">
                    <div>
                      <Label htmlFor="ws-name" className="text-xs font-semibold mb-1.5 block">Nazov projektu</Label>
                      <Input id="ws-name" autoFocus value={newName} onChange={(e) => handleNameChange(e.target.value)} placeholder="Napr. Vyskum supravodivosti" disabled={isSubmitting} className="h-9 text-xs bg-background" />
                    </div>
                    <div>
                      <Label htmlFor="ws-template" className="text-xs font-semibold mb-1.5 block">Sablona</Label>
                      <Select value={newTemplate} onValueChange={(val) => val && setNewTemplate(val)} disabled={isSubmitting}>
                        <SelectTrigger id="ws-template" className="h-9 text-xs bg-background"><SelectValue /></SelectTrigger>
                        <SelectContent>{templateOptions.map((t) => (<SelectItem key={t.id} value={t.id} className="text-xs">{t.label} ({t.latexClass || t.id})</SelectItem>))}</SelectContent>
                      </Select>
                    </div>
                    {newId && <p className="text-[10px] text-muted-foreground font-mono">ID: {newId}</p>}
                    <Button type="submit" disabled={isSubmitting} className="h-9 text-xs font-semibold gap-1.5 cursor-pointer mt-1"><span>Vytvorit projekt</span><ArrowRight className="size-3.5" /></Button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}