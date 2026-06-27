import { test, expect } from '@playwright/test';

test('ingestion of PDF via UI', async ({ page }) => {
  test.setTimeout(180000); // 3 minutes timeout

  const filePath = 'C:\\Users\\marek\\Documents\\Robco PhD\\poster4\\Sources\\PO_152.pdf';
  
  // Navigate to the app
  await page.goto('http://localhost:3333/');
  
  // Open the ingestion drawer
  await page.click('button[aria-label="Ingest source PDFs"]');
  
  // Upload the PDF
  await page.setInputFiles('input[type="file"]', filePath);
  
  // Verify the file was added
  await expect(page.locator(`text=PO_152.pdf`)).toBeVisible({ timeout: 10000 });
  
  // Wait for parsing to finish (Done badge appears)
  await expect(page.locator('text=Done')).toBeVisible({ timeout: 150000 });
  
  // Verify that some assets were extracted (the text should match something like "1 assets", "2 assets", etc.)
  await expect(page.getByText(/[1-9]\d* assets/)).toBeVisible({ timeout: 10000 });
});
