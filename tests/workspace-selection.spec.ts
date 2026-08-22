import { test, expect } from '@playwright/test';
import { setupClerkTestingToken } from '@clerk/testing/playwright';

test.beforeEach(async ({ page }) => {
  await setupClerkTestingToken({ page });
});

test('workspace selection modal appears and functions', async ({ page }) => {
  // Navigate to the app
  await page.goto('http://localhost:3333/');
  
  // Open the workspace selector
  await page.getByRole('button', { name: 'Switch workspace' }).click();
  
  // Verify the Workspace Selector modal is visible
  await expect(page.getByText('Select a Workspace')).toBeVisible({ timeout: 10000 });
  
  // Verify the Create New Project button exists
  await expect(page.getByRole('button', { name: 'Create New Project' })).toBeVisible();
  
  // If there are existing workspaces, one of them will be listed.
  // For the sake of the test, we'll try to find any workspace button that isn't the Create button.
  const workspaceButtons = page.locator('button.hover\\:bg-accent');
  
  const count = await workspaceButtons.count();
  if (count > 0) {
    // Click the first workspace
    await workspaceButtons.first().click();
    
    // Ensure the modal disappears
    await expect(page.getByText('Select a Workspace')).not.toBeVisible();
  }
});
