# PosterApp — Dokploy Deployment Runbook & SOP

**Cieľový server:** `dev.significa.sk` (SSH: `root@dev.significa.sk`)  
**Verejná produkčná URL:** [https://poster.dev.significa.sk](https://poster.dev.significa.sk)  
**Dokploy Project ID:** `P0stErAppPr0j3ctId26` (`PosterApp`)  
**Dokploy Environment ID:** `P0stErAppEnvPr0dId26` (`production`)  
**Dokploy Compose App ID:** `P0stErAppC0mp0sEId26` (`posterapp`)  
**Interný názov aplikácie na disku:** `apps-posterapp`  
**Cesta ku kódu na serveri:** `/etc/dokploy/compose/apps-posterapp/code/`  
**Cesta k logom nasadenia:** `/etc/dokploy/logs/apps-posterapp/`  
**Dokploy Webhook URL:** `https://dev.significa.sk/api/deploy/compose/posterapp_whk_2026_tok`  

---

## Prehľad architektúry služieb (Multi-Container Compose)

| Služba | Kontajner | Obraz / Base | Porty (interné / Traefik) | Účel |
| :--- | :--- | :--- | :--- | :--- |
| **`postgres`** *(voliteľné)* | `posterapp-postgres` | `pgvector/pgvector:pg16` | `5432` (interná sieť) | PostgreSQL 16 databáza s `pgvector` pre 384-dimenzionálne HNSW embeddingy. *Ak je nastavený Supabase Cloud, táto služba sa ignoruje.* |
| **`db-init`** | `posterapp-db-init` | multi-stage `builder` (`Dockerfile`) | jednorazový (exit 0) | Spustenie `npx prisma db push --skip-generate` pred štartom webu. Zabezpečí 100% aktuálnu schému v DB. |
| **`web`** | `posterapp-web` | multi-stage `runner` (`Dockerfile`) | `3333` (Traefik proxy) | Next.js 16 + React 19 + Custom Server (`server.ts`). Servuje web na porte 3333 a Yjs WebSocket na `/api/yjs`. |

Traefik reverse proxy v Dokploy počúva na externej sieti **`dokploy-network`**, automaticky spravuje Let's Encrypt TLS certifikáty a natívne prepája WebSocket spojenia pre kolaboratívne úpravy (`/api/yjs`).

---

## Perzistentné Volumes v Dokploy

Pre PosterApp sú kľúčové tri perzistentné diskové zväzky:
1. **`posterapp_workspaces`** (`/app/workspaces`): Uchováva nahraté PDF rukopisy, extrahované obrázky a tabuľky (`assets/`) a vygenerované CommonMark markdowny (`sources/`).
2. **`posterapp_yjs`** (`/app/tmp/yjs`): LevelDB úložisko pre kolaboratívne CRDT stavy. Zabezpečuje, že rozpracované úpravy kariet prežijú reštart servera.
3. **`posterapp_cache`** (`/app/.cache`): Lokálna vyrovnávacia pamäť pre stiahnutý model `@xenova/transformers` (`paraphrase-multilingual-MiniLM-L12-v2`), aby sa model nesťahoval pri každom štarte nanovo.
4. **`postgres_data`** (`/var/lib/postgresql/data`): Používa sa len pri lokálnej internej databáze (pri Supabase Cloud ostáva prázdny).

---

## Fáza 1: Príprava lokálneho prostredia pred nasadením

Pred každým spustením buildu v Dokploy overte stav repozitára:

### 1.1 Kontrola čistoty gitu a tajomstiev
Spustite v koreňovom priečinku PosterApp:
```bash
git status
```
Overte, že v stagingu nie sú commitnuté žiadne súbory `.env`, `.env.local` ani privátne kľúče:
```bash
git diff --staged | grep -E "(sk_|pk_|Bearer|password=)"
```

### 1.2 TypeScript Type Check & Unit Testy
```bash
# 1. Typecheck (musí skončiť bez chýb)
pnpm run typecheck

# 2. Kompletná sada 1180+ unit testov
pnpm test -- --run
```
*Očakávaný výsledok: 129 testovacích súborov prejde na 100%.*

### 1.3 Odoslanie zmien na GitHub
```bash
git push origin main
```

---

## Fáza 2: Synchronizácia a správa premenných (.env)

Dokploy spravuje premenné centrálne v UI. V Dokploy otvorte aplikáciu **posterapp** ➔ záložka **Environment** a vložte produkčné premenné:

```env
# ==============================================================================
# POSTERAPP — PRODUKČNÁ KONFIGURÁCIA (Dokploy)
# ==============================================================================

# Node / Next.js Runtime
NODE_ENV=production
PORT=3333
HOSTNAME=0.0.0.0
NEXT_TELEMETRY_DISABLED=1

# Produkčná verejná doména (použije sa pre Traefik aj WebSocket)
DOMAIN="poster.dev.significa.sk"

# Clerk Autentifikácia
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_...alebo_pk_live_..."
CLERK_SECRET_KEY="sk_test_...alebo_sk_live_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL="/"
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL="/"

# Yjs WebSocket Kolaborácia (musí smerovať na wss:// vašej domény)
NEXT_PUBLIC_YJS_WS_URL="wss://poster.dev.significa.sk/api/yjs"

# ------------------------------------------------------------------------------
# Databáza (Možnosť A: Supabase Cloud — ODPORÚČANÉ)
# ------------------------------------------------------------------------------
DATABASE_URL="postgresql://postgres.gruuqqiazsqkcpnejwsb:P0sterApp2026SecureDb99@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true"
DIRECT_URL="postgresql://postgres.gruuqqiazsqkcpnejwsb:P0sterApp2026SecureDb99@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require"

# (Alebo Možnosť B: Interný kontajner na Dokploy)
# POSTGRES_USER=postgres
# POSTGRES_PASSWORD=SilneHesloPrePosterAppDb123
# POSTGRES_DB=posterapp
# DATABASE_URL="postgresql://postgres:SilneHesloPrePosterAppDb123@postgres:5432/posterapp"
# DIRECT_URL="postgresql://postgres:SilneHesloPrePosterAppDb123@postgres:5432/posterapp"

# AI Modely & OpenRouter
OPENROUTER_API_KEY="sk-or-v1-..."
OPENROUTER_BASE_URL="https://openrouter.ai/api/v1"
AI_MODEL="gemini-3.1-pro-preview"
AI_VISION_MODEL="qwen3-vl-flash"
AI_VISION_API_URL="https://ws-8cyjh6mqqru3jqy6.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions"
AI_VISION_API_KEY="sk-ws-..."

# MinerU Document Parsing Sidecar (ak beží na serveri alebo dedikovanom GPU node)
MINERU_API_URL="http://mineru:8001"

# Academic & Research Connectors
SEMANTIC_SCHOLAR_API_KEY="s2k-..."
OPENALEX_API_KEY="VaVCYg..."
TAVILY_API_KEY="tvly-..."
EXA_API_KEY="c2ed273d-..."
SERPER_API_KEY="a0a37c..."
FIRECRAWL_API_KEY="fc-fa..."

# Úložiská & Zabezpečenie
WORKSPACES_DIR="workspaces"
YPERSISTENCE="./tmp/yjs"
RATE_LIMIT_ALLOW_IN_MEMORY=1
AUTH_SECRET="vygeneruj-openssl-rand-base64-32"
```

---

## Fáza 3: Spustenie buildu a nasadenia v Dokploy

### 3.1 Nastavenie v Dokploy UI
1. V Dokploy kliknite na **Create Application** ➔ vyberte typ **Docker Compose**.
2. **Name:** `posterapp`.
3. **Source:**
   - **Repository:** `badmarsh/PosterApp`
   - **Branch:** `main`
4. **Compose Settings:**
   - **Compose Path:** `docker/docker-compose.dokploy.yml`
5. Vložte premenné prostredia podľa **Fázy 2** v záložke **Environment**.
6. Kliknite na **Deploy**.

---

### 3.2 Alternatívny manuálny postup cez SSH (pri ladení)

```bash
# 1. Pripojenie na server
ssh root@dev.significa.sk

# 2. Vytvorenie externej siete pre Traefik (ak ešte neexistuje)
docker network inspect dokploy-network >/dev/null 2>&1 || docker network create dokploy-network

# 3. Klonovanie / pull repozitára
cd /etc/dokploy/compose/<compose-id>/code/
git fetch origin main && git reset --hard origin/main

# 4. Spustenie buildu
docker compose -f docker/docker-compose.dokploy.yml build

# 5. Inicializácia databázy a spustenie aplikácie
docker compose -f docker/docker-compose.dokploy.yml up -d db-init
docker compose -f docker/docker-compose.dokploy.yml up -d web

# 6. Kontrola stavu
docker compose -f docker/docker-compose.dokploy.yml ps
```

---

## Fáza 4: Verifikácia a Smoke testy (Overenie funkčnosti)

Po nasadení overte správny chod všetkých subsystémov:

### 4.1 Test dostupnosti verejnej domény a TLS certifikátu
```bash
curl -Iv https://poster.dev.significa.sk
```
*Očakávaný výsledok: HTTP 200 OK alebo 307 Redirect na Clerk login s platným Let's Encrypt certifikátom.*

### 4.2 Test systémového Healthcheck Endpointu
```bash
curl -s https://poster.dev.significa.sk/healthz
```
*Očakávaný výsledok: `{"ok":true,"uptime":...}`*

### 4.3 Test Yjs WebSocket kolaborácie
Skontrolujte v DevTools prehliadača (Network ➔ WS):
- Pripojenie k `wss://poster.dev.significa.sk/api/yjs?workspaceId=<id>` musí prebehnúť s kódom `101 Switching Protocols`.
- Subprotokol: `posterapp-yjs-v1`.

### 4.4 Test Vector RAG a pgvector
1. Otvorte ľubovoľný workspace a modul **Posudok záverečnej práce (Thesis Review)**.
2. V sekcii diagnostiky vektorového indexu kliknite na **Indexovať / Hľadať**.
3. Overte, že hybridné vyhľadávanie vráti relevantné pasáže bez chyby pripojenia.

---

## Fáza 5: Rollback stratégia a riešenie problémov

### 5.1 Čo robiť, ak `db-init` zlyhá
Ak kontajner `db-init` skončí s chybou, kontajner `web` sa nespustí (ochrana pred nekonzistentnou schémou).
```bash
# Zobrazenie logov z migrácie
docker logs posterapp-db-init

# Ručné spustenie synchronizácie schémy
docker compose -f docker/docker-compose.dokploy.yml run --rm db-init npx prisma db push
```

### 5.2 Okamžitý Rollback cez Dokploy UI
1. V Dokploy otvorte aplikáciu **posterapp** ➔ **Deployments**.
2. Nájdite predchádzajúci úspešný deployment.
3. Kliknite na **Rollback / Redeploy**.

### 5.3 Užitočné príkazy pre správcu servera cez SSH
```bash
# Živé logy Next.js & WebSocket servera
docker logs -f --tail=100 posterapp-web

# Kontrola zaplnenia diskových volumes (workspaces a LevelDB)
docker run --rm -v posterapp_workspaces:/w alpine df -h /w
docker run --rm -v posterapp_yjs:/y alpine df -h /y

# Kontrola využitia RAM a CPU
docker stats --no-stream
```
