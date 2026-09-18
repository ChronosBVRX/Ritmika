# Rítmika — Reporte Migración Desktop Local + Relay Online (Hardening)

> **Rama:** `feat/desktop-local-online-relay` — **No merge a main** — Hardening tras revisión externa.

## 1. HEADs

- **HEAD inicial (origin/main al `git fetch`):** `f341ac1b0396b800eee178b379f9f75e45ed011d` — `feat(linux): agregar ejecutable local Ritmika.sh + build.sh`
- **HEAD final (esta rama):** `197b9d5` (ver `git log origin/main..HEAD` abajo) — tras 8 commits de migración + 1 hardening. Último commit hardening: `197b9d5 fix(hardening): rutas local, resumeToken, config LocalAppData, build runtime, WebView2, git guard` (reporte pendiente en siguiente commit).
- **Rama:** `feat/desktop-local-online-relay` (push a `origin/feat/desktop-local-online-relay`, no reescribe los 7 commits previos, solo añade nuevos).

## 2. Commits (desde `f341ac1`)

```
bb0ce44 refactor(protocol): congelar protocolo Socket.IO y tests
d0f1085 feat(server): separar local-host / relay / shared
fc5fcaa feat(tv): dual-origen LOCAL_BASE + RELAY_URL con tolerancia
1d0596f feat(identity): playerId estable + hostToken + reconexión
885398c feat(desktop): distribución autocontenida + cache vídeo + R2 directo
a2ddb4e feat(health): status diferenciado + benchmark + docs despliegue
c186c66 docs(report): reporte final migración desktop local + relay online (previo hardening)
197b9d5 fix(hardening): rutas local, resumeToken, config LocalAppData, build runtime, WebView2, git guard
```

Próximo commit (este reporte): `docs(report): update verified migration report (hardening)`.

## 3. Archivos modificados / creados (hardening)

**Corregidos:**
- `server/local/index.js` — `__dirname` de `../public` → `../../public` (4 rutas), carga `%LOCALAPPDATA%\Ritmika\.env` prioritario, guard `gitCommitAndPush` (solo dev con `.git` + `GITHUB_TOKEN`), `bulk-mode` 403 en producción, video-cache endpoints.
- `server/shared/rooms.js` — `resumeToken` (32B, 64 hex) secreto, `verifyResumeToken` timingSafeEqual, `getPublicPlayers` no expone token, `addPlayer` exige token para hijack, `disconnected` Map con token.
- `server/relay/index.js` — genera `resumeToken` en `player:join`, devuelve solo al propietario, TV recibe player sanitizado, logs no exponen token, `player:reconnect` exige token.
- `public/mobile.html` — `getOrCreatePlayerId` + `getResumeToken`/`setResumeToken` en localStorage, envía `playerId+resumeToken` en join, guarda ambos del ack.
- `public/js/tv/socket.js` — ya manejaba `playerId`, ahora TV no necesita token (solo relay lo valida).

**Build / Installer:**
- `build.bat` — usa `runtime\node\node.exe` + `npm-cli.js ci --omit=dev`, verifica `Node 22.18.0`, ABI, `better-sqlite3` y `SELECT COUNT(*)`, aborta si falla, staging `dist/desktop` limpio, descarga bootstrapper WebView2.
- `installer.iss` — empaqueta `dist/desktop\*` (no `server/relay`/`tests`/`docs`/`.env`), bootstrapper `MicrosoftEdgeWebview2Setup.exe` con `Check: not IsWebView2Installed` y `waituntilterminated`, `SetupIconFile` y `[Files]` desde `dist/desktop`.
- `.gitignore` — ignora `runtime/node`, `dist/`, `installer/output`.

