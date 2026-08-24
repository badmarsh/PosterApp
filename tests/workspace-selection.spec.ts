import { test, expect } from '@playwright/test';
import { setupClerkTestingToken } from '@clerk/testing/playwright';

test.beforeEach(async ({ page }) => {
  await setupClerkTestingToken({ page });
});

test('workspace selection modal appears and functions', async ({ page }) => {
  // Navigate to the app
  await page.goto('http://localhost:3333/');
  
  const modalVisible = await page.getByText('Select a Workspace').isVisible({ timeout: 5000 }).catch(() => false);
  if (!modalVisible) {
    // Open the workspace selector dropdown
    const projBtn = page.locator('header').locator('button[data-slot="dropdown-menu-trigger"]').first();
    await projBtn.click();
    
    // Click 'View all workspaces...'
    const viewAllBtn = page.getByText('View all workspaces...');
    if (await viewAllBtn.isVisible()) {
      await viewAllBtn.click();
    }
  }
  
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
