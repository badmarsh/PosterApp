// Renders brochure_pdf.html → brochure_pdf.pdf using Playwright's headless Chromium.
// The HTML owns all layout via @page CSS rules (A4 size, margins, page numbers),
// so we pass printBackground + preferCSSPageSize and let the stylesheet drive the PDF.
//
// Usage:  node scripts/brochure-pdf.mjs
import { chromium } from "@playwright/test";
import { pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = process.cwd();
const HTML = path.join(ROOT, "brochure_pdf.html");
const OUT = path.join(ROOT, "brochure_pdf.pdf");

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(HTML).href, { waitUntil: "networkidle" });
// Let webfonts / final layout settle before snapshotting print layout.
await page.waitForTimeout(400);
await page.emulateMedia({ media: "print" });
await page.pdf({
  path: OUT,
  printBackground: true,
  preferCSSPageSize: true,
});
await browser.close();
console.log(`✓ Wrote ${path.relative(ROOT, OUT)} (${path.basename(OUT)})`);
