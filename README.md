# PosterApp

PosterApp is an intelligent, Next.js-based academic poster editor that assists researchers in writing, laying out, and generating beautiful LaTeX-based scientific posters from their source documents. 

## Features

- **Automated Ingestion**: Upload research papers (PDFs). PosterApp extracts text, mathematical equations, figures, tables, and auto-generates BibTeX citations (using MinerU).
- **Interactive UI**: Manage your poster structure using an interactive column-and-card layout. Adjust height budgets to fine-tune layout.
- **AI Auto-fill**: Generate specialized content for individual sections or the entire poster based on ingested documents.
- **AI Chat Assistant**: A context-aware chat panel built with `assistant-ui` that helps you refine text, suggest titles, and summarize content based on your specific poster context.
- **Poster Review**: Automated local AI agent that reviews your layout, citations, figures, and provides actionable tips.
- **LaTeX Compilation**: High-fidelity poster generation using `pdflatex` directly via a persistent dev server backend. Uses customized themes like `atlas` or `minimal`.

## Architecture Overview

- **Frontend & API**: Next.js App Router (running on port 3333).
- **State Management**: Zustand store (split into `ProjectSlice`, `UiSlice`, `IngestionSlice`, `BibSlice`).
- **Database**: SQLite (via Prisma) holding workspaces, cards, and asset metadata.
- **AI Models**: Connects to configurable AI providers (e.g. OpenRouter/Gemini) through `AI_API_URL` and `AI_API_KEY`.
- **Chat Interface**: Powered by `@assistant-ui/react`, maintaining an ephemeral conversation state linked to the current workspace.

## Getting Started

1. Clone the repository and install dependencies:
   ```bash
   pnpm install
   ```

2. Configure environment variables in `.env.local` (see `AGENTS.md` for reference):
   ```env
   AI_API_URL=...
   AI_API_KEY=...
   AI_MODEL=gemini-3-flash
   # ...
   ```

3. Start the application:
   ```bash
   pnpm run dev
   ```

4. If using local processing (MinerU), ensure the WSL service is started on port 8001.

## Testing

Playwright tests are provided in the `tests/` directory:
```bash
pnpm exec playwright test
```

Tests cover compilation UI, workspace selection, and document ingestion.
