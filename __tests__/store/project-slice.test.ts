import { describe, it, expect } from 'vitest';
import { createEditorStore } from '@/components/editor-store';

describe('project-slice', () => {
  it('updates project title via updateProject', () => {
    const store = createEditorStore();
    
    store.getState().updateProject({ posterTitle: 'New Title' });
    expect(store.getState().project.posterTitle).toBe('New Title');
  });

  it('selects and clears card selection', () => {
    const store = createEditorStore();
    
    store.getState().selectCard('card-1');
    expect(store.getState().selectedCardId).toBe('card-1');
    
    store.getState().selectCard(null);
    expect(store.getState().selectedCardId).toBeNull();
  });
});
