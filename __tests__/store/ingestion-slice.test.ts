import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEditorStore } from '@/components/editor-store'

// Mock external dependencies
vi.mock('@/lib/api-fetch', () => ({
  apiFetch: vi.fn(),
}))

// Mock idb-keyval
vi.mock('idb-keyval', () => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
}))

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}))

describe('ingestion-slice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initializes with ingestion closed and empty log', () => {
    const store = createEditorStore()
    expect(store.getState().ingestionOpen).toBe(false)
    expect(store.getState().parseLog).toEqual([])
  })

  it('opens and closes ingestion panel', () => {
    const store = createEditorStore()

    store.getState().openIngestion()
    expect(store.getState().ingestionOpen).toBe(true)

    store.getState().closeIngestion()
    expect(store.getState().ingestionOpen).toBe(false)
  })

  it('pushLog adds entries to the parse log', () => {
    const store = createEditorStore()

    store.getState().pushLog('info', 'Starting parse')
    store.getState().pushLog('warning', 'Low quality image')
    store.getState().pushLog('error', 'Parse failed')

    const log = store.getState().parseLog
    expect(log).toHaveLength(3)
    expect(log[0].level).toBe('info')
    expect(log[0].message).toBe('Starting parse')
    expect(log[1].level).toBe('warning')
    expect(log[2].level).toBe('error')
    // Each entry should have an id and timestamp
    expect(log[0].id).toBeDefined()
    expect(log[0].ts).toBeDefined()
  })

  it('dismissFile sets dismissed to true', () => {
    const store = createEditorStore()

    // Add a test file to project.ingestFiles
    store.getState().updateProject({})
    store.setState((s) => {
      s.project.ingestFiles.push({
        id: 'file_test1',
        name: 'test.pdf',
        size: 1024,
        method: 'MinerU',
        status: 'done',
        progress: 100,
      })
    })

    store.getState().dismissFile('file_test1')

    const file = store.getState().project.ingestFiles.find((f) => f.id === 'file_test1')
    expect(file?.dismissed).toBe(true)
  })

  it('removeFile removes file and its associated assets', async () => {
    const store = createEditorStore()

    // Set up initial state with a file and associated assets
    store.setState((s) => {
      s.project.ingestFiles.push({
        id: 'file_abc',
        name: 'paper.pdf',
        size: 2048,
        method: 'MinerU',
        status: 'done',
        progress: 100,
      })
      s.project.assets.push(
        {
          id: 'asset_1',
          fileId: 'file_abc',
          kind: 'figure',
          page: 1,
          confidence: 'high',
          url: '/test.png',
          thumbnailUrl: '/test.png',
        } as any,
        {
          id: 'asset_2',
          fileId: 'file_other',
          kind: 'text',
          page: 2,
          confidence: 'medium',
        } as any
      )
    })

    await store.getState().removeFile('file_abc')

    // File should be removed
    expect(store.getState().project.ingestFiles.find((f) => f.id === 'file_abc')).toBeUndefined()
    // Assets from file_abc should be removed
    expect(store.getState().project.assets.find((a) => a.id === 'asset_1')).toBeUndefined()
    // Assets from other files should remain
    expect(store.getState().project.assets.find((a) => a.id === 'asset_2')).toBeDefined()
  })

  it('discardAsset removes a specific asset', () => {
    const store = createEditorStore()

    store.setState((s) => {
      s.project.assets.push(
        { id: 'a1', fileId: 'f1', kind: 'figure', page: 1, confidence: 'high' } as any,
        { id: 'a2', fileId: 'f1', kind: 'table', page: 2, confidence: 'high' } as any
      )
    })

    store.getState().discardAsset('a1')

    expect(store.getState().project.assets.find((a) => a.id === 'a1')).toBeUndefined()
    expect(store.getState().project.assets.find((a) => a.id === 'a2')).toBeDefined()
  })

  it('unassignAsset clears card assignment', () => {
    const store = createEditorStore()

    store.setState((s) => {
      s.project.assets.push({
        id: 'a1',
        fileId: 'f1',
        kind: 'figure',
        page: 1,
        confidence: 'high',
        assignedCardId: 'card_1',
        assignedSlot: 'figure1',
      } as any)
    })

    store.getState().unassignAsset('a1')

    const asset = store.getState().project.assets.find((a) => a.id === 'a1')
    expect(asset?.assignedCardId).toBeUndefined()
    expect(asset?.assignedSlot).toBeUndefined()
  })

  it('updateAssetUrl updates both url and thumbnailUrl', () => {
    const store = createEditorStore()

    store.setState((s) => {
      s.project.assets.push({
        id: 'a1',
        fileId: 'f1',
        kind: 'figure',
        page: 1,
        confidence: 'high',
        url: '/old.png',
        thumbnailUrl: '/old.png',
      } as any)
    })

    store.getState().updateAssetUrl('a1', '/new-edited.png')

    const asset = store.getState().project.assets.find((a) => a.id === 'a1')
    expect(asset?.url).toBe('/new-edited.png')
    expect(asset?.thumbnailUrl).toBe('/new-edited.png')
  })

  it('promoteAsset assigns asset to card figure slot', () => {
    const store = createEditorStore()

    store.setState((s) => {
      s.project.outputs[0].cards = [
        {
          id: 'card_1',
          title: 'Results',
          column: 1,
          order: 0,
          pattern: 'bullets-image',
          content: '',
          table: { hasHeader: true, caption: '', rows: [] },
          figures: [],
          figureLayout: 'single',
          sourceIds: [],
          heightBudget: null,
          validation: 'valid',
        },
      ]
      s.project.assets.push({
        id: 'a1',
        fileId: 'f1',
        kind: 'figure',
        page: 1,
        confidence: 'high',
        thumbnailUrl: '/fig.png',
        caption: 'Test caption',
      } as any)
    })

    store.getState().promoteAsset('a1', 'card_1', 'figure1')

    const card = store.getState().project.outputs[0].cards.find((c) => c.id === 'card_1')
    expect(card?.figures[0]).toBeDefined()
    expect(card?.figures[0].url).toBe('/fig.png')
    expect(card?.figures[0].caption).toBe('Test caption')

    const asset = store.getState().project.assets.find((a) => a.id === 'a1')
    expect(asset?.assignedCardId).toBe('card_1')
    expect(asset?.assignedSlot).toBe('figure1')
  })

  it('promoteAsset adds text snippet to card bullets', () => {
    const store = createEditorStore()

    store.setState((s) => {
      s.project.outputs[0].cards = [
        {
          id: 'card_1',
          title: 'Introduction',
          column: 1,
          order: 0,
          pattern: 'bullets',
          content: '- Existing point',
          table: { hasHeader: true, caption: '', rows: [] },
          figures: [],
          figureLayout: 'single',
          sourceIds: [],
          heightBudget: null,
          validation: 'valid',
        },
      ]
      s.project.assets.push({
        id: 'a1',
        fileId: 'f1',
        kind: 'text',
        page: 1,
        confidence: 'high',
        snippet: 'Important finding from the paper.',
      } as any)
    })

    store.getState().promoteAsset('a1', 'card_1', 'bullets')

    const card = store.getState().project.outputs[0].cards.find((c) => c.id === 'card_1')
    expect(card?.content).toContain('Important finding from the paper.')
    expect(card?.content).toContain('- Existing point')
  })

  it('promoteAsset assigns table asset safely even if card.table is undefined', () => {
    const store = createEditorStore()

    store.setState((s) => {
      s.project.outputs[0].cards = [
        {
          id: 'card_1',
          title: 'Methods',
          column: 1,
          order: 0,
          pattern: 'bullets-table',
          content: '',
          table: undefined as any,
          figures: [],
          figureLayout: 'single',
          sourceIds: [],
          heightBudget: null,
          validation: 'valid',
        },
      ]
      s.project.assets.push({
        id: 'a_tbl',
        fileId: 'f1',
        kind: 'table',
        page: 2,
        confidence: 'high',
        caption: 'Extracted Table Caption',
        tableRows: [['Col1', 'Col2'], ['Val1', 'Val2']],
      } as any)
    })

    expect(() => {
      store.getState().promoteAsset('a_tbl', 'card_1', 'table')
    }).not.toThrow()

    const card = store.getState().project.outputs[0].cards.find((c) => c.id === 'card_1')
    expect(card?.table).toBeDefined()
    expect(card?.table.caption).toBe('Extracted Table Caption')
    expect(card?.table.rows).toEqual([['Col1', 'Col2'], ['Val1', 'Val2']])
  })
})
