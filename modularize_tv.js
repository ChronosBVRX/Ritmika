/**
 * modularize_tv.js
 * Extrae el bloque JS monolítico de tv.html y lo separa en módulos.
 * Los archivos se crean en public/js/tv/
 * tv.html se actualiza para cargar los módulos en orden.
 */

const fs = require('fs');
const path = require('path');

const TV_PATH = 'public/tv.html';
const OUT_DIR = 'public/js/tv';

// Crear directorio de salida
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

const html = fs.readFileSync(TV_PATH, 'utf8');
const lines = html.split('\n');

// Función helper: extraer líneas [start, end] (1-indexed, inclusive)
function extract(startLine, endLine) {
  return lines.slice(startLine - 1, endLine).join('\n');
}

// =============================================================
// DEFINICIÓN DE MÓDULOS
// Cada módulo: { file, start, end }
// Rango basado en el análisis del archivo
// =============================================================

const modules = [
  {
    file: 'constants.js',
    comment: '// ═══ CONSTANTES ═══',
    // FALLBACK_CATALOG (2064-2081) + boot state machine (2083-2173) +
    // Wipe transition data (2174-2275) + Audio preloader (2276-2329) +
    // AudioContext + loadCatalog + pickSongForPlayer (2330-2522) +
    // AVATARS + RETO_CHALLENGES (2523-2550) +
    // GENRE_BARKS + VOTE_REACTIONS + getGenreBark + getVoteReaction (2551-2970)
    start: 2064,
    end: 2970,
  },
  {
    file: 'state.js',
    comment: '// ═══ ESTADO DEL JUEGO ═══',
    // saveGameState, loadSavedGame, clearSavedGame, TOMATAZO_COST, state obj (2971-3026)
    start: 2971,
    end: 3026,
  },
  {
    file: 'ui.js',
    comment: '// ═══ UI & ANIMACIONES ═══',
    // JackboxFX (3027-3068) + animateLobbyWelcome (3069-3126) +
    // ROUND_SPLASH_DATA + showRoundSplash (3127-3164) +
    // showCountdown (3165-3219) + showScreen (3220-3356)
    start: 3027,
    end: 3356,
  },
  {
    file: 'socket.js',
    comment: '// ═══ SOCKET.IO ═══',
    // Todo el bloque DOMContentLoaded con socket.io (3357-4039)
    start: 3357,
    end: 4039,
  },
  {
    file: 'game.js',
    comment: '// ═══ LÓGICA DE JUEGO ═══',
    // ROULETTE (4040-4502) + KARAOKE PLAYER (4503-4863) +
    // endSong (4864-4976) + nextTurn (4977-5042) +
    // PODIO (5043-5516)
    start: 4040,
    end: 5516,
  },
  {
    file: 'lobby.js',
    comment: '// ═══ LOBBY & FX ═══',
    // LOBBY RENDER HELPERS (5517-5663) +
    // FX: TOMATAZO, EMOJI, SABOTAJE (5664-5791) +
    // AXOLO SYSTEM (5792-6159) +
    // QR DINÁMICO (6160-6224) +
    // PARTICLES BACKGROUND (6225-6267) +
    // UTILITIES (6268-6284) +
    // KEYBOARD SHORTCUTS + debug (6285-6314)
    start: 5517,
    end: 6314,
  },
];

// =============================================================
// EXTRAER Y ESCRIBIR MÓDULOS
// =============================================================

for (const mod of modules) {
  const content = `${mod.comment}\n// Módulo extraído de tv.html\n// ==============================================\n\n` + extract(mod.start, mod.end);
  const outPath = path.join(OUT_DIR, mod.file);
  fs.writeFileSync(outPath, content, 'utf8');
  const lineCount = content.split('\n').length;
  console.log(`✓ ${mod.file} — ${lineCount} líneas (tv.html L${mod.start}-${mod.end})`);
}

// =============================================================
// CONSTRUIR NUEVO tv.html
// =============================================================

// La estructura del nuevo tv.html:
// 1. Todo el HTML hasta la línea 2057 (inclusive) — head + body + styles + DOM
// 2. La etiqueta <script> de bootMusic (solo let bootMusic;)
// 3. Tags de módulos en orden
// 4. El tercer bloque <script> (Unified Keyboard + Gamepad, Mode Logic, Debug) — líneas 6318-6792
// 5. El cuarto bloque <script> (fullscreen) — líneas 6793-6811
// 6. </body></html>

const htmlBeforeScript = lines.slice(0, 2057).join('\n'); // hasta justo antes de <script>
const thirdScriptBlock = extract(6317, 6792); // Keyboard + Mode logic + Debug
const fourthScriptBlock = extract(6793, 6811); // Fullscreen
const closingTags = extract(6812, 6815); // </body></html>

const moduleScriptTags = modules.map(m => `  <script src="/js/tv/${m.file}"></script>`).join('\n');

const newHtml = `${htmlBeforeScript}
<script>
/* ═══════════════════════════════════════════════════════════
   RÍTMIKA TV BRAIN v3 — Modular
   Arquitectura: estado en memoria, servidor es pasarela.
═══════════════════════════════════════════════════════════ */
let bootMusic;
</script>

<!-- ═══ Módulos JS de Rítmika TV ═══ -->
${moduleScriptTags}

${thirdScriptBlock}
${fourthScriptBlock}
${closingTags}`;

fs.writeFileSync(TV_PATH, newHtml, 'utf8');
const newLineCount = newHtml.split('\n').length;
console.log(`\n✓ tv.html actualizado — ${newLineCount} líneas (era ${lines.length})`);
console.log(`  Reducción: ${lines.length - newLineCount} líneas (${Math.round((lines.length - newLineCount) / lines.length * 100)}%)`);
