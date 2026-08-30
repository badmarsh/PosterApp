import { describe, it, expect } from 'vitest'
import { createEditorStore } from '@/components/editor-store'

describe('ui-slice', () => {
  it('pushes an agent event and returns its id', () => {
    const store = createEditorStore()

    const id = store.getState().pushEvent({
      kind: 'info',
      status: 'done',
      title: 'Test event',
      detail: 'Test detail',
    })

    expect(typeof id).toBe('string')
    const events = store.getState().agentEvents
    const pushed = events.find((e) => e.id === id)
    expect(pushed).toBeDefined()
    expect(pushed!.title).toBe('Test event')
  })

  it('updates an existing agent event', () => {
    const store = createEditorStore()

    const id = store.getState().pushEvent({
      kind: 'info',
      status: 'running',
      title: 'Running task',
    })

    store.getState().updateEvent(id, {
      status: 'done',
      title: 'Task complete',
      detail: 'Finished successfully',
    })

    const ev = store.getState().agentEvents.find((e) => e.id === id)
    expect(ev!.status).toBe('done')
    expect(ev!.title).toBe('Task complete')
    expect(ev!.detail).toBe('Finished successfully')
  })

  it('sets and reads inspector tab', () => {
    const store = createEditorStore()

    expect(store.getState().inspectorTab).toBe('basics')

    store.getState().setInspectorTab('figures')
    expect(store.getState().inspectorTab).toBe('figures')

    store.getState().setInspectorTab('content')
    expect(store.getState().inspectorTab).toBe('content')
  })

  it('toggles autoCompile', () => {
    const store = createEditorStore()
    expect(store.getState().autoCompile).toBe(false)

    store.getState().setAutoCompile(true)
    expect(store.getState().autoCompile).toBe(true)

    store.getState().setAutoCompile(false)
    expect(store.getState().autoCompile).toBe(false)
  })

  it('sets and clears pendingAiPrompt', () => {
    const store = createEditorStore()
    expect(store.getState().pendingAiPrompt).toBeNull()

    store.getState().setPendingAiPrompt('Generate a summary')
    expect(store.getState().pendingAiPrompt).toBe('Generate a summary')

    store.getState().setPendingAiPrompt(null)
    expect(store.getState().pendingAiPrompt).toBeNull()
  })

  it('sets lastCompileFormat', () => {
    const store = createEditorStore()
    expect(store.getState().lastCompileFormat).toBe('poster')

    store.getState().setLastCompileFormat('paper')
    expect(store.getState().lastCompileFormat).toBe('paper')
  })

  it('initializes with default agent events', () => {
    const store = createEditorStore()
    const events = store.getState().agentEvents
    expect(events.length).toBeGreaterThanOrEqual(1)
    expect(events[0].title).toBe('Editor ready')
  })

  it('manages scanner open state and scanner image', () => {
    const store = createEditorStore()
    expect(store.getState().isScannerOpen).toBe(false)
    expect(store.getState().scannerImage).toBeNull()

    store.getState().setIsScannerOpen(true)
    expect(store.getState().isScannerOpen).toBe(true)

    store.getState().openScannerWithImage('data:image/png;base64,testdata')
    expect(store.getState().isScannerOpen).toBe(true)
    expect(store.getState().scannerImage).toBe('data:image/png;base64,testdata')

    store.getState().setScannerImage(null)
    expect(store.getState().scannerImage).toBeNull()
  })
})
