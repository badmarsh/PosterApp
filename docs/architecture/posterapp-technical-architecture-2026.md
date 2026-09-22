# PosterApp — Technická Dokumentácia & Architektúra (2026)

**Verzia:** 2.4.0 (Production / Dokploy)  
**Host:** `poster.dev.significa.sk` (Port: `3333`)  
**Repozitár:** [github.com/badmarsh/PosterApp](https://github.com/badmarsh/PosterApp)  
**Posledná aktualizácia:** 22. september 2026  

---

## 1. Architektonický prehľad a Technologický Stack

PosterApp je špecializovaný akademický a publikačný systém na generovanie vedeckých posterov, Beamer slajdov, preprintov článkov a formálnych posudkov záverečných prác (Bc/MSc/PhD) s podporou pokročilého RAG-u (Retrieval-Augmented Generation), automatickej extrakcie citácií, LaTeX kompilácie a kolaborácie v reálnom čase.

| Komponent | Použitá technológia | Účel & Špecifiká |
| :--- | :--- | :--- |
| **Framework** | Next.js 16 (App Router) + React 19 | Frontend UI, Server Actions, API routes. |
| **Runtime & Server** | Node.js 24 + `server.ts` | Vlastný unified server hostujúci Next.js aj Yjs WebSocket na porte `3333`. |
| **Realtime Sync** | Yjs + WebSockets | Kolaboratívna editácia kariet a rozloženia (`ws://localhost:3333/api/yjs`). |
| **Autentifikácia** | Clerk (`@clerk/nextjs`) + `proxy.ts` | Používateľské účty, RBAC, organizácie a E2E test bypass. |
| **Databáza** | PostgreSQL 16/17 + `pgvector` + Prisma 5 | Perzistentné ukladanie workspaces, výstupov, kariet, vektorov a auditných logov. |
| **Lokálne Vektory** | Transformers.js (`Xenova/paraphrase-multilingual-MiniLM-L12-v2`) | 384-rozmerné slovenské/české/anglické vektorové embeddingy bežiace priamo v procese (ONNX/WASM). |
| **AI LLM Klient** | Google Gemini (`gemini-3.8-flash`, `3.7-flash`) + OpenRouter | Natívna generácia textov, extrakcia BibTeX, recenzie a opravy chýb. |
| **Multimodálna Vízia** | Qwen-VL (`qwen3-vl-flash`, `qwen-omni-turbo`) | Inteligentné popisovanie grafov, extrakcia tabuliek a rozloženie obrázkov. |
| **Dokumentový Parser** | MinerU FastAPI sidecar (`mineru-api-wsl:8000`) | Hĺbková extrakcia PDF na CommonMark, vzorce, obrázky a stavebné bloky. |
| **LaTeX Engine** | Tectonic / pdflatex | Kompilácia do publikačných PDF dokumentov s dynamickým škálovaním vzorcov (`\fitmath`). |

---

## 2. Dátová a Klonovacia Infraštruktúra (Dokploy na `dev.significa.sk`)

Po vzore sesterského projektu **OpenVPM-AI** bola pre PosterApp zavedená robustná zálohovacia, klonovacia a retušovacia infraštruktúra na serveri `dev.significa.sk`:

### 2.1 Živá databáza vs. Anonymizovaný Klon
1. **Živá produkčná databáza (Cloud Supabase)**:
   - Hostiteľ: `aws-0-eu-central-1.pooler.supabase.com` (Port 6543 / 5432).
   - Databáza s plnými produkčnými dátami, tabuľkami workspaces a používateľskými reláciami.
2. **Dokploy Arena Klon (`posterapp-arena-postgres-c9x2`)**:
   - Hostiteľ: `dev.significa.sk` (Port **`5435`**).
   - Obraz: `pgvector/pgvector:pg17` s natívnou podporou pre vektorové indexy.
   - Používateľ / Databáza / Heslo: `posterapp` / `posterapp` / `posterapp_arena_pass_2026`.
   - Pripojenie: `postgresql://posterapp:posterapp_arena_pass_2026@dev.significa.sk:5435/posterapp`.

### 2.2 Automatický Denný Cron & PII Retušovanie
Každú noc o **02:30 UTC** beží na serveri skript `/usr/local/bin/posterapp-sync-clone.sh`:
- Stiahne komprimovanú raw zálohu zo Supabase do `/var/backups/posterapp/posterapp_YYYY-MM-DD_daily_raw.dump`.
- **Automaticky vyretušuje citlivé a osobné údaje**:
  - Emaily nahradí bezpečným formátom `user_anonymized@example.com`.
  - Clerk, Supabase a OpenRouter API kľúče nahradí testovacími mock tokenmi.
  - **Všetky vzťahy, cudzí kľúče, reálne akademické dáta, chyby v dátach a štrukturálne nedokonalosti zostávajú zachované**, aby externí AI agenti videli autentický stav.
- Vyčistí a nanovo obnoví databázu v kontajneri na porte `5435`.
- Rotuje archív: uchováva 14 denných a 4 týždenné zálohy.

---

## 3. Šablóny a Architektúra Zjednotenia (Template Unification)

### 3.1 Problém existujúcej duplicity
V aplikácii historicky existovali dve oddelené reprezentácie šablón:
1. **Workspace / Showcase šablóny** (`lib/showcases-data.ts`, `lib/template-demos.ts`, `components/research-lab-templates.tsx`):
   - Definovali rozloženie stĺpcov, predvolené karty, farebné palety a demo texty pre UI.
2. **LaTeX generator šablóny** (`lib/latex/templates.ts`, `generator-poster.ts`, `generator-slides.ts`):
   - Definovali LaTeX preambulu, použité balíčky, beamer témy a formátovacie príkazy.

### 3.2 Zjednotená architektúra (`TemplateRegistry`)
Podľa noriem `AGENTS.md` a princípov z `openvpm-ai` sa zavádza jednotný autoritatívny register:
```typescript
interface UnifiedTemplateDefinition {
  id: string; // napr. 'atlas', 'conference', 'beamer-metropolis'
  name: string;
  category: 'poster' | 'slides' | 'paper' | 'thesis-review';
  metadata: {
    venue?: string;
    aspectRatio?: '16:9' | '4:3' | 'A0' | 'A4';
    columns?: number;
    recommendedPaperType?: string;
  };
  layout: {
    defaultSlots: Array<{ cardId: string; title: string; pattern: string }>;
    colorPalette: { primary: string; secondary: string; background: string };
  };
  latex: {
    documentClass: string;
    preambleGenerator: (meta: ProjectMeta) => string;
    fitMacros: boolean; // automatická injekcia \fitmath a \fitstat
  };
  assets: {
    previewThumbnail: string; // public/showcases/mockups/...
    samplePdfUrl?: string;
  };
}
```

---

## 4. Pravidlá pre Vývojárov a AI Agentov (`AGENTS.md`)

Každý vývojár alebo autonómny agent (Arena.ai, Codex, Claude) pracujúci na repozitári musí striktne dodržiavať:
1. **Disciplína overovania**: Postupnosť `tsc --noEmit` -> `pnpm test`. Zákaz ignorovania typov cez `@ts-ignore` alebo `any`.
2. **LaTeX Compilation Safety**:
   - Všetky matematické vzorce musia byť ohraničené pomocou makra `\fitmath` pre zamedzenie horizontálneho pretekania.
   - Všetky dynamické vstupy používateľov musia prejsť sanitizáciou znakov (`%`, `_`, `&`, `#`, `~`, `^`).
3. **Dual-Environment Hygiene**:
   - Akékoľvek zmeny v schéme alebo testovacích dátach musia byť spätne kompatibilné s lokálnym exportom v `.arena/db-dump.sql`.
