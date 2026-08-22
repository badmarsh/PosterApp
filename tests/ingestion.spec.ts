import { test, expect } from '@playwright/test';
import { setupClerkTestingToken } from '@clerk/testing/playwright';
import fs from 'fs';

const filePath = process.env.E2E_TEST_PDF || 'C:\\Users\\marek\\Documents\\Robco PhD\\poster4\\Sources\\PO_152.pdf';

test.beforeAll(() => {
  if (!fs.existsSync(filePath)) {
    console.warn(`Skipping ingestion test: File ${filePath} not found.`);
  }
});

test.beforeEach(async ({ page }) => {
  await setupClerkTestingToken({ page });
});

test('workspace selector loads and shows workspaces', async ({ page }) => {
  await page.goto('/');
  
  // Wait for the UI to settle (either shell or selector modal)
  await page.waitForLoadState('networkidle');
  
  // We should either see the selector title or the top bar showing project name
  const selectorVisible = await page.isVisible('text="Select a Workspace"');
  const topBarVisible = await page.isVisible('header');
  
  expect(selectorVisible || topBarVisible).toBeTruthy();
});

test('ingestion of PDF via UI', async ({ page }) => {
  test.skip(!fs.existsSync(filePath), 'Test PDF not found');
  test.setTimeout(180000); // 3 minutes timeout

  // Auto-accept any confirm() dialogues (like removing a file)
  page.on('dialog', dialog => dialog.accept());
  
  // Navigate to the app
  await page.goto('/');

  // Create new project
  await page.getByRole('button', { name: 'Create New Project' }).click();
  await page.locator('input[placeholder="my-cool-project"]').fill('test-workspace');
  await page.locator('input[placeholder="My Cool Project"]').fill('Test Workspace');
  await page.getByRole('button', { name: 'Create' }).click();

  // Wait for it to switch to this project
  await expect(page.getByText('Test Workspace')).toBeVisible({ timeout: 10000 });

  // Handle the new Workspace Selection modal properly
  try {
    await page.waitForSelector('text="Select a Workspace"', { timeout: 5000 });
    const firstWorkspace = page.locator('button.hover\\:bg-accent').first();
    if (await firstWorkspace.count() > 0) {
      await firstWorkspace.click();
    } else {
      await page.click('button:has-text("✕")');
    }
    await page.waitForSelector('text="Select a Workspace"', { state: 'hidden', timeout: 5000 });
  } catch (e) {
    // If the modal never appeared or timed out, just continue
  }

  // Open the ingestion drawer
  await page.click('button[aria-label="Ingest source PDFs"]');
  
  // Clear existing files to prevent conflicts
  const removeButtons = page.locator('button[aria-label^="Remove "]');
  while (await removeButtons.count() > 0) {
    await removeButtons.first().click();
    await page.waitForTimeout(500);
  }

  // Upload the PDF
  await page.setInputFiles('input[type="file"]', filePath);
  
  // Verify the file was added
  await expect(page.locator('text=PO_152.pdf')).toBeVisible({ timeout: 10000 });
  
  // Wait for parsing to finish (Done badge appears)
  await expect(page.getByText('Done')).toBeVisible({ timeout: 150000 });
  
  // Verify that some assets were extracted
  await expect(page.getByText(/[1-9]\d* items/)).toBeVisible({ timeout: 10000 });
});
