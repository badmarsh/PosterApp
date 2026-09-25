# Firecrawl Landing Page Clone

A static, dependency-free recreation of the [firecrawl.dev](https://www.firecrawl.dev/) landing
page, built as a study/educational project. **Not affiliated with Firecrawl.**

## What's inside

- `index.html` — the entire page (HTML + CSS + vanilla JS, no build step, no external JS libs).
  Google Fonts (Inter / JetBrains Mono) are loaded with graceful system fallbacks.

## Recreated sections

1. Announcement banner + sticky blur nav
2. Hero with auto-cycling API demo (Setup for agents / Search / Scrape / Map / Crawl,
   with Python / Node.js / cURL request tabs and animated responses)
3. Trusted-by logo marquee
4. `01` Developer-first capabilities (Search / Scrape / Interact) with live code panel
5. `02` Agent-ready section (Prompt / MCP / CLI tabs + SKILL.md card)
6. `03` Performance bento: benchmark bars, latency table, token savings, GitHub card
7. `04` Zero-config features (media parsing, smart wait, actions, …)
8. `05` Use-case grid + animated "deep research" terminal
9. Alexandria stats section with animated counters
10. `06` Testimonial marquees (fictional quotes)
11. CTA block
12. `07` Categorized FAQ accordion
13. Footer with link columns, socials, and giant outlined wordmark

## Run it

```bash
python3 -m http.server 4173 --directory firecrawl-clone
# → http://localhost:4173
```

Or just open `index.html` directly in a browser.

## Notes

- All copy, testimonials, code samples, and links were rewritten for this recreation;
  company logos are rendered as styled text placeholders rather than brand assets.
- Design intent (dark theme, orange accent, mono kickers, bento layouts) mirrors the
  original's look and feel.
