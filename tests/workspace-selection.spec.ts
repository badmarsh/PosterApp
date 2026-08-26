import { test, expect } from '@playwright/test';
import { setupClerkTestingToken } from '@clerk/testing/playwright';

test.beforeEach(async ({ page }) => {
  await setupClerkTestingToken({ page });
});

test('workspace selection modal appears and functions', async ({ page }) => {
  // Create a dummy workspace so we don't get the forced selection modal on load
  const wsId = 'test-workspace-sel-' + Date.now();
  await page.goto('/'); // navigate to root to get the auth cookie ready
  await page.waitForLoadState('networkidle'); // let Clerk initialize
  const realWsId = await page.evaluate(async (id) => {
    const res = await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: 'Selection Test' })
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to create workspace: ${res.status} ${text}`);
    }
    const data = await res.json();
    
    // Set the selected workspace in localStorage so the app loads it
    window.localStorage.setItem('posterapp-editor-storage', JSON.stringify({
      state: { selectedCardId: null, lastWorkspaceId: data.id },
      version: 1
    }));
  }, wsId);
  
  // Reload the app to pick up the local storage state
  await page.goto('/');
  
  // Wait for topbar
  await expect(page.locator('header')).toBeVisible();

  // Open the workspace selector dropdown
  const projBtn = page.locator('header').locator('button[data-slot="dropdown-menu-trigger"]').first();
  await projBtn.click();
    
    // Click 'View all workspaces...'
    const viewAllBtn = page.getByText('View all workspaces...');
    await viewAllBtn.click();
  
  // Verify the Workspace Selector modal is visible
  await expect(page.getByText('Select a Workspace')).toBeVisible({ timeout: 10000 });
  
  // Verify the Create New Project button exists
  await expect(page.getByRole('button', { name: 'Create New Project' })).toBeVisible();
  
  // If there are existing workspaces, click the first one or close
  const workspaceButtons = page.locator('button.hover\\:bg-accent');
  const count = await workspaceButtons.count();
  if (count > 0) {
    await workspaceButtons.first().click();
    await expect(page.getByText('Select a Workspace')).not.toBeVisible();
  } else {
    const closeBtn = page.getByRole('button', { name: '✕' });
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await expect(page.getByText('Select a Workspace')).not.toBeVisible();
    }
  }
});
