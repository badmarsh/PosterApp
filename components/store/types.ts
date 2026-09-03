import type { StateCreator } from "zustand"
import type {
  AgentEvent,
  Card,
  ColumnIndex,
  OutputConfig,
  Project,
  ValidationLevel,
} from "@/lib/poster-types"
import type { ThreadMessage } from "@assistant-ui/react"
import type { AssignSlot, ParseLogEntry } from "@/lib/ingestion"
import type { OutputType } from "@/lib/output-types"
import type { Job } from "@/lib/job-queue"

export type ColumnOrNull = ColumnIndex | null

export type InspectorTab = "basics" | "content" | "table" | "figures" | "validation" | "output"

export type Collaborator = {
  clientId: number
  name: string
  color: string
  cursor: { x: number; y: number } | null
}

export interface ProjectSlice {
  project: Project
  selectedCardId: string | null
  isSwitchingProject: boolean
  columnCount: number
  isDirty: boolean
  isSaving: boolean
  lastSavedAt: Date | null

  switchProject: (id: string) => Promise<void>
  switchOutput: (outputId: string) => void
  deleteOutput: (outputId: string) => void
  getStatus: (card: Card) => ValidationLevel
  selectCard: (id: string | null) => void
  updateProject: (patch: Partial<Omit<Project, "id" | "cards">>) => void
  updateActiveOutput: (patch: Partial<OutputConfig>) => void
  updateActiveThemeColor: (hex: string) => void
  _setCardsFromYjs: (cards: Card[]) => void
  /** Remote output metadata (title/authors/venue/logos/theme) from Yjs; never echoes back. */
  _setOutputMetaFromYjs: (outputId: string, meta: Partial<OutputConfig>) => void
  updateCard: (id: string, patch: Partial<Card>) => void
  addCard: (column?: ColumnOrNull) => void
  addOutput: (outputType: OutputType, templateId: string) => void
  deleteCard: (id: string) => void
  reorderCard: (id: string, dir: -1 | 1) => void
  moveColumn: (id: string, column: ColumnOrNull) => void
  moveCard: (id: string, toColumn: ColumnOrNull, toIndex: number) => void
  validateCardAction: (id: string) => void
  generateLatexForCardAction: (id: string) => void
  autoFillCardAction: (id: string, opts?: { bulk?: boolean }) => Promise<void>
  autoFillAllCardsAction: () => Promise<void>
  generateNewOutputStructure: (outputType: OutputType, count?: number) => Promise<void>
  aiReview: () => Promise<void>
  newProject: () => void
  duplicateProject: () => Promise<void>
  saveProject: () => Promise<void>
  convertOutputAction: (sourceOutputId: string, targetType: OutputType) => Promise<void>
}

export interface IngestionSlice {
  ingestionOpen: boolean
  parseLog: ParseLogEntry[]

  openIngestion: () => void
  closeIngestion: () => void
  uploadFiles: (files: File[]) => void
  processFile: (id: string, workspaceId?: string) => Promise<void>
  retryFile: (id: string) => void
  removeFile: (id: string) => void
  removeAllLegacyAssets: () => void
  dismissFile: (id: string) => void
  updateAssetUrl: (assetId: string, newUrl: string) => void
  promoteAsset: (assetId: string, cardId: string, slot: AssignSlot) => void
  unassignAsset: (assetId: string) => void
  discardAsset: (assetId: string) => void
  renameFile: (id: string, newName: string) => Promise<void>
  backfillCaptions: () => Promise<void>
  pushLog: (level: ParseLogEntry["level"], message: string) => void
}

export interface BibSlice {
  bibContent: string
  bibKeys: string[]
  bibEntries: import("@/lib/bib-types").BibEntry[]
  isBibManagerOpen: boolean
  setIsBibManagerOpen: (open: boolean) => void

  fetchBib: (projectId: string) => Promise<void>
  updateBib: (projectId: string, bib: string) => Promise<void>
  addBibEntry: (entry: Partial<import("@/lib/bib-types").BibEntry>) => Promise<void>
  updateBibEntry: (oldKey: string, entry: Partial<import("@/lib/bib-types").BibEntry>) => Promise<void>
  deleteBibEntry: (key: string) => Promise<void>
  insertCitation: (key: string, cardId: string) => void
  lookupCitation: (query: string) => Promise<import("@/lib/bib-types").BibEntry | null>
  suggestCitationsForCard: (cardContent: string, cardTitle?: string) => Promise<import("@/lib/services/citation-suggester").SuggestedCitation[]>
}

