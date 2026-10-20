# Rítmika — Canales de release

Rítmika tiene dos entregables independientes que comparten el mismo servidor y
la misma base de datos de canciones.

| Canal | Punto de entrada | Versión actual | Interfaz |
|-------|------------------|----------------|----------|
| **Web / PC** | `https://ritmika.duckdns.org/tv` (alias `/`, `/pc`) | `package.json` → **1.1.1** | Menú y lobby HTML completos, mouse/teclado |
| **Android TV** | APK `/download/ritmika-tv.apk` | `android/app/build.gradle.kts` → **1.0.12** (`versionCode 13`) | La misma UI web; video, audio Bluetooth y Ajustes nativos |

El servidor es compartido: los cambios de API, Socket.io, catálogo y modos se
despliegan con la versión Web y aplican a ambos canales. El APK no necesita
recompilarse para cambios de contenido o de servidor; sí para cambios de la
capa nativa Android (video, audio Bluetooth, puente JS o `native-boot`).

> **Regla de paridad obligatoria:** toda modificación funcional o visual se
> implementa y verifica en **Web/PC y Android TV** en el mismo cambio. No se
> deja una versión atrás. Los números de versión pueden avanzar por separado,
> pero la funcionalidad debe quedar en paridad.

## Paridad obligatoria entre canales

| Área | Web / PC | Android TV |
|------|----------|------------|
| Menú y lobby | `public/tv.html` + `public/js/tv/main-menu.js` | La misma UI web |
| Juego (ruleta, karaoke, votación, podio) | WebView | El mismo WebView |
| Ajustes | Modal HTML | `LobbySettingsDialog.kt` (abierto desde la web) |
| Audio Bluetooth | No aplica | `AudioPanelActivity.kt` |
| Servidor / API / Socket.io | Compartido | Compartido |

- La UI de menú, lobby, QR, jugadores y juego es **compartida**: un cambio en
  `public/` se aplica a ambos canales, pero hay que probarlo en PC y en el APK.
- Los únicos cambios que requieren trabajo Android específico son los de la
  capa nativa: video ExoPlayer, audio Bluetooth, puente JS y `native-boot`.
- Las excepciones de plataforma se documentan y se verifica que la otra
  versión no se rompa.
- Checklist mínimo: probar `/tv` en PC, probar el APK en Android, ejecutar
  `npm run test:all`, desplegar web y publicar OTA si cambió el APK.

---

## Web / PC

- **URL recomendada:** `/tv`.
- `/` y `/pc` sirven la misma página.
- La interfaz es la versión HTML de `public/tv.html`: menú Palenque Arcade,
  lobby, QR, ajustes HTML y juego.
- La versión se muestra en el menú como `v1.1.1 · WEB PC`.
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
La UI es la misma que usa Android; la diferencia es que Android agrega
`?native=1`, el video nativo, el panel de audio Bluetooth y el modal nativo de
Ajustes.

---

## Android TV

- El APK carga `https://ritmika.duckdns.org/tv?native=1`.
- Usa **la misma UI web** que PC; `native-boot.js` oculta preboot/bootloader y
  entra directo al menú.
- La capa nativa conserva ExoPlayer, el panel de audio Bluetooth y el modal de
  Ajustes.
- La versión del APK es independiente de la versión Web.
- El manifiesto OTA está en `/download/latest.json` y el APK estable en
  `/download/ritmika-tv.apk`.

### Publicar una versión nueva

```bash
export ANDROID_HOME="$HOME/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
android/scripts/publish_ota.sh patch "Android TV vuelve a la UI web"
```

El script incrementa `versionCode`/`versionName`, compila `assembleRelease`,
calcula SHA-256, sube el APK y actualiza `latest.json`.

### Instalar en el equipo de prueba

```bash
ADB="$HOME/Android/sdk/platform-tools/adb"
$ADB connect <IP-del-equipo>:<puerto-ADB>
$ADB -s <IP-del-equipo>:<puerto-ADB> install -r android/app/build/outputs/apk/release/app-release.apk
```

La app se actualiza sola vía `UpdateManager` cuando `latest.json` tiene un
`versionCode` mayor.

---

## Reglas de convivencia

1. **Paridad obligatoria.** Toda modificación funcional o visual se implementa
   y verifica en Web/PC y Android TV en el mismo cambio. No se deja una versión
   atrás; la UI es compartida, pero se prueba en los dos canales.
2. **No mezclar bumps.** Un cambio solo de web sube `package.json`; un cambio
   de la capa nativa Android sube `android/app/build.gradle.kts` con
   `publish_ota.sh`. Los bumps son independientes, pero la funcionalidad debe
   quedar en paridad.
3. **PC y Android usan la misma UI web.** Android agrega `?native=1` para el
   arranque directo, el video ExoPlayer, el audio Bluetooth y los Ajustes
   nativos.
4. **Android siempre usa `/tv?native=1`.** No hay shell nativo duplicado.
5. **Desplegar Web antes del APK** si el APK cambia de ruta o depende de un
   endpoint nuevo.
6. **Los cambios de servidor son compartidos.** Después de tocar
   `server/`, desplegar Web y ejecutar `npm run test:all`.
7. **No commitear** `tools/karaoke-factory/` ni artefactos de staging sin
   decisión explícita; es material de trabajo aparte.

---

## Tags

- `web-v1.1.1` — release Web/PC.
- `android-v1.0.12` — release Android TV.

## Versiones

- Web / PC: `1.1.1`.
- Android TV: `1.0.12` (`versionCode 13`).
- La app Android muestra su versión en el manifiesto OTA; la web la muestra en
  el menú y la recibe por `server_version`.
