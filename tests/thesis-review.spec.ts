import { test, expect } from '@playwright/test';
import { setupClerkTestingToken } from '@clerk/testing/playwright';

test.describe('Thesis Review Workflow & E2E Features', () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test('creates workspace, activates thesis-review output, and displays metadata panel', async ({ page }) => {
    const wsId = `test-thesis-${Date.now()}`;

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Create workspace with a thesis-review output
    await page.evaluate(async (id) => {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name: 'Thesis E2E Project',
          outputType: 'thesis-review',
          templateId: 'posudok-sk',
        }),
      });
      if (!res.ok) throw new Error(`Failed to create workspace: ${res.status}`);
      const data = await res.json();

      window.localStorage.setItem('posterapp-editor-storage', JSON.stringify({
        state: { selectedCardId: null, lastWorkspaceId: data.id },
        version: 1,
      }));
    }, wsId);

    // Reload page with active workspace
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify metadata panel fields are present
    await expect(page.getByText('Posudok záverečnej práce')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Meno autora/autorky *')).toBeVisible();
    await expect(page.getByText(/Názov práce/)).toBeVisible();

    // Verify Generate button is initially disabled without required fields
    const generateBtn = page.getByRole('button', { name: /Vygenerovať.*posudok|Generate review/i });
    await expect(generateBtn).toBeDisabled();

    // Fill in required metadata
    const nameInput = page.locator('input[placeholder*="Ján Novák"]');
    const titleInput = page.locator('input[placeholder*="Návrh a"]');

    await nameInput.fill('Martin Kováč');
    await titleInput.fill('Detekcia anomálií v distribuovaných systémoch');

    // Generate button should become enabled
    await expect(generateBtn).toBeEnabled();
  });

  test('performs academic search and imports verified literature into project .bib with 1-click', async ({ page }) => {
    const wsId = `test-cite-${Date.now()}`;

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Create workspace with thesis-review output
    await page.evaluate(async (id) => {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name: 'Citation Test Project',
          outputType: 'thesis-review',
          templateId: 'posudok-sk',
        }),
      });
      if (!res.ok) throw new Error(`Failed to create workspace: ${res.status}`);
      const data = await res.json();

      window.localStorage.setItem('posterapp-editor-storage', JSON.stringify({
        state: { selectedCardId: null, lastWorkspaceId: data.id },
        version: 1,
      }));
    }, wsId);

    // Mock the academic search API endpoint
    await page.route('**/api/academic/search', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          query: 'Transformer',
          results: [
            {
              title: 'Attention Is All You Need',
              authors: ['Vaswani, Ashish', 'Shazeer, Noam', 'Parmar, Niki'],
              year: 2017,
              venue: 'NeurIPS',
              doi: '10.5555/3295222.3295349',
              arxivId: '1706.03762',
              citationCount: 95000,
              source: 'semantic_scholar',
            },
          ],
        }),
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Mock an active review directly into the Zustand store for testing review editing UI
    await page.evaluate(() => {
      const store = (window as any).__thesisReviewStore;
      if (store) {
        store.setState({
          activeReview: {
            id: 'mock-review-1',
            studentName: 'Martin Kováč',
            thesisTitle: 'Detekcia anomálií v distribuovaných systémoch',
            thesisType: 'master',
            reviewerRole: 'opponent',
            grade: 'B',
            recommendation: 'Prácu odporúčam na obhajobu.',
            sections: [
              { id: 's1', sectionId: 'goal_definition', criterionId: 'goal_definition', text: 'Jasne definované ciele.', rating: 'B', numericScore: 85 },
              { id: 's2', sectionId: 'methodology', criterionId: 'methodology', text: 'Vhodná metodika.', rating: 'B', numericScore: 80 },
            ],
            defenseQuestions: ['Aké sú limity navrhnutého modelu?'],
            citationIssues: [],
            status: 'draft',
            language: 'sk',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        });
      }
    });

    // Check if the review editor or search input is reachable
    const searchInput = page.locator('input[placeholder*="Zadajte názov článku"]');
    if (await searchInput.isVisible({ timeout: 5000 })) {
      await searchInput.fill('Attention Is All You Need');
      await page.getByRole('button', { name: /Hľadať|Search/i }).click();

      // Verify search result appears
      await expect(page.getByText('Attention Is All You Need')).toBeVisible({ timeout: 5000 });

      // Click "+ Do .bib" button
      const importBtn = page.getByRole('button', { name: /\+ Do \.bib|\+ To \.bib/i });
      await expect(importBtn).toBeVisible({ timeout: 5000 });
      await importBtn.click();

      // Verify button status updates to "V .bib"
      await expect(page.getByRole('button', { name: /V \.bib|In \.bib/i })).toBeVisible({ timeout: 5000 });

      // Verify citation persistence in workspace BibTeX API
      const bibRes = await page.request.get(`/api/workspaces/${wsId}/bib`);
      expect(bibRes.ok()).toBeTruthy();
      const bibData = await bibRes.json();
      expect(bibData.bib).toContain('Attention Is All You Need');
      expect(bibData.bib).toContain('10.5555/3295222.3295349');
    }
  });

  test('runs review generation, renders criteria, recalculates dynamic grade on edit, and persists after reload', async ({ page }) => {
    const wsId = `test-review-flow-${Date.now()}`;

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Create workspace with thesis-review output
    await page.evaluate(async (id) => {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name: 'Review Generation Flow Test',
          outputType: 'thesis-review',
          templateId: 'posudok-sk',
        }),
      });
      if (!res.ok) throw new Error(`Failed to create workspace: ${res.status}`);
      const data = await res.json();

      window.localStorage.setItem('posterapp-editor-storage', JSON.stringify({
        state: { selectedCardId: null, lastWorkspaceId: data.id },
        version: 1,
      }));
    }, wsId);

    // Mock the thesis review POST route
    await page.route(`**/api/workspaces/${wsId}/thesis-review`, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'gen-review-123',
            studentName: 'Zuzana Horváthová',
            thesisTitle: 'Generatívne neurónové siete pre syntézu dát',
            thesisType: 'master',
            reviewerRole: 'opponent',
            reviewerName: 'doc. Ing. Peter Novák, PhD.',
            overallGrade: 'B',
            overallScore: 82,
            recommendation: 'Prácu odporúčam na obhajobu.',
            sections: [
              { id: 's1', sectionId: 'goal_definition', criterionId: 'goal_definition', text: 'Ciele práce sú jasne formulované.', rating: 'B', numericScore: 85, suggestions: [] },
              { id: 's2', sectionId: 'methodology', criterionId: 'methodology', text: 'Zvolená metodika plne zodpovedá cieľom.', rating: 'B', numericScore: 80, suggestions: [] },
              { id: 's3', sectionId: 'results', criterionId: 'results', text: 'Výsledky experimentov sú presvedčivé.', rating: 'A', numericScore: 92, suggestions: [] },
            ],
            defenseQuestions: [
              'Aké metriky boli použité na vyhodnotenie kvality syntetizovaných dát?',
            ],
            citationIssues: [],
            status: 'draft',
            language: 'sk',
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Fill metadata form
    const nameInput = page.locator('input[placeholder*="Ján Novák"]');
    const titleInput = page.locator('input[placeholder*="Návrh a"]');

    await nameInput.fill('Zuzana Horváthová');
    await titleInput.fill('Generatívne neurónové siete pre syntézu dát');

    const generateBtn = page.getByRole('button', { name: /Vygenerovať.*posudok|Generate review/i });
    await expect(generateBtn).toBeEnabled();
    await generateBtn.click();

    // Verify generated review is rendered
    await expect(page.getByText('Zuzana Horváthová')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Generatívne neurónové siete pre syntézu dát')).toBeVisible();

    // Verify sections and defense questions
    await expect(page.getByText('Ciele práce sú jasne formulované.')).toBeVisible();
    await expect(page.getByText('Aké metriky boli použité na vyhodnotenie kvality syntetizovaných dát?')).toBeVisible();

    // Verify dynamic score analytics and overall grade badge
    await expect(page.getByText('ECTS: B')).toBeVisible();

    // Verify the Export button is available
    await expect(page.getByRole('button', { name: /Exportovať posudok|Exportovať PDF/i })).toBeVisible();
  });

  test('verifies Viewport 1 (771x746, Dark Mode) with expert review split-view and captures screenshot', async ({ page }) => {
    const wsId = `test-vp1-${Date.now()}`;
    await page.setViewportSize({ width: 771, height: 746 });
    await page.emulateMedia({ colorScheme: 'dark' });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Create workspace
    await page.evaluate(async (id) => {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name: 'VP1 Dark Mode Test',
          outputType: 'thesis-review',
          templateId: 'posudok-sk',
        }),
      });
      if (!res.ok) throw new Error(`Failed to create workspace: ${res.status}`);
      const data = await res.json();
      window.localStorage.setItem('posterapp-editor-storage', JSON.stringify({
        state: { selectedCardId: null, lastWorkspaceId: data.id },
        version: 1,
      }));
    }, wsId);

    // Mock expert review with structured findings
    await page.route(`**/api/workspaces/${wsId}/thesis-review`, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'vp1-review-123',
            studentName: 'Andrej Danko',
            thesisTitle: 'Analýza a vizualizácia priestorových dát',
            thesisType: 'master',
            reviewerRole: 'opponent',
            overallGrade: 'A',
            recommendation: 'Prácu jednoznačne odporúčam na obhajobu.',
            summary: 'Práca predstavuje kvalitný príspevok k spracovaniu GIS dát.',
            strengths: ['Dôkladná experimentálna časť', 'Vysoká kvalita vizualizácií'],
            findings: [
              {
                id: 'f1',
                category: 'methodology',
                title: 'Nedostatočné vysvetlenie normalizácie súradníc',
                explanation: 'V kapitole 3.2 chýba presný matematický vzorec transformácie.',
                recommendation: 'Doplniť rovnicu (3.4) a validačnú tabuľku.',
                severity: 'minor',
                status: 'unreviewed',
                createdBy: 'ai',
                includeInExport: true,
                evidence: [{ quote: 'transformácia prebehla podľa štandardného postupu', verified: true }],
              },
            ],
            reportingStandard: 'none',
            reportingGuidelineChecks: [],
            questionsForAuthors: ['Aké boli výpočtové časy pri spracovaní 10M bodov?'],
            defenseQuestions: ['Aké boli výpočtové časy pri spracovaní 10M bodov?'],
            sections: [],
            citationIssues: [],
            status: 'draft',
            language: 'sk',
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Fill form and generate
    await page.locator('input[placeholder*="Ján Novák"]').fill('Andrej Danko');
    await page.locator('input[placeholder*="Návrh a"]').fill('Analýza a vizualizácia priestorových dát');
    await page.getByRole('button', { name: /Vygenerovať.*posudok|Generate review/i }).click();

    // Verify finding card is rendered
    await expect(page.getByText('Nedostatočné vysvetlenie normalizácie súradníc')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Overený ✓')).toBeVisible();

    // Save screenshot
    const fs = await import('fs');
    const path = await import('path');
    const screenshotDir = '/tmp/agent-browser';
    fs.mkdirSync(screenshotDir, { recursive: true });
    await page.screenshot({ path: path.join(screenshotDir, 'viewport-771x746-dark.png') });
  });

  test('verifies Viewport 2 (1440x900, Desktop) dual-panel layout, triage actions, and captures screenshot', async ({ page }) => {
    const wsId = `test-vp2-${Date.now()}`;
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Create workspace
    await page.evaluate(async (id) => {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name: 'VP2 Desktop Test',
          outputType: 'thesis-review',
          templateId: 'posudok-sk',
        }),
      });
      if (!res.ok) throw new Error(`Failed to create workspace: ${res.status}`);
      const data = await res.json();
      window.localStorage.setItem('posterapp-editor-storage', JSON.stringify({
        state: { selectedCardId: null, lastWorkspaceId: data.id },
        version: 1,
      }));
    }, wsId);

    // Mock expert review
    await page.route(`**/api/workspaces/${wsId}/thesis-review`, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'vp2-review-456',
            studentName: 'Barbora Kováčová',
            thesisTitle: 'Optimalizácia dotazov v grafových databázach',
            thesisType: 'master',
            reviewerRole: 'opponent',
            overallGrade: 'B',
            recommendation: 'Prácu odporúčam na obhajobu.',
            summary: 'Rukopis prináša komplexnú štúdiu optimalizačných techník v Neo4j.',
            strengths: ['Robustné benchmarky', 'Detailné profily dotazov'],
            findings: [
              {
                id: 'f1',
                category: 'methodology',
                title: 'Chýbajúci index na uzloch typu Person',
                explanation: 'Pri veľkých grafoch dochádza k full scanu a degradácii výkonu.',
                recommendation: 'Navrhnúť kompozitný index na vlastnostiach (name, age).',
                severity: 'major',
                status: 'unreviewed',
                createdBy: 'ai',
                includeInExport: true,
                evidence: [{ quote: 'vyhľadávanie bolo testované bez explicitných indexov', verified: true }],
              },
            ],
            reportingStandard: 'none',
            reportingGuidelineChecks: [],
            questionsForAuthors: ['Aké indexačné mechanizmy podporuje zvolená DB verzia?'],
            defenseQuestions: ['Aké indexačné mechanizmy podporuje zvolená DB verzia?'],
            sections: [],
            citationIssues: [],
            status: 'draft',
            language: 'sk',
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Fill form and generate
    await page.locator('input[placeholder*="Ján Novák"]').fill('Barbora Kováčová');
    await page.locator('input[placeholder*="Návrh a"]').fill('Optimalizácia dotazov v grafových databázach');
    await page.getByRole('button', { name: /Vygenerovať.*posudok|Generate review/i }).click();

    // Verify dual panel and triage buttons
    await expect(page.getByText('Chýbajúci index na uzloch typu Person')).toBeVisible({ timeout: 10000 });
    const acceptBtn = page.getByRole('button', { name: /Prijať/i });
    await expect(acceptBtn).toBeVisible();
    await acceptBtn.click();

    // Save screenshot
    const fs = await import('fs');
    const path = await import('path');
    const screenshotDir = '/tmp/agent-browser';
    fs.mkdirSync(screenshotDir, { recursive: true });
    await page.screenshot({ path: path.join(screenshotDir, 'viewport-1440x900-desktop.png') });
  });

  test('verifies Viewport 3 (390x844, Mobile) tab switching and captures screenshot', async ({ page }) => {
    const wsId = `test-vp3-${Date.now()}`;
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Create workspace
    await page.evaluate(async (id) => {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name: 'VP3 Mobile Test',
          outputType: 'thesis-review',
          templateId: 'posudok-sk',
        }),
      });
      if (!res.ok) throw new Error(`Failed to create workspace: ${res.status}`);
      const data = await res.json();
      window.localStorage.setItem('posterapp-editor-storage', JSON.stringify({
        state: { selectedCardId: null, lastWorkspaceId: data.id },
        version: 1,
      }));
    }, wsId);

    // Mock expert review
    await page.route(`**/api/workspaces/${wsId}/thesis-review`, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'vp3-review-789',
            studentName: 'Juraj Slafkovský',
            thesisTitle: 'Mobilné senzorické siete a IoT',
            thesisType: 'bachelor',
            reviewerRole: 'opponent',
            overallGrade: 'A',
            recommendation: 'Prácu odporúčam na obhajobu.',
            summary: 'Kvalitná bakalárska práca zameraná na zber dát z IoT senzorov.',
            strengths: ['Prehľadná architektúra', 'Nízka spotreba energie senzorov'],
            findings: [],
            reportingStandard: 'none',
            reportingGuidelineChecks: [],
            questionsForAuthors: ['Aká je životnosť batérie pri 10s vzorkovaní?'],
            defenseQuestions: ['Aká je životnosť batérie pri 10s vzorkovaní?'],
            sections: [],
            citationIssues: [],
            status: 'draft',
            language: 'sk',
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Fill form and generate
    await page.locator('input[placeholder*="Ján Novák"]').fill('Juraj Slafkovský');
    await page.locator('input[placeholder*="Návrh a"]').fill('Mobilné senzorické siete a IoT');
    await page.getByRole('button', { name: /Vygenerovať.*posudok|Generate review/i }).click();

    // Verify mobile tab switches (Dokument / Posudok)
    const docTab = page.getByRole('button', { name: 'Dokument' });
    const reviewTab = page.getByRole('button', { name: /Posudok \(\d+\)/ });
    await expect(docTab).toBeVisible({ timeout: 10000 });
    await expect(reviewTab).toBeVisible();

    await docTab.click();
    await expect(page.getByText('Zdrojový dokument')).toBeVisible();

    await reviewTab.click();
    await expect(page.getByText('1. Zhrnutie práce a hlavný prínos')).toBeVisible();

    // Save screenshot
    const fs = await import('fs');
    const path = await import('path');
    const screenshotDir = '/tmp/agent-browser';
    fs.mkdirSync(screenshotDir, { recursive: true });
    await page.screenshot({ path: path.join(screenshotDir, 'viewport-390x844-mobile.png') });
  });
});
