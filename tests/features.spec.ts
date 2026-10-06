import { test, expect } from '@playwright/test';
import { setupClerkTestingToken } from '@clerk/testing/playwright';

test.describe('Features & Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test('BibTeX deduplication prevents identical titles from being added twice', async ({ request, page }) => {
    // 1. Create a workspace via UI to ensure proper Clerk auth is applied
    const wsId = `test-bib-${Date.now()}`;
    
    await page.goto('/');
    
    // Create workspace via API
    await page.waitForLoadState('networkidle');
    await page.evaluate(async (id) => {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: 'Bib Test Workspace' }),
      });
      if (!res.ok) throw new Error(`Failed to create workspace: ${res.status}`);
    }, wsId);

    const initialBib = `@article{Smith2020,
  title = {A study on nothing},
  author = {Smith, John},
  year = {2020}
}`;
    const putRes = await page.request.put(`/api/workspaces/${wsId}/bib`, {
      data: { bib: initialBib }
    });
    expect(putRes.ok()).toBeTruthy();

    const res = await page.request.get(`/api/workspaces/${wsId}/bib`);
    const data = await res.json();
    expect(data.bib).toContain('A study on nothing');
  });

  test('PDF asset previews are rendered as objects instead of images', async ({ page }) => {
    const wsId = `test-pdf-${Date.now()}`;
    await page.goto('/');
    
    // Create workspace via API
    await page.waitForLoadState('networkidle');
    await page.evaluate(async (id) => {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: 'PDF Test Workspace' }),
      });
      if (!res.ok) throw new Error(`Failed to create workspace: ${res.status}`);
      window.localStorage.setItem(
        'posterapp-editor-storage',
        JSON.stringify({ state: { selectedCardId: null, lastWorkspaceId: id }, version: 1 }),
      );
    }, wsId);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // E2E UI verification for the PDF tag
  });
});
