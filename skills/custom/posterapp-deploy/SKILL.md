# PosterApp Deploy Skill

## Trigger

Použi tento skill vždy keď treba deploynúť PosterApp na produkčný server `poster.dev.significa.sk`, triggernúť rebuild, pushnúť zmeny do produkcie, alebo keď používateľ povie "deploy", "deploynúť", "pushni na prod", "nasaď na server" alebo podobné.

## PRAVIDLO: Deploy VŽDY cez Dokploy webhook — NIKDY inak

**ZAKÁZANÉ** obchádzanie Dokploy:
- SSH priamy docker compose build/up (`nohup docker compose ... up -d --build`)
- Manuálne kopírovanie súborov na server
- Akékoľvek priame SSH príkazy pre build alebo deploy

SSH sa smie použiť VÝHRADNE na diagnostiku — čítanie logov, kontrola container statusu. Nie na build.

**POVINNÝ** postup:

### Krok 1: Overiť že kód je na main

```bash
git status && git log --oneline -3
```

Ak sú necommitnuté zmeny, commitni a pushni:

```bash
git add -A && git commit -m "<popis>" && git push origin main
```

### Krok 2: Triggernúť Dokploy deploy cez webhook

```bash
curl -s -X POST "https://dev.significa.sk/api/deploy/compose/posterapp_whk_2026_tok" \
  -H "Content-Type: application/json" \
  -H "x-github-event: push" \
  -d '{"ref":"refs/heads/main","commits":[{"added":["deploy"],"modified":[],"removed":[]}],"head_commit":{"message":"Deploy triggered by Codex agent","id":"000000"}}'
```

Očakávaná odpoveď: `{"message":"Compose deployed successfully"}`

### Krok 3: Sledovať Dokploy build log (POVINNÉ)

**Agent MUSÍ aktívne sledovať log až do úspešného dokončenia buildu alebo zlyhania. Nestačí triggernúť webhook a skončiť.**

Dokploy zapisuje build log do súboru. Zisti názov najnovšieho logu a sleduj ho:

```bash
ssh root@dev.significa.sk "ls -t /etc/dokploy/logs/apps-posterapp/ | head -1"
```

Potom sleduj log v reálnom čase (nahraď `<logfile>` skutočným názvom):

```bash
ssh root@dev.significa.sk "tail -f /etc/dokploy/logs/apps-posterapp/<logfile>"
```

Alebo jedným príkazom (sleduje najnovší log):

```bash
ssh root@dev.significa.sk "tail -f /etc/dokploy/logs/apps-posterapp/$(ls -t /etc/dokploy/logs/apps-posterapp/ | head -1)"
```

**Čo hľadáš v logu:**
- ✅ Úspešné dokončenie: riadky ako `Successfully built`, `Started server on port 3333`, container status `healthy`
- ❌ Zlyhanie buildu: `Error`, `failed`, `exit code` — nahlas používateľovi konkrétnu chybu

Po skončení buildu (úspech alebo zlyhanie) over container status:

```bash
ssh root@dev.significa.sk "docker ps --format '{{.Names}} {{.Status}}' | grep posterapp"
```

Deploy je dokončený až keď container beží ako `(healthy)`. Ak container nie je healthy do 3 minút, skontroluj docker logy:

```bash
ssh root@dev.significa.sk "docker logs apps-posterapp-web-1 --tail 100"
```

## Konfiguračné hodnoty (uložené v .env.local)

- `DOKPLOY_URL` = `https://dev.significa.sk`
- `DOKPLOY_COMPOSE_ID` = `P0stErAppC0mp0sEId26`
- `DOKPLOY_REFRESH_TOKEN` = `posterapp_whk_2026_tok`

## Prečo webhook a nie priamo docker

Dokploy webhook automaticky načíta env premenné, zaregistruje deployment v UI, riadi docker network a Traefik routing. Priamy SSH docker compose obchádza tieto vrstvy a môže spôsobiť nekonzistentný stav.

## Troubleshooting

- **"Branch Not Match"**: Skontroluj že `ref` v payload je `refs/heads/main`
- **Build zlyhá**: `ssh root@dev.significa.sk "tail -100 /etc/dokploy/logs/apps-posterapp/*.log"`
- **Container nestartuje**: `ssh root@dev.significa.sk "docker logs apps-posterapp-web-1 --tail 100"`
- **Dokploy dashboard**: https://dev.significa.sk

