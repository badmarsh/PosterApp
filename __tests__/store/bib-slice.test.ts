import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEditorStore } from '@/components/editor-store'

// Mock apiFetch so we don't make real network calls
vi.mock('@/lib/api-fetch', () => ({
  apiFetch: vi.fn(),
}))

import { apiFetch } from '@/lib/api-fetch'
const mockApiFetch = vi.mocked(apiFetch)

describe('bib-slice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initializes with empty bib state', () => {
    const store = createEditorStore()
    expect(store.getState().bibContent).toBe('')
    expect(store.getState().bibKeys).toEqual([])
  })

  it('fetchBib populates bibContent and bibKeys on success', async () => {
    const store = createEditorStore()

    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        bib: '@article{Smith2020, title={Test}}',
        keys: ['Smith2020'],
      }),
    } as Response)

    await store.getState().fetchBib('proj-1')

    expect(mockApiFetch).toHaveBeenCalledWith('/api/workspaces/proj-1/bib')
    expect(store.getState().bibContent).toBe('@article{Smith2020, title={Test}}')
    expect(store.getState().bibKeys).toEqual(['Smith2020'])
  })

  it('fetchBib clears state on failure', async () => {
    const store = createEditorStore()

    // Pre-populate some state
    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ bib: 'some bib', keys: ['key1'] }),
    } as Response)
    await store.getState().fetchBib('proj-1')
    expect(store.getState().bibContent).toBe('some bib')

    // Now fail
    mockApiFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as Response)
    await store.getState().fetchBib('proj-1')

    expect(store.getState().bibContent).toBe('')
    expect(store.getState().bibKeys).toEqual([])
  })

  it('fetchBib clears state on network error', async () => {
    const store = createEditorStore()

    mockApiFetch.mockRejectedValueOnce(new Error('Network error'))
    await store.getState().fetchBib('proj-1')

    expect(store.getState().bibContent).toBe('')
    expect(store.getState().bibKeys).toEqual([])
  })

  it('updateBib updates local state immediately', async () => {
    const store = createEditorStore()

    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ keys: ['NewKey2024'] }),
    } as Response)

    const newBib = '@inproceedings{NewKey2024, title={New Paper}}'
    // Don't await — we just want to check the synchronous local update
    const promise = store.getState().updateBib('proj-1', newBib)

    // bibContent should be set immediately (optimistic update)
    expect(store.getState().bibContent).toBe(newBib)

    await promise

    // After the API responds, keys should be updated
    expect(store.getState().bibKeys).toEqual(['NewKey2024'])
  })

  it('updateBib calls the API with correct payload', async () => {
    const store = createEditorStore()

    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ keys: [] }),
    } as Response)

    await store.getState().updateBib('proj-2', '@misc{Test, title={T}}')

    expect(mockApiFetch).toHaveBeenCalledWith('/api/workspaces/proj-2/bib', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bib: '@misc{Test, title={T}}' }),
    })
  })

  it('adds and deletes structured BibEntry', async () => {
    const store = createEditorStore()
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ keys: ['einstein1905'] }),
    } as Response)

    await store.getState().addBibEntry({
      key: 'einstein1905',
      type: 'article',
      title: 'Zur Elektrodynamik bewegter Körper',
      authorString: 'Einstein, Albert',
      year: '1905',
    })

    expect(store.getState().bibContent).toContain('@article{einstein1905,')
    expect(store.getState().bibEntries).toHaveLength(1)
    expect(store.getState().bibEntries[0].key).toBe('einstein1905')

    await store.getState().deleteBibEntry('einstein1905')
    expect(store.getState().bibContent).toBe('')
    expect(store.getState().bibEntries).toHaveLength(0)
  })

  it('manages isBibManagerOpen modal state', () => {
    const store = createEditorStore()
    expect(store.getState().isBibManagerOpen).toBe(false)
    store.getState().setIsBibManagerOpen(true)
    expect(store.getState().isBibManagerOpen).toBe(true)
  })
})