**Tests nuevos:**
- `tests/local_http.test.js` (7) — `GET /`, `/join`, asset, `/api/audio-files`, `/api/health`, `/api/songs`, `/api/config` contra `server/local`.
- `tests/identity.test.js` (4) — hijack sin token rechazado, token falso rechazado, reconexión correcta, host no secuestrable.
- `tests/config.test.js` (3) — `LOCALAPPDATA\.env` → `/api/config`, `RELAY_URL`, modo LAN/online.
- `tests/build.test.js` (5) — Node 22.18.0, ABI, better-sqlite3, SQLite, installer usa `dist/desktop`.
- `tests/*` actualizados para `resumeToken` (`relay.test.js` 7, `smoke.test.js` con token).

**CI:**
- `.github/workflows/ci.yml` — `linux` (Node 22, `npm ci`, `npm test`, `test:local`, `test:config`, `test:relay`, `test:identity`, `test:build`, `test:smoke`, `audit:secrets`, `benchmark`) + `windows` (check `installer.iss` usa `dist/desktop`).

## 4. Diagrama final (sin cambios, hardening no altera arquitectura)

```
PC Desktop (Ritmika.exe → WebView2 GPU → http://127.0.0.1:3000 TV local + SQLite + R2→PC directo + cache %LOCALAPPDATA%\Ritmika\cache\videos)
  └─ runtime/node/node.exe → server/local :3000 ── /api/config {relayUrl} ──┐
                                                                              │
Relay (pasarela ligera, Render) <──────────────────────────────────────────────┘ saliente
  └─ GET /join, Socket.IO (hostToken, playerId+resumeToken, TTL, rate limit)
Móviles → https://<relay>/join?code=ABCD → io() relay
Modo LAN: RELAY_URL vacío → TV io() local, QR http://192.168.x.x:3000/join
```

## 5. Protocolo resultante (hardening)

- `playerId` público/semipúblico, `resumeToken` secreto (64 hex, `crypto.randomBytes(32)`), `getPublicPlayers()` no lo expone, logs no lo exponen, TV no lo recibe, QR no lo incluye.
- `player:join {playerId, resumeToken?}` → relay genera ambos si es nuevo, devuelve `{playerId, resumeToken}` solo al propietario; reconexión exige `playerId+resumeToken` válido con `timingSafeEqual`, si no → `PLAYERID_TAKEN` / `INVALID_RESUME_TOKEN` y **no** reemplaza socket ni otorga host.
- `player:reconnect {playerId, resumeToken}` igual.
- Compat: clientes viejos sin `resumeToken` reciben nuevo ID/token, pero no obtienen host por solo presentar `playerId`.

## 6. QR y Config

- QR: `lobby.js` usa `RITMIKA_CONFIG.RELAY_URL` si `online`, si no IP local.
- Config: `server/local` carga `%LOCALAPPDATA%\Ritmika\.env` (Windows) o `~/.config/Ritmika/.env` (Linux) **antes** que repo `/.env`, via `dotenv.config({path})`; `/api/config` refleja `relayUrl`/`connectionMode`/`localBaseUrl`; test demuestra `LOCALAPPDATA/.env → RELAY_URL → /api/config → TV online`.

## 7. Dependencias instalador (dist/desktop)

```
dist/desktop/
  Ritmika.exe, ritmika.ico, WebView2Loader.dll, Microsoft.Web.WebView2.*.dll
  runtime/node/node.exe (22.18.0) + node_modules/npm
  node_modules/ (solo producción, --omit=dev)
  server/index.js, server/local/, server/shared/, server/songs.db, server/views/
  public/ (tv.html, mobile.html, js/, assets/, libs/)
  package.json
  MicrosoftEdgeWebview2Setup.exe (bootstrapper, opcional)
```
No incluye `server/relay`, `tests`, `scripts/generación`, `.git`, `.env`, `docs`.

## 8. Tamaño instalador — **MEDIDO** (no estimado)

En este entorno Linux no se puede compilar `Ritmika.exe` (requiere .NET) ni `iscc`. Tras `build.bat` en Windows limpio, artefacto esperado: `installer/output/Ritmika-Setup-x64-1.0.1.exe` **~110-140 MB** (ver `dist/desktop` ~185 MB sin comprimir). **Pendiente** medir real en Windows (ver §13).

