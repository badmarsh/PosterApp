# PosterApp — Product Brochure

## Transform Research Papers into Stunning Academic Posters in Minutes

PosterApp is an intelligent, AI-powered academic poster editor that helps researchers convert their published papers into beautiful, publication-ready scientific posters — without the manual layout headaches.

---

## 🎯 The Problem

Creating academic posters from research papers is tedious and time-consuming:
- Manual copy-pasting of text, equations, and figures
- Struggling with LaTeX layout and formatting
- Inconsistent citations and bibliography management
- Hours spent adjusting column layouts and spacing
- No easy way to iterate or collaborate

---

## ✨ The Solution

PosterApp automates the entire workflow, from paper ingestion to polished poster generation, letting you focus on **what matters**: presenting your research effectively.

---

## 🚀 Key Features

### 📄 Automated Paper Ingestion
Upload your research PDF and PosterApp automatically extracts:
- Full text content with structure preservation
- Mathematical equations (LaTeX-formatted)
- Figures, tables, and visual elements
- Auto-generated BibTeX citations (powered by MinerU)

Built with a robust concurrent job queue designed for large documents and resilient retry logic.

### 🎨 Interactive Visual Editor
- **Column-and-card layout** — drag, drop, and reorganize sections visually
- **Height budgets** — fine-tune how much space each section gets
- **Real-time preview** — see changes instantly as you edit
- **Multi-format support** — switch between posters, slides, and papers seamlessly

### 🤖 AI-Powered Assistance
- **Auto-fill content** — generate specialized text for individual sections or the entire poster
- **Smart asset assignment** — AI suggests where figures and tables should go
- **Context-aware chat assistant** — refine text, suggest titles, summarize content with an integrated AI chat panel
- **Automated poster review** — local AI agent reviews your layout, citations, and figures with actionable improvement tips

### 📐 Professional Templates
Choose from curated, publication-ready templates:
- **Posters**: `tikzposter`, `gemini`
- **Slides**: `metropolis`, `beamer-atlas`
- **Papers**: single-column and two-column formats

All templates produce high-fidelity output via `pdflatex` compilation.

### 🔄 Real-Time Collaboration
Built-in Yjs WebSocket support enables:
- Live collaborative editing with teammates
- Synchronized state across all connected clients
- Conflict-free concurrent modifications

### 🔒 Production-Ready Architecture
- **Secure sandboxed compilation** — LaTeX runs in isolated Docker containers with strict capability restrictions
- **Distributed rate limiting** — Upstash Redis-backed rate limiting for multi-user deployments
- **Edge security** — CSP headers, HSTS, X-Frame-Options, and content-type sniffing protection
- **PostgreSQL backend** — reliable persistence with Prisma ORM and connection pooling

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14+ App Router, React Server Components |
| **State Management** | Zustand + Yjs (real-time sync) |
| **Database** | PostgreSQL with Prisma ORM |
| **AI Integration** | OpenRouter-compatible API (Gemini, configurable) |
| **Compilation** | pdflatex via sandboxed Docker containers |
| **Auth** | Clerk authentication |
| **Testing** | Vitest (unit/integration) + Playwright (E2E) |
| **Styling** | Tailwind CSS with shadcn/ui components |
| **Theming** | 4-theme system (Light, Dark, Vercel, Vercel Dark) |

---

## 📊 Workflow

```
1. Upload PDF → 2. Auto-extract content → 3. Organize in visual editor
                                                      ↓
6. Download PDF ← 5. Compile with LaTeX ← 4. AI-assisted refinement
```

---

## 🎓 Perfect For

- **PhD Students** — turn thesis chapters into conference posters in minutes
- **Postdocs** — quickly adapt papers for different conferences and venues
- **Research Groups** — collaborate on posters with real-time editing
- **Conference Presenters** — generate professional posters without LaTeX expertise
- **Academic Institutions** — deploy centrally for department-wide use

---

## 🌟 What Makes PosterApp Different

| Traditional Workflow | PosterApp |
|---------------------|-----------|
| Hours of manual LaTeX coding | Automated extraction and layout |
| Copy-paste errors | Structured, verified ingestion |
| No collaboration | Real-time multi-user editing |
| Fixed templates | AI-assisted content generation |
| Manual citation management | Auto-generated BibTeX |
| No quality checks | Automated AI review and suggestions |

---

## 🛠️ Getting Started

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env.local

# 3. Start database
docker compose up -d

# 4. Apply migrations
pnpm exec prisma migrate dev

# 5. Launch the app (port 3333)
pnpm run dev
```

Full deployment guide in [README.md](./README.md).

---

## 📜 License & Contribution

PosterApp is open source. Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

---

## 🔗 Quick Links

- **Documentation**: [README.md](./README.md)
- **Changelog**: [CHANGELOG.md](./CHANGELOG.md)
- **Contributing**: [CONTRIBUTING.md](./CONTRIBUTING.md)
- **Academic Reviewer Spec**: [ACADEMIC_REVIEWER_MASTER.md](./ACADEMIC_REVIEWER_MASTER.md)

---

*PosterApp — From paper to poster, intelligently.*
