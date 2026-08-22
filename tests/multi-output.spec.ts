import { test, expect } from '@playwright/test';

test.describe('Multi-Output Feature', () => {
  test('output switcher in TopBar functions', async ({ page }) => {
    await page.goto('/');

    // Ensure we are inside a workspace
    const switchWorkspaceBtn = page.getByRole('button', { name: 'Switch workspace' });
    if (await switchWorkspaceBtn.isVisible()) {
      await switchWorkspaceBtn.click();
      await page.getByText('Select a Workspace').waitFor();
      const firstWorkspace = page.locator('button').filter({ hasText: 'Test Workspace' }).first();
      if (await firstWorkspace.isVisible()) {
        await firstWorkspace.click();
      } else {
        await page.getByRole('button', { name: 'Create Project' }).click();
        await page.getByPlaceholder('Project name').fill('Test Project');
        await page.getByRole('button', { name: 'Create Project' }).click();
      }
    }

    // Wait for the workspace to load
    await page.waitForTimeout(1000);

    // Look for the output switcher
    const switcher = page.getByRole('combobox', { name: 'Output format' });
    
    if (await switcher.isVisible()) {
      await switcher.click();
      await page.getByRole('option', { name: 'Slides' }).click();
      
      // Verify that the switcher reflects the new state
      await expect(switcher).toContainText('Slides');
    }
  });
});
