import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createEditorStore } from '@/components/editor-store'
import * as apiFetchModule from '@/lib/api-fetch'

describe('saveProject error handling and retry lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('handles in-memory demo project gracefully without API calls or retry loops', async () => {
    const store = createEditorStore()
    const apiSpy = vi.spyOn(apiFetchModule, 'apiFetch')

    // Initial project is demo_ws
    expect(store.getState().project.id).toBe('demo_ws')
    store.getState().updateProject({ posterTitle: 'Demo Edit' })
    expect(store.getState().isDirty).toBe(true)

    await store.getState().saveProject(true)

    expect(apiSpy).not.toHaveBeenCalled()
    expect(store.getState().isDirty).toBe(false)
    expect(store.getState().isSaving).toBe(false)
  })

  it('stops retry loop and alerts user on 401 Unauthorized', async () => {
    const store = createEditorStore()
    // Set a non-demo project id
    store.setState((s) => {
      s.project.id = 'workspace-123'
      s.isDirty = true
    })

    const apiSpy = vi.spyOn(apiFetchModule, 'apiFetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    )

    await store.getState().saveProject(false)

    expect(apiSpy).toHaveBeenCalledTimes(1)
    expect(store.getState().isDirty).toBe(true)
    expect(store.getState().isSaving).toBe(false)

    // Fast-forward 10 seconds — retry should NOT have fired
    vi.advanceTimersByTime(10_000)
    expect(apiSpy).toHaveBeenCalledTimes(1)
  })

  it('stops retry loop on 403 Forbidden (Read-only workspace)', async () => {
    const store = createEditorStore()
    store.setState((s) => {
      s.project.id = 'workspace-123'
      s.isDirty = true
    })

    const apiSpy = vi.spyOn(apiFetchModule, 'apiFetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
    )

    await store.getState().saveProject(false)

    expect(apiSpy).toHaveBeenCalledTimes(1)
    expect(store.getState().isDirty).toBe(true)

    vi.advanceTimersByTime(10_000)
    expect(apiSpy).toHaveBeenCalledTimes(1)
  })

  it('stops retry loop on 404 Not Found', async () => {
    const store = createEditorStore()
    store.setState((s) => {
      s.project.id = 'workspace-123'
      s.isDirty = true
    })

    const apiSpy = vi.spyOn(apiFetchModule, 'apiFetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
    )

    await store.getState().saveProject(false)

    expect(apiSpy).toHaveBeenCalledTimes(1)
    expect(store.getState().isDirty).toBe(true)

    vi.advanceTimersByTime(10_000)
    expect(apiSpy).toHaveBeenCalledTimes(1)
  })

  it('stops retry loop on 400 Validation Error', async () => {
    const store = createEditorStore()
    store.setState((s) => {
      s.project.id = 'workspace-123'
      s.isDirty = true
    })

    const apiSpy = vi.spyOn(apiFetchModule, 'apiFetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Validation failed' }), { status: 400 })
    )

    await store.getState().saveProject(false)

    expect(apiSpy).toHaveBeenCalledTimes(1)
    expect(store.getState().isDirty).toBe(true)

    vi.advanceTimersByTime(10_000)
    expect(apiSpy).toHaveBeenCalledTimes(1)
  })

  it('retries with backoff on network or 500 error, and stops upon success', async () => {
    const store = createEditorStore()
    store.setState((s) => {
      s.project.id = 'workspace-123'
      s.isDirty = true
    })

    let calls = 0
    const apiSpy = vi.spyOn(apiFetchModule, 'apiFetch').mockImplementation(async () => {
      calls++
      if (calls === 1) {
        return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 })
      }
      return new Response(JSON.stringify({ ok: true, revision: 2 }), { status: 200 })
    })

    await store.getState().saveProject(false)
    expect(calls).toBe(1)
    expect(store.getState().isDirty).toBe(true)

    // Advance by initial retry delay (3000ms)
    await vi.advanceTimersByTimeAsync(3_100)

    expect(calls).toBe(2)
    expect(store.getState().isDirty).toBe(false)
    expect(store.getState().project.revision).toBe(2)

    // Ensure no further retries
    await vi.advanceTimersByTimeAsync(10_000)
    expect(calls).toBe(2)
  })
})
