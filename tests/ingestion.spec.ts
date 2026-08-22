import { test, expect } from '@playwright/test';

test('ingestion of PDF via UI', async ({ page }) => {
  test.setTimeout(180000); // 3 minutes timeout

  // Auto-accept any confirm() dialogues (like removing a file)
  page.on('dialog', dialog => dialog.accept());

  const filePath = 'C:\\Users\\marek\\Documents\\Robco PhD\\poster4\\Sources\\PO_152.pdf';
  
  // Create a test workspace via API
  const apiContext = await page.context().request;
  await apiContext.post('http://localhost:3333/api/workspaces', {
    data: { id: 'test-workspace', name: 'Test Workspace' }
  });

  // Navigate to the app
  await page.goto('http://localhost:3333/');

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
