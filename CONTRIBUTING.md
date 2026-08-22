# Contributing to PosterApp

## Development Setup
1. `pnpm install`
2. Copy `.env.example` → `.env.local` and fill in keys
3. `npx prisma db push && npx prisma generate`
4. `pnpm run dev`

## Testing
- Unit: `pnpm test`
- E2E: `pnpm exec playwright test` (needs running server + Clerk test token)

## Code Style
- TypeScript strict mode
- ESLint via `pnpm run lint` (must be 0 errors before PR)
- Vitest for unit tests — add tests for new store actions and API routes

## Architecture
See `AGENTS.md` for full architecture documentation.

## Pull Request Guidelines
- Keep PRs focused on a single feature/fix
- Include unit tests for any new store actions or API routes
- Run `pnpm run build` before submitting
