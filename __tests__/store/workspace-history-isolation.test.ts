import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createEditorStore } from '@/components/editor-store'
import { getWorkspaceLocalHistory, setWorkspaceLocalHistory, clearWorkspaceLocalHistory } from '@/lib/workspace-history'

describe('Workspace Operation History & Clear History', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearWorkspaceLocalHistory('demo-default')
    clearWorkspaceLocalHistory('vla-autonomous-surgery')
    clearWorkspaceLocalHistory('jwst-gravitational-lensing')
  })

  it('clearHistory() resets agentEvents, chatMessages, and increments historyVersion', async () => {
    const store = createEditorStore()

    // Add some events and chat messages
    store.getState().pushEvent({
      kind: 'info',
      status: 'done',
      title: 'Action 1',
      detail: 'Detail 1',
    })
    store.getState().setChatMessages([
      { id: 'm1', role: 'user', content: [{ type: 'text', text: 'Hello' }] } as any,
    ])

    expect(store.getState().agentEvents.length).toBeGreaterThan(1)
    expect(store.getState().chatMessages.length).toBe(1)
    const initialVersion = store.getState().historyVersion || 0

    // Trigger clearHistory
    await store.getState().clearHistory()

    expect(store.getState().chatMessages).toEqual([])
    expect(store.getState().agentEvents.length).toBe(1)
    expect(store.getState().agentEvents[0].title).toBe('History cleared')
    expect(store.getState().historyVersion).toBe(initialVersion + 1)
  })

  it('hydrateUi([], []) clears agentEvents instead of retaining old events', () => {
    const store = createEditorStore()

    store.getState().pushEvent({
      kind: 'info',
      status: 'done',
      title: 'Old Event',
    })
    expect(store.getState().agentEvents.some((e) => e.title === 'Old Event')).toBe(true)

    store.getState().hydrateUi([], [])
    expect(store.getState().agentEvents).toEqual([])
    expect(store.getState().chatMessages).toEqual([])
  })

  it('isolates operation history between different workspaces', async () => {
    const store = createEditorStore()

    // Workspace A (default demo): add unique event
    store.getState().pushEvent({
      kind: 'info',
      status: 'done',
      title: 'Workspace A Event',
    })
    store.getState().setChatMessages([
      { id: 'm-a', role: 'user', content: [{ type: 'text', text: 'Prompt in A' }] } as any,
    ])

    // Switch to Showcase 1 (vla-autonomous-surgery)
    await store.getState().switchProject('vla-autonomous-surgery')

    // Showcase should NOT contain Workspace A events
    const showcaseEvents = store.getState().agentEvents
    expect(showcaseEvents.some((e) => e.title === 'Workspace A Event')).toBe(false)
    expect(store.getState().chatMessages).toEqual([])
    expect(showcaseEvents[0].title).toBe('Showcase loaded')

    // Now push event to Showcase 1
    store.getState().pushEvent({
      kind: 'info',
      status: 'done',
      title: 'VLA Action',
    })

    // Switch to Showcase 2 (jwst-gravitational-lensing)
    await store.getState().switchProject('jwst-gravitational-lensing')

    // Showcase 2 should NOT contain Showcase 1 action
    expect(store.getState().agentEvents.some((e) => e.title === 'VLA Action')).toBe(false)
    expect(store.getState().agentEvents.some((e) => e.title === 'Workspace A Event')).toBe(false)
    expect(store.getState().agentEvents[0].title).toBe('Showcase loaded')

    // Switch back to Showcase 1 (vla-autonomous-surgery) — its history should be restored
    await store.getState().switchProject('vla-autonomous-surgery')
    expect(store.getState().agentEvents.some((e) => e.title === 'VLA Action')).toBe(true)
  })

  it('manages workspace local storage history functions correctly', () => {
    const mockEvents: any[] = [{ id: '1', title: 'Ev 1' }]
    const mockMsgs: any[] = [{ id: 'm1', text: 'Hi' }]

    setWorkspaceLocalHistory('ws-test', mockEvents, mockMsgs)
    const loaded = getWorkspaceLocalHistory('ws-test')
    expect(loaded?.agentEvents).toEqual(mockEvents)
    expect(loaded?.chatMessages).toEqual(mockMsgs)

    clearWorkspaceLocalHistory('ws-test')
    expect(getWorkspaceLocalHistory('ws-test')).toBeNull()
  })
})