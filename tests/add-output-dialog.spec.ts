import { test, expect } from '@playwright/test';
import { setupClerkTestingToken } from '@clerk/testing/playwright';

test.beforeEach(async ({ page }) => {
  await setupClerkTestingToken({ page });
});

test('AddOutputDialog resets state when reopened', async ({ page }) => {
  const wsId = 'test-workspace-' + Date.now();
  await page.goto('/'); // navigate to root to get the auth cookie ready
  await page.waitForLoadState('networkidle'); // let Clerk initialize
  const realWsId = await page.evaluate(async (id) => {
    const res = await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: 'Test Workspace' })
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to create workspace: ${res.status} ${text}`);
    }
    const data = await res.json();
    
    // Set the selected workspace in localStorage so the app loads it
    window.localStorage.setItem('posterapp-editor-storage', JSON.stringify({
      state: { lastWorkspaceId: data.id, selectedCardId: null },
      version: 1
    }));
  }, wsId);
  
  // Reload the app to pick up the local storage state
  await page.goto('/');
  
  // 1. Open dialog and change type
  await page.click('button[aria-label="Add output"]');
  await expect(page.locator('[role="dialog"]')).toBeVisible();
  
  await page.click('button:has-text("Paper")'); // Select paper
  await expect(page.locator('button.bg-primary\\/10:has-text("Paper")')).toBeVisible();
  
  // 2. Close by pressing Escape
  await page.keyboard.press('Escape');
  await expect(page.locator('[role="dialog"]')).toBeHidden();
  
  // 3. Re-open and verify it reset to 'Slides' (the default)
  await page.click('button[aria-label="Add output"]');
  await expect(page.locator('button.bg-primary\\/10:has-text("Slides")')).toBeVisible();
  await expect(page.locator('button.bg-primary\\/10:has-text("Paper")')).toBeHidden();
});
