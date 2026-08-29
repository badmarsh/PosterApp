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
  updateCard: (id: string, patch: Partial<Card>) => void
  addCard: (column?: ColumnOrNull) => void
  addOutput: (outputType: OutputType, templateId: string) => void
  deleteCard: (id: string) => void
  reorderCard: (id: string, dir: -1 | 1) => void
  moveColumn: (id: string, column: ColumnOrNull) => void
  moveCard: (id: string, toColumn: ColumnOrNull, toIndex: number) => void
  validateCardAction: (id: string) => void
  generateLatexForCardAction: (id: string) => void
  autoFillCardAction: (id: string) => Promise<void>
  autoFillAllCardsAction: () => Promise<void>
  generateNewOutputStructure: (outputType: OutputType, count?: number) => Promise<void>
  aiReview: () => Promise<void>
  newProject: () => void
  duplicateProject: () => void
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
  backfillCaptions: () => Promise<void>
  pushLog: (level: ParseLogEntry["level"], message: string) => void
}

export interface BibSlice {
  bibContent: string
  bibKeys: string[]

  fetchBib: (projectId: string) => Promise<void>
  updateBib: (projectId: string, bib: string) => Promise<void>
  insertCitation: (key: string, cardId: string) => void
}

export interface UiSlice {
  agentEvents: AgentEvent[]
  generatingIds: string[]

  // Compile state (persisted across tab switches)
  compiling: boolean
  pdfData: Uint8Array | null
  compileLog: string | null
  compileOk: boolean | null

  autoCompile: boolean
  setAutoCompile: (v: boolean) => void
  lastCompileFormat: OutputType
  setLastCompileFormat: (format: OutputType) => void
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

export type EditorState = ProjectSlice & IngestionSlice & BibSlice & UiSlice

export type EditorSlice<T> = StateCreator<
  EditorState,
  [["zustand/immer", never]],
  [],
  T
>
