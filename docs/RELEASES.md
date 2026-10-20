# Rítmika — Canales de release

Rítmika tiene dos entregables independientes que comparten el mismo servidor y
la misma base de datos de canciones.

| Canal | Punto de entrada | Versión actual | Interfaz |
|-------|------------------|----------------|----------|
| **Web / PC** | `https://ritmika.duckdns.org/tv` (alias `/`, `/pc`) | `package.json` → **1.1.0** | Menú y lobby HTML completos, mouse/teclado |
| **Android TV** | APK `/download/ritmika-tv.apk` | `android/app/build.gradle.kts` → **1.0.11** (`versionCode 12`) | Shell nativo Kotlin para menú/lobby; WebView para el juego |

El servidor es compartido: los cambios de API, Socket.io, catálogo y modos se
despliegan con la versión Web y aplican a ambos canales. El APK no necesita
recompilarse para cambios de contenido o de servidor; sí para cambios del shell
nativo.

> **Regla de paridad obligatoria:** toda modificación funcional o visual se
> implementa y verifica en **Web/PC y Android TV** en el mismo cambio. No se
> deja una versión atrás. Los números de versión pueden avanzar por separado,
> pero la funcionalidad debe quedar en paridad.

## Paridad obligatoria entre canales

| Área | Web / PC | Android TV |
|------|----------|------------|
| Menú y lobby | `public/tv.html` + `public/js/tv/main-menu.js` | `NativeShellView.kt` |
| Juego (ruleta, karaoke, votación, podio) | WebView | El mismo WebView |
| Ajustes | Modal HTML | `LobbySettingsDialog.kt` |
| Audio Bluetooth | No aplica | `AudioPanelActivity.kt` |
| Servidor / API / Socket.io | Compartido | Compartido |

- Si un cambio toca menú, lobby, QR, jugadores, ajustes o navegación, hay que
  actualizar **las dos implementaciones**, no solo la web.
- Si un cambio toca el juego, suele vivir en el WebView compartido; aun así se
  verifica en PC y en el APK.
- Las únicas excepciones son funciones exclusivas de una plataforma (por
  ejemplo Bluetooth/A2DP en Android). Se documenta la excepción y se verifica
  que la otra versión no se rompa.
- Checklist mínimo: probar `/tv` en PC, probar el APK en Android, ejecutar
  `npm run test:all`, desplegar web y publicar OTA si cambió el APK.

---

## Web / PC

- **URL recomendada:** `/tv`.
- `/` y `/pc` sirven la misma página.
- La interfaz es la versión HTML de `public/tv.html`: menú Palenque Arcade,
  lobby, QR, ajustes HTML y juego.
- La versión se muestra en el menú como `v1.1.0 · WEB PC`.
- La versión vive en `package.json` y `package-lock.json`.

### Desplegar

```bash
ssh -i /tmp/opencode/oci_key_dec.pem opc@159.54.146.146 \
  'cd /opt/ritmika-app && git pull --ff-only origin main && sudo docker compose build && sudo docker compose up -d'
```

### Verificar

```bash
curl -fsS -o /dev/null -w '%{http_code}\n' https://ritmika.duckdns.org/tv
curl -fsS -o /dev/null -w '%{http_code}\n' https://ritmika.duckdns.org/pc
curl -fsS -o /dev/null -w '%{http_code}\n' https://ritmika.duckdns.org/join
```

Abrir `/tv` en una PC debe mostrar el menú HTML y el distintivo `WEB PC`.
No debe aparecer el shell nativo: este solo se activa con `?native=1&shell=1`
y el puente `AndroidNative`.

---

## Android TV

- El APK carga `https://ritmika.duckdns.org/tv?native=1&shell=1`.
- El shell nativo pinta menú y lobby; el WebView queda activo fuera del
  viewport como motor de sala/socket y se muestra al empezar la partida.
- La versión del APK es independiente de la versión Web.
- El manifiesto OTA está en `/download/latest.json` y el APK estable en
  `/download/ritmika-tv.apk`.

### Publicar una versión nueva

```bash
export ANDROID_HOME="$HOME/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
android/scripts/publish_ota.sh patch "Shell nativo de menu y lobby"
```

El script incrementa `versionCode`/`versionName`, compila `assembleRelease`,
calcula SHA-256, sube el APK y actualiza `latest.json`.

### Instalar en el equipo de prueba

```bash
ADB="$HOME/Android/sdk/platform-tools/adb"
$ADB -s 192.168.1.124:46005 install -r android/app/build/outputs/apk/release/app-release.apk
```

La app se actualiza sola vía `UpdateManager` cuando `latest.json` tiene un
`versionCode` mayor.

---

## Reglas de convivencia

1. **Paridad obligatoria.** Toda modificación funcional o visual se implementa
   y verifica en Web/PC y Android TV en el mismo cambio. No se deja una versión
   atrás; si toca menú/lobby/ajustes, se actualizan HTML y shell nativo.
2. **No mezclar bumps.** Un cambio solo de web sube `package.json`; un cambio
   del APK sube `android/app/build.gradle.kts` con `publish_ota.sh`. Los bumps
   son independientes, pero la funcionalidad debe quedar en paridad.
3. **PC nunca usa `shell=1`.** El menú/lobby HTML es la versión de PC.
4. **Android siempre usa `/tv?native=1&shell=1`.** El shell nativo se muestra
   solo cuando existe `AndroidNative` y el flag `shell=1`.
5. **Desplegar Web antes del APK** si el APK cambia de ruta o depende de un
   endpoint nuevo.
6. **Los cambios de servidor son compartidos.** Después de tocar
   `server/`, desplegar Web y ejecutar `npm run test:all`.
7. **No commitear** `tools/karaoke-factory/` ni artefactos de staging sin
   decisión explícita; es material de trabajo aparte.

---

## Tags

- `web-v1.1.0` — release Web/PC.
- `android-v1.0.11` — release Android TV.

## Versiones

- Web / PC: `1.1.0`.
- Android TV: `1.0.11` (`versionCode 12`).
- La app Android muestra su versión en el manifiesto OTA; la web la muestra en
  el menú y la recibe por `server_version`.
