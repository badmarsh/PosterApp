"use client"

import { useState, useMemo, useEffect } from "react"
import { useEditor } from "@/components/editor-store"
import { useShallow } from "zustand/react/shallow"
import {
  Dialog,
  DialogContent,
  DialogPortal,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  BookOpen,
  Search,
  Plus,
  Upload,
  Copy,
  Check,
  Trash2,
  Edit2,
  ExternalLink,
  Sparkles,
  Loader2,
  CornerDownLeft,
  FileText,
  FileCode2,
  X,
  RefreshCw,
} from "lucide-react"
import { type BibEntry, slugifyCiteKey } from "@/lib/bib-types"
import { cn } from "@/lib/utils"

export function BibliographyDialog() {
  const {
    project,
    bibContent,
    bibKeys,
    bibEntries,
    isBibManagerOpen,
    setIsBibManagerOpen,
    updateBib,
    addBibEntry,
    updateBibEntry,
    deleteBibEntry,
    insertCitation,
    lookupCitation,
    selectedCardId,
    pushEvent,
  } = useEditor(
    useShallow((s) => ({
      project: s.project,
      bibContent: s.bibContent,
      bibKeys: s.bibKeys,
      bibEntries: s.bibEntries,
      isBibManagerOpen: s.isBibManagerOpen,
      setIsBibManagerOpen: s.setIsBibManagerOpen,
      updateBib: s.updateBib,
      addBibEntry: s.addBibEntry,
      updateBibEntry: s.updateBibEntry,
      deleteBibEntry: s.deleteBibEntry,
      insertCitation: s.insertCitation,
      lookupCitation: s.lookupCitation,
      selectedCardId: s.selectedCardId,
      pushEvent: s.pushEvent,
    }))
  )

  const [activeTab, setActiveTab] = useState<"library" | "lookup" | "raw">("library")
  const [searchQuery, setSearchQuery] = useState("")
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [localRawBib, setLocalRawBib] = useState(bibContent)

  // Lookup state
  const [lookupQuery, setLookupQuery] = useState("")
  const [isLookingUp, setIsLookingUp] = useState(false)
  const [lookupResult, setLookupResult] = useState<BibEntry | null>(null)

  // Add / Edit form state
  const [isEditing, setIsEditing] = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [formType, setFormType] = useState("article")
  const [formKey, setFormKey] = useState("")
  const [formTitle, setFormTitle] = useState("")
  const [formAuthors, setFormAuthors] = useState("")
  const [formYear, setFormYear] = useState("")
  const [formJournal, setFormJournal] = useState("")
  const [formDoi, setFormDoi] = useState("")
  const [formUrl, setFormUrl] = useState("")
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null)

  // Keep raw bib in sync
  useEffect(() => {
    setLocalRawBib(bibContent)
  }, [bibContent])

  // Filtered entries
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return bibEntries
    const q = searchQuery.toLowerCase().trim()
    return bibEntries.filter(
      (e) =>
        e.key.toLowerCase().includes(q) ||
        e.title.toLowerCase().includes(q) ||
        e.authorString.toLowerCase().includes(q) ||
        (e.journal && e.journal.toLowerCase().includes(q)) ||
        (e.year && e.year.includes(q))
    )
  }, [bibEntries, searchQuery])

  // Copy citation helper
  const handleCopyCite = (key: string) => {
    navigator.clipboard.writeText(`\\cite{${key}}`)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 1800)
  }

  // Open Edit Form
  const startEdit = (entry: BibEntry) => {
    setEditingKey(entry.key)
    setFormType(entry.type || "article")
    setFormKey(entry.key)
    setFormTitle(entry.title || "")
    setFormAuthors(entry.authorString || "")
    setFormYear(entry.year || "")
    setFormJournal(entry.journal || entry.booktitle || "")
    setFormDoi(entry.doi || "")
    setFormUrl(entry.url || "")
    setIsEditing(true)
  }

  // Open Add Form
  const startAddNew = () => {
    setEditingKey(null)
    setFormType("article")
    setFormKey("")
    setFormTitle("")
    setFormAuthors("")
    setFormYear(new Date().getFullYear().toString())
    setFormJournal("")
    setFormDoi("")
    setFormUrl("")
    setIsEditing(true)
  }

  // Save Form
  const handleSaveForm = async () => {
    if (!formTitle.trim()) return

    const key = formKey.trim() || slugifyCiteKey(formAuthors, formYear, formTitle)
    const entryData: Partial<BibEntry> = {
      key,
      type: formType,
      title: formTitle.trim(),
      authorString: formAuthors.trim(),
      year: formYear.trim() || undefined,
      journal: formType === "article" ? formJournal.trim() || undefined : undefined,
      booktitle: formType !== "article" ? formJournal.trim() || undefined : undefined,
      doi: formDoi.trim() || undefined,
      url: formUrl.trim() || undefined,
    }

    if (editingKey) {
      await updateBibEntry(editingKey, entryData)
    } else {
      await addBibEntry(entryData)
    }
    setIsEditing(false)
  }

  // Run DOI / arXiv / Title lookup
  const handleRunLookup = async () => {
    if (!lookupQuery.trim()) return
    setIsLookingUp(true)
    setLookupResult(null)
    try {
      const entry = await lookupCitation(lookupQuery.trim())
      if (entry) {
        setLookupResult(entry)
      } else {
        pushEvent({
          kind: "info",
          status: "error",
          title: "Citation Lookup Failed",
          detail: "Could not find reference metadata for query.",
        })
      }
    } finally {
      setIsLookingUp(false)
    }
  }

  // Accept Lookup Result into Library
  const handleAcceptLookup = async () => {
    if (!lookupResult) return
    await addBibEntry(lookupResult)
    setLookupResult(null)
    setLookupQuery("")
    setActiveTab("library")
  }

  // Handle .bib file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = ev.target?.result as string
      if (content) {
        const merged = bibContent.trim() ? `${bibContent.trim()}\n\n${content}` : content
        updateBib(project.id, merged)
        pushEvent({
          kind: "info",
          status: "done",
          title: "BibTeX Uploaded",
          detail: `Imported references from ${file.name}`,
        })
      }
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  return (
    <>
    <Dialog open={isBibManagerOpen} onOpenChange={setIsBibManagerOpen}>
      <DialogContent showCloseButton className="w-[95vw] sm:max-w-4xl md:max-w-5xl h-[88vh] p-0 overflow-hidden flex flex-col shadow-2xl border border-border bg-background">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-b border-border bg-card shrink-0 pr-12">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <DialogTitle className="text-base font-semibold tracking-tight flex items-center gap-2 text-foreground">
                <BookOpen className="size-4 text-primary" />
                Bibliography &amp; Citation Library
              </DialogTitle>
              <span className="inline-flex items-center whitespace-nowrap rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-mono font-medium text-primary border border-primary/20">
                {bibEntries.length} {bibEntries.length === 1 ? "reference" : "references"}
              </span>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Manage citations parsed from ingested research papers or lookup DOI and arXiv entries automatically.
            </DialogDescription>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="h-8">
                <TabsTrigger value="library" className="text-xs h-7 px-3">
                  Citations ({bibEntries.length})
                </TabsTrigger>
                <TabsTrigger value="lookup" className="text-xs h-7 px-3 gap-1">
                  <Sparkles className="size-3 text-primary" />
                  Auto-Lookup
                </TabsTrigger>
                <TabsTrigger value="raw" className="text-xs h-7 px-3">
                  Raw .bib
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex flex-1 min-h-0 bg-muted/10">
          {activeTab === "library" && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Search & Actions Strip */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-b border-border bg-card shrink-0">
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search by title, author, key, or year..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 text-xs h-8"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <input
                    type="file"
                    accept=".bib"
                    id="dialog-bib-upload"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById("dialog-bib-upload")?.click()}
                    className="h-8 text-xs gap-1.5"
                  >
                    <Upload className="size-3.5" />
                    Import .bib
                  </Button>
                  <Button
                    size="sm"
                    onClick={startAddNew}
                    className="h-8 text-xs gap-1.5 shadow-xs"
                  >
                    <Plus className="size-3.5" />
                    Add Citation
                  </Button>
                </div>
              </div>

              {/* Edit / Add Form Modal overlay or list */}
              {isEditing ? (
                <div className="flex-1 p-6 overflow-y-auto bg-card space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <h3 className="text-sm font-bold text-foreground">
                      {editingKey ? `Edit Citation: ${editingKey}` : "Add New Citation"}
                    </h3>
                    <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} className="h-7 text-xs">
                      Cancel
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Entry Type</Label>
                      <select
                        value={formType}
                        onChange={(e) => setFormType(e.target.value)}
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                      >
                        <option value="article">@article (Journal Article)</option>
                        <option value="inproceedings">@inproceedings (Conference Paper)</option>
                        <option value="book">@book (Book)</option>
                        <option value="techreport">@techreport (Technical Report)</option>
                        <option value="misc">@misc (Preprint, Website, etc.)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Cite Key</Label>
                      <Input
                        value={formKey}
                        onChange={(e) => setFormKey(e.target.value)}
                        placeholder="e.g. AuthorYear_Keyword (auto-generated if empty)"
                        className="text-xs h-8 font-mono"
                      />
                    </div>

                    <div className="sm:col-span-2 space-y-1.5">
                      <Label className="text-xs font-semibold">Paper Title *</Label>
                      <Input
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        placeholder="e.g. Observation of a new particle in the search..."
                        className="text-xs h-8"
                      />
                    </div>

                    <div className="sm:col-span-2 space-y-1.5">
                      <Label className="text-xs font-semibold">Authors</Label>
                      <Input
                        value={formAuthors}
                        onChange={(e) => setFormAuthors(e.target.value)}
                        placeholder="e.g. ATLAS Collaboration or Doe, J. and Smith, A."
                        className="text-xs h-8"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">
                        {formType === "article" ? "Journal" : "Booktitle / Conference"}
                      </Label>
                      <Input
                        value={formJournal}
                        onChange={(e) => setFormJournal(e.target.value)}
                        placeholder="e.g. Phys. Lett. B or NeurIPS"
                        className="text-xs h-8"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Year</Label>
                      <Input
                        value={formYear}
                        onChange={(e) => setFormYear(e.target.value)}
                        placeholder="e.g. 2024"
                        className="text-xs h-8"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">DOI</Label>
                      <Input
                        value={formDoi}
                        onChange={(e) => setFormDoi(e.target.value)}
                        placeholder="10.1016/j.physletb.2012.08.020"
                        className="text-xs h-8 font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">URL / arXiv</Label>
                      <Input
                        value={formUrl}
                        onChange={(e) => setFormUrl(e.target.value)}
                        placeholder="https://arxiv.org/abs/..."
                        className="text-xs h-8"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-4">
                    <Button onClick={handleSaveForm} className="h-8 text-xs gap-1.5 shadow-xs">
                      <Check className="size-3.5" />
                      Save Citation
                    </Button>
                    <Button variant="outline" onClick={() => setIsEditing(false)} className="h-8 text-xs">
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                /* Citation Cards List */
                <ScrollArea className="flex-1 min-h-0 p-6">
                  {filteredEntries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <BookOpen className="size-10 text-muted-foreground/40 mb-3" />
                      <p className="text-sm font-semibold text-foreground">
                        {searchQuery ? "No citations matching your search" : "No citations in this workspace"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                        Ingest research PDFs to automatically parse references, or lookup papers by DOI / title.
                      </p>
                      <div className="flex items-center gap-2 mt-4">
                        <Button size="sm" onClick={() => setActiveTab("lookup")} className="h-8 text-xs gap-1.5">
                          <Sparkles className="size-3.5" />
                          Lookup by DOI / Title
                        </Button>
                        <Button size="sm" variant="outline" onClick={startAddNew} className="h-8 text-xs gap-1.5">
                          <Plus className="size-3.5" />
                          Add Manually
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 max-w-4xl">
                      {filteredEntries.map((entry) => (
                        <div
                          key={entry.key}
                          className="rounded-lg border border-border bg-card p-4 shadow-xs hover:border-primary/40 transition-all flex flex-col gap-2 group"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                                  \cite&#123;{entry.key}&#125;
                                </span>
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                  @{entry.type}
                                </span>
                                {entry.year && (
                                  <span className="text-[11px] font-medium text-muted-foreground">
                                    ({entry.year})
                                  </span>
                                )}
                              </div>
                              <h4 className="text-sm font-semibold text-foreground leading-snug">
                                {entry.title}
                              </h4>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 opacity-90 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopyCite(entry.key)}
                                className="h-7 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                                title="Copy \cite{key}"
                              >
                                {copiedKey === entry.key ? (
                                  <Check className="size-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="size-3.5" />
                                )}
                                {copiedKey === entry.key ? "Copied" : "Copy"}
                              </Button>

                              {selectedCardId && (
                                <Button
                                  size="sm"
                                  onClick={() => insertCitation(entry.key, selectedCardId)}
                                  className="h-7 text-[11px] gap-1 shadow-xs"
                                  title="Insert \cite into selected card"
                                >
                                  <CornerDownLeft className="size-3.5" />
                                  Insert to Card
                                </Button>
                              )}

                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => startEdit(entry)}
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                title="Edit entry"
                              >
                                <Edit2 className="size-3.5" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => {
                                  if (confirm(`Remove citation "${entry.key}"?`)) {
                                    deleteBibEntry(entry.key)
                                  }
                                }}
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                title="Delete citation"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </div>

                          <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                            {entry.authorString && (
                              <span className="font-medium text-foreground/80">
                                {entry.authorString}
                              </span>
                            )}
                            {(entry.journal || entry.booktitle) && (
                              <span className="italic">
                                • {entry.journal || entry.booktitle}
                                {entry.volume ? ` ${entry.volume}` : ""}
                                {entry.pages ? `, pp. ${entry.pages}` : ""}
                              </span>
                            )}
                            {entry.doi && (
                              <a
                                href={`https://doi.org/${entry.doi}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-0.5 text-primary hover:underline text-[11px]"
                              >
                                DOI <ExternalLink className="size-2.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              )}
            </div>
          )}

          {activeTab === "lookup" && (
            /* DOI / arXiv / Title Search */
            <div className="flex-1 flex flex-col p-6 overflow-y-auto max-w-2xl mx-auto space-y-6">
              <div className="space-y-2">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  Auto-Lookup Citation Metadata
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Paste a DOI (e.g. <code className="bg-muted px-1 py-0.5 rounded text-[11px]">10.1016/j.physletb.2012.08.020</code>), an arXiv identifier (e.g. <code className="bg-muted px-1 py-0.5 rounded text-[11px]">arXiv:1207.7214</code>), or a paper title to automatically fetch standard BibTeX.
                </p>

                <div className="flex items-center gap-2 pt-2">
                  <Input
                    placeholder="Enter DOI, arXiv ID, or paper title..."
                    value={lookupQuery}
                    onChange={(e) => setLookupQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRunLookup()}
                    className="text-xs h-9"
                  />
                  <Button
                    onClick={handleRunLookup}
                    disabled={!lookupQuery.trim() || isLookingUp}
                    className="h-9 text-xs gap-1.5 shadow-sm shrink-0"
                  >
                    {isLookingUp ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        Fetching...
                      </>
                    ) : (
                      <>
                        <Search className="size-3.5" />
                        Lookup
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {lookupResult && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wide text-primary">
                      Found Reference
                    </span>
                    <span className="font-mono text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                      \cite&#123;{lookupResult.key}&#125;
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-foreground">
                    {lookupResult.title}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {lookupResult.authorString} ({lookupResult.year || "n.d."})
                    {lookupResult.journal && ` — ${lookupResult.journal}`}
                  </p>

                  <pre className="p-3 bg-muted/40 rounded border border-border/60 font-mono text-[11px] overflow-x-auto whitespace-pre select-all max-h-40">
                    {lookupResult.rawBibtex}
                  </pre>

                  <div className="flex items-center gap-2 pt-2">
                    <Button onClick={handleAcceptLookup} className="h-8 text-xs gap-1.5 shadow-sm">
                      <Plus className="size-3.5" />
                      Add to Workspace Bibliography
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setLookupResult(null)} className="h-8 text-xs">
                      Clear
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "raw" && (
            /* Raw BibTeX Editor */
            <div className="flex-1 flex flex-col p-6 min-h-0 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Raw references.bib
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Directly view and edit the raw BibTeX file. Changes are automatically parsed and saved.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => updateBib(project.id, localRawBib)}
                  className="h-7 text-xs gap-1 shadow-xs"
                >
                  <Check className="size-3" />
                  Save .bib
                </Button>
              </div>

              <Textarea
                value={localRawBib}
                onChange={(e) => setLocalRawBib(e.target.value)}
                onBlur={() => {
                  if (localRawBib !== bibContent) {
                    updateBib(project.id, localRawBib)
                  }
                }}
                placeholder="@article{...}"
                className="flex-1 min-h-[300px] font-mono text-xs leading-relaxed p-4 bg-card border-border select-all resize-none"
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={!!confirmDeleteKey} onOpenChange={(o) => { if (!o) setConfirmDeleteKey(null) }}>
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive mb-1">
            <Trash2 className="size-4 shrink-0" />
            <DialogTitle className="text-destructive">Delete Citation?</DialogTitle>
          </div>
          <DialogDescription>
            Remove citation <strong>&quot;{confirmDeleteKey}&quot;</strong>? This will also break any text segments currently referencing it.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="-mx-4 -mb-4">
          <Button variant="outline" size="sm" onClick={() => setConfirmDeleteKey(null)}>Cancel</Button>
          <Button variant="destructive" size="sm" onClick={() => { if (confirmDeleteKey) deleteBibEntry(confirmDeleteKey); setConfirmDeleteKey(null) }}>Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
