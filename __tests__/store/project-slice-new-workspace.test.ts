import { describe, it, expect } from 'vitest'
import { createEditorStore } from '@/components/editor-store'

describe('newProject and workspace selector modal store lifecycle', () => {
  it('newProject opens workspace selector directly in creation mode', () => {
    const store = createEditorStore()

    expect(store.getState().isWorkspaceSelectorOpen).toBe(false)
    expect(store.getState().workspaceSelectorCreating).toBe(false)

    store.getState().newProject()

    expect(store.getState().isWorkspaceSelectorOpen).toBe(true)
    expect(store.getState().workspaceSelectorCreating).toBe(true)
  })

  it('openWorkspaceSelector supports both list mode and create mode', () => {
    const store = createEditorStore()

    // Open in list mode
    store.getState().openWorkspaceSelector(false)
    expect(store.getState().isWorkspaceSelectorOpen).toBe(true)
    expect(store.getState().workspaceSelectorCreating).toBe(false)

    // Close
    store.getState().closeWorkspaceSelector()
    expect(store.getState().isWorkspaceSelectorOpen).toBe(false)
    expect(store.getState().workspaceSelectorCreating).toBe(false)

    // Open in create mode
    store.getState().openWorkspaceSelector(true)
    expect(store.getState().isWorkspaceSelectorOpen).toBe(true)
    expect(store.getState().workspaceSelectorCreating).toBe(true)
  })
})
