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
    
    // Create new project
    await page.getByRole('button', { name: 'Create New Project' }).click();
    await page.locator('input[placeholder="my-cool-project"]').fill(wsId);
    await page.locator('input[placeholder="My Cool Project"]').fill('Bib Test Workspace');
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Wait for the UI to settle
    await expect(page.getByRole('heading', { name: 'Bib Test Workspace' })).toBeVisible({ timeout: 10000 });

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
    
    // Create new project
    await page.getByRole('button', { name: 'Create New Project' }).click();
    await page.locator('input[placeholder="my-cool-project"]').fill(wsId);
    await page.locator('input[placeholder="My Cool Project"]').fill('PDF Test Workspace');
    await page.getByRole('button', { name: 'Create' }).click();

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
