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
| **`mineru-api`** | `mineru-api-wsl` | `mineru-wsl-cpu:latest` | `8000` (dokploy-network) / `8001` (host) | CPU parsing sidecar pre extrakciu CommonMark markdownu, obrázkov a tabuliek z PDF. Zabezpečené cez `X-API-Key`. |

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

# Riadenie registrácie (true: registrácie povolené; false: registrácia zakázaná)
ALLOW_REGISTRATION="true"
NEXT_PUBLIC_ALLOW_REGISTRATION="true"

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

# AI Modely & Provideri (Google Gemini Native + OpenRouter)
GEMINI_API_KEY="AQ.Ab8RN6...alebo_AIzaSy..."
GEMINI_API_URL="https://generativelanguage.googleapis.com/v1beta/openai"
OPENROUTER_API_KEY="sk-or-v1-..."
OPENROUTER_BASE_URL="https://openrouter.ai/api/v1"
AI_MODEL="gemini-3.8-flash"
AI_VISION_MODEL="gemini-3.8-flash"
AI_REVIEW_LAYOUT_MODEL="gemini-3.8-flash"
AI_AUTOFIX_MODEL="gemini-3.8-flash"

# MinerU Document Parsing Sidecar (CPU kontajner v dokploy-network)
MINERU_API_URL="http://mineru-api-wsl:8000"
MINERU_API_KEY="e7da866f538b38a6140344f05bffaa2cade29cddf5d62ca5"

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

## Fáza 3.3: Nasadenie a prevádzka MinerU Document Parsing Sidecaru (CPU Mode)

MinerU zabezpečuje extrakciu štruktúrovaného CommonMark markdownu, obrázkov, grafov a tabuliek z akademických PDF dokumentov. Na serveri `dev.significa.sk` beží v CPU režime ako Docker kontajner pripojený k sieti `dokploy-network`.

### 3.3.1 Príprava a konfigurácia MinerU (`/root/mineru/.env`)
V adresári `/root/mineru` overte prítomnosť súboru `.env`:
```env
MINERU_API_KEY=e7da866f538b38a6140344f05bffaa2cade29cddf5d62ca5
MINERU_API_PORT=8001
MINERU_API_ENABLE_FASTAPI_DOCS=1
MINERU_DEVICE_MODE=cpu
MINERU_PDF_RENDER_THREADS=2
MINERU_INTRA_OP_NUM_THREADS=2
MINERU_INTER_OP_NUM_THREADS=1
```

### 3.3.2 Zostavenie obrazu a spustenie kontajnera
```bash
# 1. Prechod do adresára MinerU
cd /root/mineru

# 2. Build CPU kontajnera (používa PyTorch CPU wheel + pypdfium2 + doclayout_yolo)
docker compose -f docker-compose.wsl.yml build mineru-api

# 3. Spustenie služby na pozadí s profilom api
docker compose -f docker-compose.wsl.yml --profile api up -d mineru-api

# 4. Kontrola stavu a pripojenia k sieti dokploy-network
docker ps --filter "name=mineru-api"
docker network connect dokploy-network mineru-api-wsl || true
```

### 3.3.3 Prepojenie s PosterApp
PosterApp (`apps-posterapp-web-1`) automaticky komunikuje s MinerU prostredníctvom `lib/services/mineru-bridge.ts`:
- Interná adresa: `http://mineru-api-wsl:8000` (cez sieť `dokploy-network`)
- Záložná adresa: `http://172.17.0.1:8001` (host gateway)
- Autentifikácia: Hlavička `X-API-Key: <MINERU_API_KEY>`

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

### 4.5 Test MinerU Ingestion Sidecaru
1. **Healthcheck endpoint:**
   ```bash
   curl -s http://localhost:8001/health
   # Očakávaný výsledok: {"status":"ok","version":"1.3.1","auth_enabled":true}
   ```
2. **Autorizovaný endpoint cez sieť kontajnerov:**
   ```bash
   docker exec -it apps-posterapp-web-1 curl -s -H "X-API-Key: e7da866f538b38a6140344f05bffaa2cade29cddf5d62ca5" http://mineru-api-wsl:8000/health
   ```
3. **End-to-End nahrávanie PDF:**
   V používateľskom rozhraní nahrajte PDF súbor do workspace. MinerU extrahuje CommonMark markdown a extrahované obrázky sa uložia do `workspaces/<id>/assets/`.

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
