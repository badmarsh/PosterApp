# PosterApp

PosterApp is an intelligent, Next.js-based academic poster editor that assists researchers in writing, laying out, and generating beautiful LaTeX-based scientific posters from their source documents. 

## Features

- **Automated Ingestion**: Upload research papers (PDFs). PosterApp extracts text, mathematical equations, figures, tables, and auto-generates BibTeX citations (using MinerU).
- **Interactive UI**: Manage your poster structure using an interactive column-and-card layout. Adjust height budgets to fine-tune layout.
- **AI Auto-fill**: Generate specialized content for individual sections or the entire poster based on ingested documents.
- **AI Chat Assistant**: A context-aware chat panel built with `assistant-ui` that helps you refine text, suggest titles, and summarize content based on your specific poster context.
- **Poster Review**: Automated local AI agent that reviews your layout, citations, figures, and provides actionable tips.
- **Multi-Format Generation**: High-fidelity document generation using `pdflatex` via a persistent dev server backend. Supports categorized templates for **Posters** (`tikzposter`, `gemini`), **Slides** (`metropolis`, `beamer-atlas`), and **Papers** (single/two-column).

## Architecture Overview

- **Frontend & API**: Next.js App Router (running on port 3333 alongside Yjs WebSocket via custom `server.ts`).
- **State Management**: Zustand store (split into `ProjectSlice`, `UiSlice`, `IngestionSlice`, `BibSlice`) synced with Yjs.
- **Database**: PostgreSQL (via Prisma in Docker) holding workspaces, cards, and asset metadata.
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

3. Start the application (runs Next.js and Yjs WebSocket concurrently):
   ```bash
   pnpm run dev
   ```

4. If using local processing (MinerU), ensure the WSL service is started on port 8001. Ensure PostgreSQL is running via Docker.

## Testing

Playwright tests are provided in the `tests/` directory:
```bash
pnpm exec playwright test
```

Tests cover compilation UI, workspace selection, and document ingestion.

## Environment Variables
The application requires several environment variables to function correctly. Copy `.env.example` to `.env.local` and configure them:

| Variable | Purpose |
|----------|---------|
| `AI_API_URL` | Base URL for the AI API (OpenRouter compatible) |
| `AI_API_KEY` | Bearer token for AI requests |
| `AI_MODEL` | Default model used for chat and generation |
| `OPENROUTER_API_KEY` | API Key for OpenRouter (used for image editing) |
| `OPENROUTER_BASE_URL` | OpenRouter Base URL |
| `OPENROUTER_IMAGE_MODEL` | Model used for AI image generation |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Authentication frontend key |
| `CLERK_SECRET_KEY` | Clerk Authentication backend key |

## API Routes Reference
- `POST /api/ingestion/parse` - Accepts PDF uploads, triggers MinerU, extracts markdown, figures, tables, and AI-generated BibTeX citations.
- `POST /api/ingestion/image-edit` - Performs AI image editing using OpenRouter vision models.
- `GET /api/workspaces` - Lists all user workspaces.
- `POST /api/workspaces` - Creates a new empty workspace.
- `GET /api/workspaces/[id]` - Retrieves workspace configuration, cards, and metadata.
- `PUT /api/workspaces/[id]` - Updates workspace state.
- `GET /api/workspaces/[id]/compile` - Synchronously compiles LaTeX templates to PDF output using local `pdflatex`.
- `GET /api/workspaces/[id]/pdf` - Serves the compiled PDF output for preview.
- `POST /api/workspaces/[id]/cards/[cardId]/generate` - Generates card content using AI grounding from the workspace corpus.
- `POST /api/workspaces/[id]/review` - Performs a comprehensive AI review of the poster layout and content, producing deterministic lint rules and vLLM insights.
