const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("Navigating to http://localhost:3333...");
  await page.goto('http://localhost:3333');

  console.log("Waiting for app to load...");
  await page.waitForSelector('button[aria-label="Ingest source PDFs"]', { timeout: 10000 });

  console.log("Opening ingestion drawer...");
  await page.click('button[aria-label="Ingest source PDFs"]');

  console.log("Waiting for drawer to open...");
  await page.waitForTimeout(1000);

  // Find the file input in the Dropzone
  const fileInput = await page.$('input[type="file"]');
  if (fileInput) {
    console.log("Uploading file...");
    await fileInput.setInputFiles('C:\\Users\\marek\\Documents\\Robco PhD\\poster4\\Sources\\PO_152.pdf');
  } else {
    console.error("File input not found");
  }

  console.log("Waiting for upload/processing...");
  // Check if it appears in the ingestion list
  try {
    // Look for Done indicator or the filename
    await page.waitForSelector('text=Done', { timeout: 60000 });
    console.log("File ingestion completed successfully!");
    console.log("TEST PASSED");
  } catch (e) {
    console.error("Ingestion did not complete in time or failed", e.message);
    console.log("TEST FAILED");
  }

  await browser.close();
})();
