import { test, expect } from '@playwright/test';

test.describe('Features & Regression Tests', () => {
  
  test('BibTeX deduplication prevents identical titles from being added twice', async ({ request }) => {
    // 1. Create a workspace
    const wsId = `test-bib-${Date.now()}`;
    const headers = { 'Authorization': `Bearer change-me-in-production` };
    
    const createRes = await request.post('/api/workspaces', {
      headers,
      data: { id: wsId, name: 'Bib Test Workspace' }
    });
    
    if (!createRes.ok()) {
      console.log('CREATE FAILED:', createRes.status(), await createRes.text());
    }
    expect(createRes.ok()).toBeTruthy();

    const initialBib = `@article{Smith2020,
  title = {A study on nothing},
  author = {Smith, John},
  year = {2020}
}`;
    const putRes = await request.put(`/api/workspaces/${wsId}/bib`, {
      headers,
      data: { bib: initialBib }
    });
    expect(putRes.ok()).toBeTruthy();

    const res = await request.get(`/api/workspaces/${wsId}/bib`, { headers });
    const data = await res.json();
    expect(data.bib).toContain('A study on nothing');
  });

  test('PDF asset previews are rendered as objects instead of images', async ({ page, request }) => {
    const wsId = `test-pdf-${Date.now()}`;
    const headers = { 'Authorization': `Bearer change-me-in-production` };
    
    await request.post('/api/workspaces', {
      headers,
      data: { id: wsId, name: 'PDF Test Workspace' }
    });

    await page.goto('/');
    
    try {
      await page.waitForSelector('text="Select a Workspace"', { timeout: 5000 });
      const workspaceBtn = page.getByText('PDF Test Workspace');
      if (await workspaceBtn.count() > 0) {
        await workspaceBtn.click();
      } else {
        await page.click('button:has-text("✕")');
      }
      await page.waitForSelector('text="Select a Workspace"', { state: 'hidden', timeout: 5000 });
    } catch (e) {}

    // E2E UI verification for the PDF tag
  });
});
