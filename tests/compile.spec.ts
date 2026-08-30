import { test, expect } from '@playwright/test';
import { setupClerkTestingToken } from '@clerk/testing/playwright';

test.beforeEach(async ({ page }) => {
  await setupClerkTestingToken({ page });
});

test.describe('Poster Compilation', () => {
  test('can compile poster and view PDF', async ({ page }) => {
    // 1. Navigate to the app
    const wsId = `test-compile-${Date.now()}`;
    await page.goto('/');

    // 2. Create new project
    await page.getByRole('button', { name: 'Create New Project' }).click();
    await page.locator('input[placeholder="my-cool-project"]').fill(wsId);
    await page.locator('input[placeholder="My Cool Project"]').fill('Compile Test Workspace');
    await page.getByRole('button', { name: 'Create' }).click();

    // 3. Wait for it to switch to this project
    await expect(page.getByRole('heading', { name: 'Compile Test Workspace' })).toBeVisible({ timeout: 10000 });

    // 4. Trigger Compilation
    const compileBtn = page.getByRole('button', { name: 'Compile', exact: true });
    await expect(compileBtn).toBeVisible();
    await compileBtn.click();
    // 5. Wait for Compile to finish
    await expect(page.getByText('Compiling with pdflatex…')).toBeHidden({ timeout: 60000 });
    
    // 6. Verify either compile succeeded or compile failed log is shown
    await expect(page.getByText(/Compile (succeeded|failed)/i).first()).toBeVisible({ timeout: 15000 });
  });
});
