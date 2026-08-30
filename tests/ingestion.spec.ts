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
  const mineruAvailable = await fetch('http://localhost:8001/openapi.json').then(() => true).catch(() => false);
  test.skip(!mineruAvailable, 'MinerU parsing service is not running on port 8001');
  test.setTimeout(240000); // 4 minutes timeout for full GPU VLM pipeline

  // Auto-accept any confirm() dialogues (like removing a file)
  page.on('dialog', dialog => dialog.accept());
  
  // Navigate to the app
  const wsId = `test-ingest-${Date.now()}`;
  await page.goto('/');

  // Create new project
  await page.getByRole('button', { name: 'Create New Project' }).click();
  await page.locator('input[placeholder="my-cool-project"]').fill(wsId);
  await page.locator('input[placeholder="My Cool Project"]').fill('Test Ingest Workspace');
  await page.getByRole('button', { name: 'Create' }).click();

  // Wait for it to switch to this project
  await expect(page.getByRole('heading', { name: 'Test Ingest Workspace', exact: true })).toBeVisible({ timeout: 10000 });

  // Open the ingestion drawer
  await page.click('button[aria-label="Ingest source PDFs"]');
  
  // Clear existing files to prevent conflicts
  const removeButtons = page.locator('button[aria-label^="Remove "]');
  while (await removeButtons.count() > 0) {
    await removeButtons.first().click();
    await page.waitForTimeout(500);
  }

  // Upload the PDF
  await page.setInputFiles('aside[role="dialog"] input[type="file"]', filePath);
  
  // Verify the file was added
  await expect(page.locator('text=PO_152.pdf')).toBeVisible({ timeout: 10000 });
  
  // Wait for parsing to finish (Done badge appears)
  await expect(page.getByText('Done')).toBeVisible({ timeout: 210000 });
  
  // Verify that some assets were extracted
  await expect(page.getByText(/[1-9]\d* items/)).toBeVisible({ timeout: 10000 });
});
