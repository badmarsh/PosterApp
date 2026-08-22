import type { StateCreator } from "zustand"
import type {
  AgentEvent,
  Card,
  ColumnIndex,
  Project,
  ValidationLevel,
} from "@/lib/poster-types"
import type { AssignSlot, ParseLogEntry } from "@/lib/ingestion"

export interface ProjectSlice {
  project: Project
  selectedCardId: string | null
  isSwitchingProject: boolean
  columnCount: number
  isDirty: boolean
  isSaving: boolean
  lastSavedAt: Date | null

  switchProject: (id: string) => Promise<void>
  getStatus: (card: Card) => ValidationLevel
  selectCard: (id: string | null) => void
  updateProject: (patch: Partial<Omit<Project, "id" | "cards">>) => void
  updateCard: (id: string, patch: Partial<Card>) => void
  addCard: (column: ColumnIndex) => void
  deleteCard: (id: string) => void
  reorderCard: (id: string, dir: -1 | 1) => void
  moveColumn: (id: string, column: ColumnIndex) => void
  validateCardAction: (id: string) => void
  generateLatexForCardAction: (id: string) => void
  autoFillCardAction: (id: string) => Promise<void>
  autoFillAllCardsAction: () => Promise<void>
  aiReview: () => Promise<void>
  newProject: () => void
  duplicateProject: () => void
  saveProject: () => Promise<void>
}

export interface IngestionSlice {
  ingestionOpen: boolean
  parseLog: ParseLogEntry[]

  openIngestion: () => void
  closeIngestion: () => void
  uploadFiles: (files: File[]) => void
  processFile: (id: string) => Promise<void>
  retryFile: (id: string) => void
  removeFile: (id: string) => void
  removeAllLegacyAssets: () => void
  dismissFile: (id: string) => void
  updateAssetUrl: (assetId: string, newUrl: string) => void
  promoteAsset: (assetId: string, cardId: string, slot: AssignSlot) => void
  unassignAsset: (assetId: string) => void
  discardAsset: (assetId: string) => void
  pushLog: (level: ParseLogEntry["level"], message: string) => void
}

export interface BibSlice {
  bibContent: string
  bibKeys: string[]

  fetchBib: (projectId: string) => Promise<void>
  updateBib: (projectId: string, bib: string) => Promise<void>
}

export interface UiSlice {
  agentEvents: AgentEvent[]
  generatingId: string | null

  pushEvent: (e: Omit<AgentEvent, "id" | "ts">) => void
}

export type EditorState = ProjectSlice & IngestionSlice & BibSlice & UiSlice

export type EditorSlice<T> = StateCreator<
  EditorState,
  [["zustand/immer", never]],
  [],
  T
>