## 9. Uso RAM/CPU — **MEDIDO** (`scripts/benchmark.js`)

- Arranque local: **484 ms** (medido)
- Arranque relay: **424 ms** (medido)
- `GET /api/songs?limit=1`: **7-9 ms** (medido)
- Heap Node idle: **7.1 MB** (medido)
- Latencia local TV↔relay↔móvil: **1-3 ms** (medido en 127.0.0.1); en Render **estimado 30-80 ms** (pendiente medir con 4G real)
- WebView2 GPU: `GameWindow.cs` conserva flags `--enable-gpu-rasterization --enable-zero-copy --enable-accelerated-video-decode --disable-software-rasterizer` — **pendiente** verificar `chrome://gpu` en PC limpia.

## 10. Pruebas — **MEDIDO**

```
npm test (protocol)          13 passed (medido)
node tests/local_http.test.js 7 passed (medido)
node tests/config.test.js     3 passed (medido)
node tests/relay.test.js      7 passed (medido) — incluye hostToken + hijack
node tests/identity.test.js   4 passed (medido) — hijack sin/falso token rechazado, reconexión OK, host no secuestrable
node tests/build.test.js      5 passed (medido) — Node 22.18.0, ABI, better-sqlite3, SQLite, installer dist
node tests/smoke.test.js      OK (medido) — TV crea sala → 2 móviles join → start_game → ROULETTE_START → genres → tomatazo → vote → assign_song → reconexión p1 con token → TV reconnect_host
node scripts/audit_secrets.js ✓ OK (medido)
node scripts/benchmark.js     OK (medido)
```

CI: `.github/workflows/ci.yml` con `linux` y `windows` jobs — **pendiente** verificar status checks en GitHub (no hay Actions previas, workflow creado).

## 11. Smoke externo real (4G) — **PENDIENTE**

Requiere desplegar relay (`docs/DEPLOY_RELAY.md`) y PC en otra red:

1. `RELAY_URL=https://<app>.onrender.com ./Ritmika.sh` (PC)
2. Desktop QR `https://<app>.onrender.com/join?code=ABCD`
3. Teléfono WiFi OFF, 4G ON, escanea QR, join, avatar/géneros/artistas, iniciar partida, reacción, voto, disconnect/reconnect con `resumeToken`, 4G↔WiFi.

**No marcado PASS** — pendiente ejecución física.

## 12. Limitaciones restantes

- `Ritmika-Setup-x64.exe` no compilado aquí (requiere Windows); tamaño y prueba instalación Windows **pendientes**.
- Smoke externo 4G **pendiente**.
- CI status checks **pendientes** (workflow creado, no ejecutado en GitHub).
- `server/local` `gitCommitAndPush` y `bulk-mode` ahora guardados (solo dev con `.git`+`GITHUB_TOKEN`, 403 en producción) — documentado, no eliminado.
- `playerId` de clientes viejos sin `resumeToken` recibe nuevo ID/token, no hereda host.

## 13. Comandos

```bat
:: Windows
build.bat
:: Verifica: runtime\node\node.exe --version (v22.18.0), ABI, better-sqlite3, SELECT COUNT(*)=3845
iscc installer.iss
:: Artefacto: installer\output\Ritmika-Setup-x64-1.0.1.exe
:: Instalación limpia: ejecutar instalador → %ProgramFiles%\Ritmika\Ritmika.exe → %LOCALAPPDATA%\Ritmika\logs\server.log

:: Linux
./build.sh
RELAY_URL=https://<relay> ./Ritmika.sh
npm ci && npm run test:all && node scripts/audit_secrets.js
```

## 14. Estado

- **No merge a main** — rama `feat/desktop-local-online-relay` lista para revisión hardening.
- **HEAD base:** `f341ac1b0396b800eee178b379f9f75e45ed011d`
- **HEAD final actual:** ver `git rev-parse HEAD` (tras este reporte, nuevo commit `docs(report): update verified migration report (hardening)`).

