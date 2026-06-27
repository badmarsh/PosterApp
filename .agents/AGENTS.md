# PosterApp Project Information

This file contains important context about the project infrastructure and dependencies for future agent sessions.

## Key Services
- **Next.js Frontend/API**: The main application. Runs on port 3333.
- **Ollama**: Local LLM service. Runs on the Windows Host at `http://127.0.0.1:11434`. Models include `minicpm-v` for vision tasks.
- **MinerU**: Document parsing service. Runs in a WSL (Ubuntu) environment. The source is located at `~/mineru`.

## Startup & Execution
- **Dev Server**: Run `pnpm run dev` to start everything concurrently.
- `start-mineru.bat`: Helper script that launches MinerU in WSL via `wsl -d Ubuntu -e bash -c "cd ~/mineru && source .venv/bin/activate && mineru-api --port 8001"`. MinerU API binds to port 8001.

## Directories
- `workspaces/`: Currently stores workspace data (project configurations, assets, and markdown) as JSON files. (Note: A migration to Prisma + SQLite is planned).
- `app/api/ingestion/parse/route.ts`: API route that delegates file ingestion to the local MinerU service.
- `tests/ingestion.spec.ts`: Playwright UI test for validating the end-to-end ingestion pipeline.
