# PosterApp

PosterApp is an intelligent, Next.js-based academic poster editor that assists researchers in writing, laying out, and generating beautiful LaTeX-based scientific posters from their source documents. 

## Features

- **Automated Ingestion**: Upload research papers (PDFs). PosterApp extracts text, mathematical equations, figures, tables, and auto-generates BibTeX citations (using MinerU). Features a robust concurrent job queue designed for processing large documents and resilient retries.
- **Interactive UI**: Manage your document structure using an interactive column-and-card layout. Adjust height budgets to fine-tune layout.
- **AI Auto-fill**: Generate specialized content for individual sections or the entire poster based on ingested documents, automatically assigning tables and figures.
- **AI Chat Assistant**: A context-aware chat panel built with `assistant-ui` that helps you refine text, suggest titles, and summarize content based on your specific poster context.
- **Poster Review**: Automated local AI agent that reviews your layout, citations, figures, and provides actionable tips.
- **Multi-Format Generation**: High-fidelity document generation using `pdflatex` via a persistent dev server backend. Supports categorized templates for **Posters** (`tikzposter`, `gemini`), **Slides** (`metropolis`, `beamer-atlas`), and **Papers** (single/two-column). Switch between them seamlessly via the Format Settings sidebar.

## Architecture Overview

- **Frontend & API**: Next.js App Router (running on port 3333 alongside Yjs WebSocket via custom `server.ts`).
- **State Management**: Zustand store (split into `ProjectSlice`, `UiSlice`, `IngestionSlice`, `BibSlice`) synced with Yjs. Includes a robust `JobQueue` for concurrent ingestion processing.
- **Database**: PostgreSQL (via Prisma in Docker) holding workspaces, cards, and asset metadata. Avoids duplications through asset upserts.
- **AI Models**: Connects to configurable AI providers (e.g. OpenRouter/Gemini) through `AI_API_URL` and `AI_API_KEY`.
- **Chat Interface**: Powered by `@assistant-ui/react`, maintaining an ephemeral conversation state linked to the current workspace.

## Getting Started

1. Clone the repository and install dependencies:
   ```bash
   pnpm install
   ```

2. Configure environment variables in `.env.local` (copy from `.env.example`):
   ```bash
   cp .env.example .env.local
   ```

3. Start PostgreSQL using Docker Compose:
   ```bash
   docker compose up -d
   ```

4. Apply the database schema migrations:
   ```bash
   pnpm exec prisma migrate dev
   ```

5. Start the application (runs Next.js and Yjs WebSocket concurrently on port 3333):
   ```bash
   pnpm run dev
   ```

6. If using local PDF ingestion (MinerU), ensure the WSL service is running at `http://localhost:8001`.

## Testing

- **Unit & Integration Tests** (Vitest):
  ```bash
  pnpm test
  ```
- **End-to-End Tests** (Playwright with built-in Clerk bypass):
  ```bash
  pnpm test:e2e
  ```

## Production Deployment Checklist

When deploying PosterApp to a production cluster or cloud environment:

1. **LaTeX Compiler Container**: Set `LATEX_COMPILER_IMAGE` to an isolated Docker image containing `pdflatex` / `bibtex` / `tikzposter` (e.g. `texlive/texlive:latest`). In production, compile execution enforces `--cap-drop=ALL`, `--user 1000:1000`, `--read-only`, and `--tmpfs /tmp`.
2. **Distributed Rate Limiting**: Configure Upstash Redis (`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`) for distributed per-user rate limiting across all AI routes and compilation endpoints.
3. **Database**: Provide a production PostgreSQL connection string in `DATABASE_URL` with connection pooling enabled.
4. **Authentication**: Set production Clerk keys (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`).
5. **Realtime Collaboration (Yjs)**: Configure `NEXT_PUBLIC_YJS_WS_URL` with your production WebSocket domain (e.g. `wss://yourdomain.com/api/yjs`).
6. **Edge Security**: Edge security headers (CSP with `worker-src 'self' blob:;`, HSTS, X-Frame-Options, nosniff) are automatically applied via `next.config.mjs`.

## Environment Variables
The application requires several environment variables to function correctly. Copy `.env.example` to `.env.local` and configure them:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `AI_API_URL` | Base URL for the AI API (OpenRouter compatible) |
| `AI_API_KEY` | Bearer token for AI requests |
| `AI_MODEL` | Default model used for chat and generation (`gemini-3-flash`) |
| `LATEX_COMPILER_IMAGE` | Docker image for sandboxed LaTeX compilation in production |
| `UPSTASH_REDIS_REST_URL` | (Optional) Upstash Redis URL for distributed rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | (Optional) Upstash Redis REST Token |
| `OPENROUTER_API_KEY` | API Key for OpenRouter (used for image editing) |
| `OPENROUTER_BASE_URL` | OpenRouter Base URL |
| `OPENROUTER_IMAGE_MODEL` | Model used for AI image generation |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Authentication frontend key |
| `CLERK_SECRET_KEY` | Clerk Authentication backend key |
| `NEXT_PUBLIC_YJS_WS_URL` | Yjs WebSocket URL (`ws://localhost:3333/api/yjs`) |

## API Routes Reference
- `POST /api/ingestion/parse` - Accepts PDF uploads, triggers MinerU, extracts markdown, figures, tables, and AI-generated BibTeX citations.
- `POST /api/ingestion/image-edit` - Performs AI image editing using OpenRouter vision models.
- `GET /api/workspaces` - Lists all user workspaces.
- `POST /api/workspaces` - Creates a new empty workspace.
- `GET /api/workspaces/[id]` - Retrieves workspace configuration, cards, and metadata.
- `PUT /api/workspaces/[id]` - Updates workspace state.
- `POST /api/workspaces/[id]/compile` - Synchronously compiles LaTeX templates to PDF output using local `pdflatex`.
- `GET /api/workspaces/[id]/pdf` - Serves the compiled PDF output for preview.
- `POST /api/workspaces/[id]/cards/[cardId]/generate` - Generates card content using AI grounding from the workspace corpus.
- `POST /api/workspaces/[id]/review` - Performs a comprehensive AI review of the poster layout and content, producing deterministic lint rules and vLLM insights.
