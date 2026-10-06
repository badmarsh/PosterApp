import { chromium } from 'playwright';

const CDP_PORT = 62932;
const CDP_WS_GUID = 'b58dda91-e0d0-470f-b512-a029fc8144c2';
const WS_ENDPOINT = `ws://127.0.0.1:${CDP_PORT}/devtools/browser/${CDP_WS_GUID}`;

async function main() {
  let browser;
  try {
    browser = await chromium.connectOverCDP(WS_ENDPOINT);
    const contexts = browser.contexts();
    let arenaPage = null;
    for (const c of contexts) {
      for (const p of c.pages()) {
        if (p.url().includes('arena.ai/agent')) {
          arenaPage = p;
          break;
        }
      }
      if (arenaPage) break;
    }

    if (!arenaPage) {
      console.error('Arena page not found');
      return;
    }

    console.log('Connected to:', arenaPage.url());

    // Click the repo button
    const repoBtn = arenaPage.locator('button:has-text("Select a repository"), button:has-text("PosterApp")').first();
    console.log('Repo button text:', await repoBtn.innerText());
    await repoBtn.click();
    await arenaPage.waitForTimeout(1000);

    // Look for options in dropdown / popover
    const options = await arenaPage.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('[role=option], [role=menuitem], [data-radix-collection-item], button'));
      return elements
        .map(el => ({ text: el.innerText.trim().replace(/\n+/g, ' '), role: el.getAttribute('role') }))
        .filter(x => x.text.toLowerCase().includes('posterapp') || x.text.toLowerCase().includes('badmarsh') || x.text.toLowerCase().includes('repo'));
    });
    console.log('Found options:', JSON.stringify(options, null, 2));

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    if (browser) await browser.close();
  }
}

main();