export interface EquationSlice {
  equations: import("@/lib/equation-types").EquationItem[]
  isEquationLibraryOpen: boolean
  setIsEquationLibraryOpen: (open: boolean) => void

  fetchEquations: (projectId: string) => Promise<void>
  addEquation: (eq: Omit<import("@/lib/equation-types").EquationItem, "id" | "workspaceId">) => Promise<void>
  updateEquation: (id: string, updates: Partial<import("@/lib/equation-types").EquationItem>) => Promise<void>
  deleteEquation: (id: string) => Promise<void>
  insertEquation: (eqIdOrFormula: string, cardId: string, format?: "display" | "inline") => void
}

export interface UiSlice {
  agentEvents: AgentEvent[]
  generatingIds: string[]
  isAiStreaming: boolean
  setIsAiStreaming: (v: boolean) => void

  // Compile state (persisted across tab switches)
  compiling: boolean
  pdfData: Uint8Array | null
  compileLog: string | null
  compileOk: boolean | null

  autoCompile: boolean
  setAutoCompile: (v: boolean) => void
  compactMode: boolean
  setCompactMode: (v: boolean) => void
  lastCompileFormat: OutputType
  setLastCompileFormat: (format: OutputType) => void
  /** Run the background VLM layout inspection after a successful compile. */
  layoutCheckEnabled: boolean
  setLayoutCheckEnabled: (v: boolean) => void
  /** Let the LLM patch broken LaTeX and retry when a compile fails. */
  compileAutoFixEnabled: boolean
  setCompileAutoFixEnabled: (v: boolean) => void
  /** Bind ⌘⏎ / Ctrl+Enter to compile. */
  compileOnCmdEnter: boolean
  setCompileOnCmdEnter: (v: boolean) => void
  /** Panel visibility on app load (desktop shell). */
  agentPanelOpenOnLoad: boolean
  setAgentPanelOpenOnLoad: (v: boolean) => void
  structurePanelOpenOnLoad: boolean
  setStructurePanelOpenOnLoad: (v: boolean) => void
  /** Which right-sidebar tab is shown when the inspector first opens. */
  inspectorDefaultTab: "editor" | "pdf"
  setInspectorDefaultTab: (tab: "editor" | "pdf") => void
  layoutWarnings: { cardId?: string; cardTitle: string; issue: string; recommendation: string; estimatedOverflowCharacters?: number; compiledRevision?: number }[]
  lastReviewedRevision: number | null
  setLastReviewedRevision: (r: number | null) => void

  collaborators: Collaborator[]
  setCollaborators: (c: Collaborator[]) => void
  collabEnabled: boolean
  setCollabEnabled: (v: boolean) => void
  yjsStatus: string
  setYjsStatus: (s: string) => void

  isHistoryOpen: boolean
  setIsHistoryOpen: (v: boolean) => void
  isActionsOpen: boolean
  setIsActionsOpen: (v: boolean) => void
  isScannerOpen: boolean
  setIsScannerOpen: (v: boolean) => void
  isAcademicSearchOpen: boolean
  setIsAcademicSearchOpen: (v: boolean) => void
  scannerImage: string | null
  setScannerImage: (img: string | null) => void
  openScannerWithImage: (img: string) => void

  pendingAiPrompt: string | null
  setPendingAiPrompt: (prompt: string | null) => void

  inspectorTab: InspectorTab
  isInspectorOpen: boolean
  isHeaderUnlocked: boolean
  setHeaderUnlocked: (v: boolean) => void
  showLatexSource: boolean
  toggleLatexSource: () => void
  lastWorkspaceId: string | null
  setLastWorkspaceId: (id: string | null) => void
  toggleInspector: () => void
  setInspectorTab: (tab: InspectorTab) => void

  chatMessages: ThreadMessage[]
  setChatMessages: (messages: ThreadMessage[]) => void
  hydrateUi: (events: AgentEvent[], messages: ThreadMessage[]) => void

  pushEvent: (e: Omit<AgentEvent, "id" | "ts">) => string
  updateEvent: (id: string, patch: Partial<AgentEvent>) => void

  jobs: Job[]
  cancelJob: (id: string) => void

  compileProject: (format?: OutputType) => Promise<void>
}

export type EditorState = ProjectSlice & IngestionSlice & BibSlice & EquationSlice & UiSlice

export type EditorSlice<T> = StateCreator<
  EditorState,
  [["zustand/immer", never]],
  [],
  T
>
