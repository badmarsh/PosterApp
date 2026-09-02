import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const htmlPath = path.resolve(__dirname, 'brochure_pdf.html');
const pdfPath = path.resolve(__dirname, 'PosterApp_Brochure.pdf');

const htmlUrl = `file://${htmlPath.replace(/\\/g, '/')}`;

const possiblePaths = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

let executablePath = null;
for (const p of possiblePaths) {
  try {
    fs.accessSync(p);
    executablePath = p;
    console.log(`Found browser: ${p}`);
    break;
  } catch {
    // not found
  }
}

if (!executablePath) {
  console.error('No Chrome/Edge found on system');
  process.exit(1);
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.goto(htmlUrl, { waitUntil: 'networkidle0', timeout: 30000 });

  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: '20mm', bottom: '25mm', left: '18mm', right: '18mm' }
  });

  await browser.close();

  console.log(`PDF generated: ${pdfPath}`);
  const stats = fs.statSync(pdfPath);
  console.log(`Size: ${(stats.size / 1024).toFixed(1)} KB`);
})();
