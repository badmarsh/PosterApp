# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1] - 2026-08-22
### Added
- ESLint flat config (`eslint.config.mjs`)
- 99 unit tests (Vitest) — store slices + API routes
- JSDoc documentation for core exported functions

### Fixed
- Next.js 16 turbopack config location
- Removed stale `middleware.ts` (replaced by `proxy.ts`)
- BibTeX deduplication for duplicate PDFs
- Playwright tests missing `webServer` config
- ESLint and React Compiler warnings

### Changed
- Git history purged of large binaries (148 MB → 3.74 MB)
- README revamped with architecture overview

## [0.1.0] - 2026-07
### Added
- Initial release: PDF ingestion, AI card auto-fill, LaTeX compilation
- Clerk authentication, Prisma SQLite, Zustand store
- tikzposter + paper LaTeX generators (atlas/minimal themes)
- MinerU integration for figure/table extraction
- AI poster review, AI chat assistant
