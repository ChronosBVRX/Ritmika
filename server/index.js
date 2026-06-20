/**
 * ============================================================
 *  RÍTMIKA — SERVIDOR CENTRAL (Pasarela Socket.io)
 *  Rol: Servidor Tonto. Solo enruta eventos JSON entre la TV
 *       y los celulares. CERO lógica de juego aquí.
 * ============================================================
 */

const express = require('express');
const compression = require('compression');
const http = require('http');
const https = require('https');
const os = require('os');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const internalIp = require('internal-ip');
require('dotenv').config();

function isLocalOrigin(origin) {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    const hostname = url.hostname;
    return hostname === 'localhost' || 
           hostname === '127.0.0.1' || 
           hostname.startsWith('192.168.') || 
           hostname.startsWith('10.') || 
           /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
           hostname.endsWith('.local');
  } catch (e) {
    return false;
  }
}

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

// ── Video configuration ───────────────────────────────────────
const NATIVE_VIDEO_FORMATS = ['video/mp4', 'video/webm', 'video/ogg'];
const STREAMABLE_TYPES = ['application/octet-stream', 'binary/octet-stream', 'application/binary'];
let ffmpegAvailable = false;

// Check if FFmpeg is available at startup
function checkFFmpeg() {
  const test = spawn('ffmpeg', ['-version'], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  const timer = setTimeout(() => { test.kill(); ffmpegAvailable = false; }, 5000);
  test.on('error', () => { clearTimeout(timer); ffmpegAvailable = false; });
  test.on('exit', (code) => {
    clearTimeout(timer);
    ffmpegAvailable = code === 0;
    console.log(`[Video Proxy] FFmpeg ${ffmpegAvailable ? 'disponible' : 'NO disponible'} — transcodificación ${ffmpegAvailable ? 'activada' : 'desactivada'}`);
  });
}
checkFFmpeg();

function isNativeFormat(contentType, contentDisposition = '') {
  const ct = (contentType || '').toLowerCase();
  const cd = (contentDisposition || '').toLowerCase();

  // Forzar transcodificación para formatos que sabemos que no son nativos,
  // incluso si Google Drive los manda como application/octet-stream.
  if (cd.includes('.avi') || cd.includes('.mkv') || cd.includes('.flv') || cd.includes('.wmv')) {
    return false;
  }

  return NATIVE_VIDEO_FORMATS.some(f => ct.includes(f)) || STREAMABLE_TYPES.some(t => ct.includes(t));
}

const app = express();
app.use(compression());
const httpServer = http.createServer(app);

// ── Socket.io con CORS permisivo local (LAN party) ────────────
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (isLocalOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Origin not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
  },
});

// ── Servir archivos estáticos del cliente ────────────────────
const oneYear = 31536000000;
app.use(express.static(path.join(__dirname, '../public'), {
  maxAge: oneYear,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

// ── Ruta raíz → TV principal ─────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/tv.html'));
});

// ── Ruta para celulares ──────────────────────────────────────
app.get('/join', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/mobile.html'));
});

// ── Diagnóstico de video ────────────────────────────────────
app.get('/test-video', (req, res) => {
  res.send(`<!DOCTYPE html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rítmika — Test de Video</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0f172a;color:#e2e8f0;font-family:system-ui,sans-serif;padding:1rem}h1{color:#facc15;margin-bottom:1rem}
.video-box{background:#1e293b;border:2px solid #334155;border-radius:12px;padding:1rem;margin-bottom:1rem}
video{width:100%;max-height:400px;background:#000;border-radius:8px}
.info{font-size:0.85rem;color:#94a3b8;margin-top:0.5rem}
.error{color:#ef4444;font-weight:bold}
.ok{color:#22c55e;font-weight:bold}
.btn{background:#facc15;color:#111827;border:none;padding:0.5rem 1rem;border-radius:8px;font-weight:bold;cursor:pointer;margin:0.25rem}
.btn:hover{background:#e6b800}
.btn-sm{padding:0.25rem 0.5rem;font-size:0.8rem}
select{width:100%;padding:0.5rem;border-radius:8px;margin-bottom:0.5rem;background:#334155;color:#e2e8f0;border:1px solid #475569}
.log{background:#0f172a;border:1px solid #334155;border-radius:8px;padding:0.5rem;font-family:monospace;font-size:0.75rem;max-height:200px;overflow-y:auto;margin-top:0.5rem}
</style></head><body>
<h1>🎤 Test de Video Proxy</h1>
<div class="video-box">
  <select id="songSelect"><option value="">— Selecciona una canción —</option></select>
  <div><button class="btn" id="loadBtn">🎬 Cargar video</button>
  <button class="btn btn-sm" id="simpleBtn">🔗 Probar URL directa</button></div>
  <video id="testVideo" controls playsinline></video>
  <div id="status" class="info">Esperando...</div>
  <div id="log" class="log"></div>
</div>
<script>
const v=document.getElementById('testVideo'),s=document.getElementById('songSelect'),st=document.getElementById('status'),lg=document.getElementById('log');
function log(t){const d=document.createElement('div');d.textContent='['+new Date().toLocaleTimeString()+'] '+t;lg.appendChild(d);lg.scrollTop=lg.scrollHeight}
function setStatus(t,c){st.innerHTML=t;st.style.color=c||'#94a3b8'}
async function loadSongs(){try{
const r=await fetch('/api/songs',{signal:AbortSignal.timeout(10000)});const d=await r.json();
if(Array.isArray(d)&&d.length>0){d.forEach(song=>{const o=document.createElement('option');o.value=song.url||song.id;o.textContent=song.title+' — '+song.artist;s.appendChild(o)});log('Catálogo: '+d.length+' canciones cargadas');setStatus(d.length+' canciones disponibles','#22c55e')}
else{setStatus('Catálogo vacío','#ef4444')}
}catch(e){setStatus('Error cargando catálogo: '+e.message,'#ef4444');log('Error: '+e.message)}}
loadSongs();
document.getElementById('loadBtn').onclick=()=>{
const url=s.value;if(!url){setStatus('Selecciona una canción','#ef4444');return}
const gdriveMatch=url.match(/[?&]id=([^&]+)/)||url.match(/\\/file\\/d\\/([^\\/]+)/);
let proxyUrl=url;let fileId='none';
if(gdriveMatch&&gdriveMatch[1]){fileId=gdriveMatch[1];proxyUrl='/api/video-proxy?id='+fileId}
log('URL original: '+url);log('File ID: '+fileId);log('Proxy URL: '+proxyUrl);
setStatus('Cargando: '+proxyUrl,'#facc15');
v.src=proxyUrl;v.muted=true;v.play().catch(()=>{});
v.onerror=()=>{setStatus('❌ Error cargando video','#ef4444');log('ERROR: video.onerror disparado')};
v.onplaying=()=>{setStatus('✅ Reproduciendo','#22c55e');v.muted=false;log('Reproduciendo OK')};
v.onwaiting=()=>{setStatus('⏳ Buffering...','#facc15')};
};
document.getElementById('simpleBtn').onclick=()=>{
const url=s.value;if(!url){setStatus('Selecciona una canción','#ef4444');return}
const gdriveMatch=url.match(/[?&]id=([^&]+)/)||url.match(/\\/file\\/d\\/([^\\/]+)/);
if(gdriveMatch&&gdriveMatch[1]){const pu='/api/video-proxy?id='+gdriveMatch[1];
log('Probando con fetch HEAD...');
fetch(pu,{method:'HEAD'}).then(r=>{log('Status: '+r.status+' '+r.statusText);log('Content-Type: '+(r.headers.get('content-type')||'?'));setStatus('HEAD OK: '+r.status,'#22c55e')}).catch(e=>{log('HEAD error: '+e.message);setStatus('HEAD falló: '+e.message,'#ef4444')})}
};
</script></body></html>`);
});

// ── QR codes locales (offline, sin Google Charts) ─────────────
const QRCode = require('qrcode');

app.get('/qr-game', (req, res) => {
  const ip = getLocalIP();
  const port = process.env.PORT || 3000;
  const baseUrl = process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_URL || `http://${ip}:${port}`;
  const url = `${baseUrl}/join`;
  res.setHeader('Cache-Control', 'no-cache');
  QRCode.toFileStream(res, url, { type: 'png', width: 400, margin: 2, color: { dark: '#000', light: '#fff' } });
});

app.get('/qr-wifi', (req, res) => {
  const ssid = process.env.HOTSPOT_SSID || 'Ritmika';
  const pass = process.env.HOTSPOT_PASSWORD || 'Ritmika2026';
  const wifiStr = `WIFI:S:${ssid};T:WPA;P:${pass};;`;
  res.setHeader('Cache-Control', 'no-cache');
  QRCode.toFileStream(res, wifiStr, { type: 'png', width: 400, margin: 2, color: { dark: '#000', light: '#fff' } });
});

// ── Config de red para el cliente (IP dinámica) ──────────────
app.get('/api/network-config', async (req, res) => {
  let ip;
  try {
    ip = await internalIp.v4();
  } catch (error) {}

  if (!ip || ip === '127.0.0.1') {
    ip = getLocalIP();
  }

  const port = parseInt(process.env.PORT || '3000', 10);
  const baseUrl = process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_URL || `http://${ip}:${port}`;
  res.json({ ip, port, joinUrl: `${baseUrl}/join` });
});

// ── Local Karaoke Catalog Database ───────────────────────────
let songDatabase = [];
const dbPath = path.join(__dirname, 'karaoke_db.json');
try {
  if (fs.existsSync(dbPath)) {
    songDatabase = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  }
} catch (err) {
  console.error('[Server] Could not load karaoke_db.json for bot preferences:', err);
}

app.get('/api/songs', (req, res) => {
  const origin = req.headers.origin;
  if (isLocalOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else {
    return res.status(403).json({ error: 'CORS not allowed' });
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  console.log('[Server] GET /api/songs from ' + (req.ip || req.connection?.remoteAddress || '?'));
  if (songDatabase.length > 0) {
    return res.json(songDatabase);
  }
  if (fs.existsSync(dbPath)) {
    try {
      songDatabase = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      return res.json(songDatabase);
    } catch (err) {
      console.error('Error reading local karaoke_db.json:', err);
    }
  }
  res.json([]);
});

// ── Health check for bootloader ──────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    server: true,
    catalog: songDatabase.length > 0,
    catalogCount: songDatabase.length,
    ffmpeg: ffmpegAvailable,
  });
});

// ── Google Drive Video Proxy (Bypasses CORS/CORP + transcodifica formatos no-nativos) ──
app.get('/api/video-proxy', (req, res) => {
  const fileId = req.query.id;
  if (!fileId || typeof fileId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
    return res.status(400).json({ error: 'Invalid or missing id parameter' });
  }

  const PROXY_TIMEOUT = 30000;
  const MAX_REDIRECTS = 5;
  let redirectCount = 0;
  let usedConfirm = false;

  let transcodeJob = null; // reference to ffmpeg process

  const cleanup = () => {
    if (transcodeJob) { try { transcodeJob.kill(); } catch {} transcodeJob = null; }
  };

  req.on('close', cleanup);
  res.on('close', cleanup);

  const requestHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };
  if (req.headers.range) {
    requestHeaders['Range'] = req.headers.range;
  }

  function streamFromDrive(urlToStream) {
    const clientReq = https.get(urlToStream, { headers: requestHeaders, timeout: PROXY_TIMEOUT }, (clientRes) => {
      const { statusCode, headers: respHeaders } = clientRes;
      const contentType = (respHeaders['content-type'] || '').toLowerCase();

      // Drain response body on redirect or retry
      const drain = () => { clientRes.resume(); };

      // ─── Redirect handling ─────────────────────────────
      if (statusCode >= 300 && statusCode < 400 && respHeaders.location) {
        drain();
        if (redirectCount++ >= MAX_REDIRECTS) {
          return res.status(502).json({ error: 'Too many redirects from Google Drive' });
        }
        streamFromDrive(respHeaders.location);
        return;
      }

      // ─── Virus scan warning (HTML) ────────────────────
      if (contentType.includes('text/html')) {
        drain();
        if (!usedConfirm) {
          usedConfirm = true;
          redirectCount = 0;
          const sep = urlToStream.includes('?') ? '&' : '?';
          console.log(`[Video Proxy] HTML for ${fileId}, retrying with confirm=t`);
          streamFromDrive(urlToStream + sep + 'confirm=t');
        } else {
          console.error(`[Video Proxy] File ${fileId} still HTML after confirm=t`);
          return res.status(502).json({ error: 'Google Drive requires manual confirmation. File too large or blocked.' });
        }
        return;
      }

      // ─── Decide: native stream or FFmpeg transcode ────
      if (isNativeFormat(contentType, respHeaders['content-disposition'])) {
        // Native browser format → stream directly
        console.log(`[Video Proxy] Nativo → streaming ${fileId} (${contentType})`);
        res.status(statusCode);
        ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control'].forEach(h => {
          if (respHeaders[h]) res.setHeader(h, respHeaders[h]);
        });
        clientRes.pipe(res);
      } else if (ffmpegAvailable) {
        // Unsupported format + FFmpeg disponible → transcodificar a MP4 fragmentado
        console.log(`[Video Proxy] Transcodificando ${fileId} (${contentType}) → MP4`);
        cleanup();

        res.status(200);
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Accept-Ranges', 'none');
        res.setHeader('Cache-Control', 'no-cache');

        transcodeJob = spawn('ffmpeg', [
          '-i', 'pipe:0',
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-crf', '28',
          '-pix_fmt', 'yuv420p',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-movflags', 'frag_keyframe+empty_moov',
          '-f', 'mp4',
          '-nostdin',
          '-loglevel', 'error',
          'pipe:1'
        ], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });

        clientRes.pipe(transcodeJob.stdin);
        transcodeJob.stdout.pipe(res);

        transcodeJob.stderr.on('data', (d) => {
          console.log(`[FFmpeg:${fileId.slice(0,8)}] ${d.toString().trim()}`);
        });

        transcodeJob.on('error', (err) => {
          console.error(`[FFmpeg] spawn error for ${fileId}:`, err.message);
          if (!res.headersSent) res.status(500).json({ error: 'Error al iniciar FFmpeg para transcodificación.' });
        });

        transcodeJob.on('exit', (code) => {
          if (code !== 0 && code !== null) {
            console.warn(`[FFmpeg] ${fileId} exit code ${code}`);
          }
          transcodeJob = null;
          cleanup();
        });
      } else {
        // Formato no nativo y FFmpeg no disponible
        drain();
        console.error(`[Video Proxy] Formato no soportado y FFmpeg no disponible: ${fileId} (${contentType})`);
        return res.status(415).json({
          error: `Formato de video no compatible: ${contentType}. Instala FFmpeg o reconvierte a MP4.`,
          format: contentType
        });
      }
    });

    clientReq.on('error', (err) => {
      console.error(`[Video Proxy] Network error for ${fileId}:`, err.message);
      cleanup();
      if (!res.headersSent) {
        if (err.code === 'ECONNRESET') {
          res.status(502).json({ error: 'Connection reset by Google Drive. File may not be publicly accessible.' });
        } else {
          res.status(500).json({ error: 'Error loading video from Google Drive: ' + err.message });
        }
      }
    });

    clientReq.on('timeout', () => {
      clientReq.destroy();
      cleanup();
      console.error(`[Video Proxy] Timeout for ${fileId} after ${PROXY_TIMEOUT}ms`);
      if (!res.headersSent) {
        res.status(504).json({ error: 'Timeout connecting to Google Drive. Check that the file is publicly accessible.' });
      }
    });
  }

  const driveUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download`;
  streamFromDrive(driveUrl);
});

// ── Estado mínimo del servidor (solo metadatos de sala) ──────
/**
 * rooms: Map<roomCode, { tvSocketId: string, players: Map<socketId, playerInfo> }>
 * playerInfo: { name, avatarId, socketId, role: 'tv' | 'player' }
 */
const rooms = new Map();

// ── Helpers ──────────────────────────────────────────────────
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sin O/0/I/1 para evitar confusiones
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function getRoomByTvSocket(socketId) {
  for (const [code, room] of rooms) {
    if (room.tvSocketId === socketId) return { code, room };
  }
  return null;
}

function getRoomByPlayerSocket(socketId) {
  for (const [code, room] of rooms) {
    if (room.players.has(socketId)) return { code, room };
  }
  return null;
}

function getPublicPlayerList(room) {
  return Array.from(room.players.values()).map(p => ({
    name: p.name,
    avatarId: p.avatarId,
    socketId: p.socketId,
  }));
}

// ════════════════════════════════════════════════════════════
//  LÓGICA DE CONEXIÓN
// ════════════════════════════════════════════════════════════
const lastEventTime = new Map();

function canAct(socketId, cooldownMs = 1000) {
  const now = Date.now();
  const last = lastEventTime.get(socketId) || 0;
  if (now - last < cooldownMs) return false;
  lastEventTime.set(socketId, now);
  return true;
}

const packageVersion = require('../package.json').version;

io.on('connection', (socket) => {
  console.log(`[+] Conexión: ${socket.id}`);
  socket.emit('server_version', packageVersion);

  // ──────────────────────────────────────────────────────────
  // TV: Crea una nueva sala
  // Payload: ninguno
  // Emite → tv:       { type: 'ROOM_CREATED', roomCode }
  // ──────────────────────────────────────────────────────────
  socket.on('tv:create_room', () => {
    // Destruir sala anterior de esta TV si existe
    const oldRoom = getRoomByTvSocket(socket.id);
    if (oldRoom) {
      socket.to(oldRoom.code).emit('game:tv_disconnected', {
        message: 'La partida terminó. La sala fue cerrada.',
      });
      rooms.delete(oldRoom.code);
      console.log(`[SALA] Destruida (restart): ${oldRoom.code}`);
    }

    let code;
    do { code = generateRoomCode(); } while (rooms.has(code));

    rooms.set(code, {
      tvSocketId: socket.id,
      players: new Map(),
    });

    socket.join(code);
    socket.emit('tv:room_created', {
      roomCode: code,
      localIP: getLocalIP(),
      hotspotSSID: process.env.HOTSPOT_SSID || 'Ritmika',
      hotspotPassword: process.env.HOTSPOT_PASSWORD || 'Ritmika2026',
    });
    console.log(`[SALA] Creada: ${code} por TV ${socket.id}`);
  });

  socket.on('tv:close_room', () => {
    const oldRoom = getRoomByTvSocket(socket.id);
    if (oldRoom) {
      socket.to(oldRoom.code).emit('game:tv_disconnected', {
        message: 'La sala ha sido cerrada.',
      });
      rooms.delete(oldRoom.code);
      console.log(`[SALA] Cerrada (Back button): ${oldRoom.code}`);
    }
  });

  // ──────────────────────────────────────────────────────────
  // JUGADOR: Se une a una sala existente
  // Payload: { roomCode, name, avatarId }
  // Emite → jugador:   { type: 'JOIN_ACK', success, roomCode, players }
  // Emite → TV:        { type: 'PLAYER_JOINED', player, players }
  // ──────────────────────────────────────────────────────────
  socket.on('player:join', ({ roomCode, name, avatarId }) => {
    const code = roomCode?.toUpperCase().trim();
    const room = rooms.get(code);

    if (!room) {
      socket.emit('player:join_ack', { success: false, error: 'Sala no encontrada. Revisa el código.' });
      return;
    }

    let cleanName = typeof name === 'string' ? name.trim() : 'Jugador';
    if (cleanName.length > 15) {
      cleanName = cleanName.substring(0, 15);
    }
    if (!cleanName) {
      cleanName = 'Jugador ' + Math.floor(Math.random() * 100);
    }
    cleanName = cleanName.replace(/<[^>]*>/g, '');

    let cleanAvatarId = parseInt(avatarId, 10);
    if (isNaN(cleanAvatarId) || cleanAvatarId < 0 || cleanAvatarId > 7) {
      cleanAvatarId = 0;
    }

    const playerInfo = { name: cleanName, avatarId: cleanAvatarId, socketId: socket.id };
    room.players.set(socket.id, playerInfo);
    socket.join(code);

    const players = getPublicPlayerList(room);

    // Confirmar al jugador
    socket.emit('player:join_ack', { success: true, roomCode: code, players });

    // Notificar a la TV
    io.to(room.tvSocketId).emit('tv:player_joined', { player: playerInfo, players });

    console.log(`[JUGADOR] ${name} (${socket.id}) se unió a sala ${code}`);
  });

  // ──────────────────────────────────────────────────────────
  // JUGADOR → TV: Selección de géneros (Fase de preparación)
  // Payload: { roomCode, genres: string[] }
  // ──────────────────────────────────────────────────────────
  socket.on('player:select_genres', ({ roomCode, genres }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    io.to(room.tvSocketId).emit('tv:player_genres', {
      socketId: socket.id,
      genres,
    });
  });

  // ──────────────────────────────────────────────────────────
  // JUGADOR → TV: Selección de artistas (Gallos)
  // Payload: { roomCode, artists: string[] }
  // ──────────────────────────────────────────────────────────
  socket.on('player:select_artists', ({ roomCode, artists }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    io.to(room.tvSocketId).emit('tv:player_artists', {
      socketId: socket.id,
      artists,
    });
  });

  // ──────────────────────────────────────────────────────────
  // TV → TODOS: Broadcast genérico de estado de juego
  // Payload: { roomCode, event: string, data: object }
  // La TV lo usa para enviar actualizaciones de UI a los móviles
  // ──────────────────────────────────────────────────────────
  socket.on('tv:broadcast', ({ roomCode, event, data }) => {
    socket.to(roomCode).emit('game:update', { event, data });
  });

  // ──────────────────────────────────────────────────────────
  // TV → JUGADOR ESPECÍFICO: Envío privado (ej. asignación de canción)
  // Payload: { targetSocketId, event: string, data: object }
  // ──────────────────────────────────────────────────────────
  socket.on('tv:send_to_player', ({ targetSocketId, event, data }) => {
    io.to(targetSocketId).emit('game:private', { event, data });
  });

  // ──────────────────────────────────────────────────────────
  // JUGADOR → TV: TOMATAZO 🍅
  // Payload: { roomCode, targetName }
  // ──────────────────────────────────────────────────────────
  socket.on('player:tomatazo', ({ roomCode, targetName }) => {
    if (!canAct(socket.id, 2000)) return;
    const room = rooms.get(roomCode);
    if (!room) return;
    const attacker = room.players.get(socket.id);
    let cleanTargetName = typeof targetName === 'string' ? targetName.trim().substring(0, 15).replace(/<[^>]*>/g, '') : 'Alguien';
    io.to(room.tvSocketId).emit('tv:tomatazo', {
      attackerName: attacker?.name || 'Desconocido',
      attackerSocketId: socket.id,
      targetName: cleanTargetName,
    });
    console.log(`[🍅 TOMATAZO] ${attacker?.name} → ${cleanTargetName} en sala ${roomCode}`);
  });

  // ──────────────────────────────────────────────────────────
  // JUGADOR → TV: Emoji de reacción
  // Payload: { roomCode, emoji: '🔥' | '💩' | '⭐' | '😂' }
  // ──────────────────────────────────────────────────────────
  socket.on('player:emoji', ({ roomCode, emoji }) => {
    if (!canAct(socket.id, 500)) return;
    const room = rooms.get(roomCode);
    if (!room) return;
    const sender = room.players.get(socket.id);
    io.to(room.tvSocketId).emit('tv:emoji', {
      senderName: sender?.name || '?',
      emoji,
    });
  });

  // ──────────────────────────────────────────────────────────
  // JUGADOR → TV: Sabotaje de audio (Tío Axolo)
  // Payload: { roomCode }
  // ──────────────────────────────────────────────────────────
  socket.on('player:sabotage_audio', ({ roomCode }) => {
    if (!canAct(socket.id, 3000)) return;
    const room = rooms.get(roomCode);
    if (!room) return;
    io.to(room.tvSocketId).emit('tv:sabotage_audio', {
      socketId: socket.id,
    });
  });

  // ──────────────────────────────────────────────────────────
  // JUGADOR → TV: Voto de calificación
  // Payload: { roomCode, score: number, performerSocketId: string }
  // ──────────────────────────────────────────────────────────
  socket.on('player:vote', ({ roomCode, score, performerSocketId }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    const voter = room.players.get(socket.id);
    if (!voter) return;
    const VALID_SCORES = [10, 30, 60, 100];
    const clampedScore = VALID_SCORES.includes(score) ? score : 10;
    let cleanPerformerSocketId = typeof performerSocketId === 'string' ? performerSocketId.trim() : '';
    if (!room.players.has(cleanPerformerSocketId) && room.tvSocketId !== cleanPerformerSocketId) {
      return;
    }
    io.to(room.tvSocketId).emit('tv:vote', {
      voterName: voter.name,
      voterSocketId: socket.id,
      performerSocketId: cleanPerformerSocketId,
      score: clampedScore,
    });
    console.log(`[VOTO] ${voter.name} → ${clampedScore} pts para ${cleanPerformerSocketId}`);
  });

  // ──────────────────────────────────────────────────────────
  // JUGADOR → TV: Asignación de canción (Ronda 2 - Fuego Cruzado)
  // Payload: { roomCode, targetSocketId, songId }
  // ──────────────────────────────────────────────────────────
  socket.on('player:assign_song', ({ roomCode, targetSocketId, songId }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    const attacker = room.players.get(socket.id);
    io.to(room.tvSocketId).emit('tv:song_assigned', {
      attackerName: attacker?.name || '?',
      attackerSocketId: socket.id,
      targetSocketId,
      songId,
    });
  });

  // ──────────────────────────────────────────────────────────
  // TV: Añade un bot de prueba
  // Payload: { roomCode }
  // ──────────────────────────────────────────────────────────
  socket.on('tv:add_bot', ({ roomCode }) => {
    const code = roomCode?.toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) return;

    const botSocketId = 'bot_' + Math.random().toString(36).substr(2, 9);
    const names = ['Axolote Veloz', 'Catarina Rockera', 'Tlacuache Punk', 'Mariachi Loco', 'Llama Popstar', 'Chiba DJ'];
    const botName = names[room.players.size % names.length] + ' (Bot)';
    const playerInfo = {
      name: botName,
      avatarId: Math.floor(Math.random() * 8),
      socketId: botSocketId,
    };
    room.players.set(botSocketId, playerInfo);

    const players = getPublicPlayerList(room);
    io.to(room.tvSocketId).emit('tv:player_joined', { player: playerInfo, players });

    setTimeout(() => {
      const availableGenres = [...new Set(songDatabase.map(s => s.genre).filter(Boolean))];
      const genresList = availableGenres.length > 0 ? availableGenres : ['pop', 'rock', 'reggaeton', 'banda', 'cumbia', 'ranchera', 'balada'];
      const randomGenres = [];
      const count = Math.min(2, genresList.length);
      while (randomGenres.length < count) {
        const g = genresList[Math.floor(Math.random() * genresList.length)];
        if (!randomGenres.includes(g)) randomGenres.push(g);
      }
      io.to(room.tvSocketId).emit('tv:player_genres', { socketId: botSocketId, genres: randomGenres });
    }, 500);

    setTimeout(() => {
      const availableArtists = [...new Set(songDatabase.map(s => s.artist).filter(Boolean))];
      const artistsList = availableArtists.length > 0 ? availableArtists : ['Luis Miguel', 'Bad Bunny', 'Caifanes', 'Shakira', 'Bronco', 'Maná'];
      const randomArtists = [];
      const count = Math.min(2, artistsList.length);
      while (randomArtists.length < count) {
        const a = artistsList[Math.floor(Math.random() * artistsList.length)];
        if (!randomArtists.includes(a)) randomArtists.push(a);
      }
      io.to(room.tvSocketId).emit('tv:player_artists', { socketId: botSocketId, artists: randomArtists });
    }, 1000);
  });

  // ──────────────────────────────────────────────────────────
  // TV: Inicia la partida (todos los jugadores listos)
  // Payload: { roomCode }
  // ──────────────────────────────────────────────────────────
  socket.on('tv:start_game', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.tvSocketId !== socket.id) return;
    socket.to(roomCode).emit('game:started', {
      message: '¡La fiesta comenzó! 🎤',
    });
    console.log(`[🎮 JUEGO] Iniciado en sala ${roomCode}`);
  });

  // Retransmitir comandos de avance desde los mandos móviles a la TV
  socket.on('player:start_game', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    io.to(room.tvSocketId).emit('tv:start_game_trigger');
  });

  socket.on('player:start_song', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    io.to(room.tvSocketId).emit('tv:start_song_trigger');
  });

  socket.on('player:next_turn', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    io.to(room.tvSocketId).emit('tv:next_turn_trigger');
  });

  // ──────────────────────────────────────────────────────────
  // DESCONEXIÓN
  // ──────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[-] Desconexión: ${socket.id}`);
    lastEventTime.delete(socket.id);

    // Si era una TV, destruir la sala
    const tvRoom = getRoomByTvSocket(socket.id);
    if (tvRoom) {
      const { code, room } = tvRoom;
      // Notificar a todos los jugadores
      socket.to(code).emit('game:tv_disconnected', {
        message: 'La TV se desconectó. La sala fue cerrada.',
      });
      rooms.delete(code);
      console.log(`[SALA] Destruida: ${code} (TV desconectada)`);
      return;
    }

    // Si era un jugador, notificar a la TV
    const playerRoom = getRoomByPlayerSocket(socket.id);
    if (playerRoom) {
      const { code, room } = playerRoom;
      const leavingPlayer = room.players.get(socket.id);
      room.players.delete(socket.id);
      const players = getPublicPlayerList(room);
      io.to(room.tvSocketId).emit('tv:player_left', {
        socketId: socket.id,
        name: leavingPlayer?.name || '?',
        players,
      });
      console.log(`[JUGADOR] ${leavingPlayer?.name} salió de sala ${code}`);
    }
  });
});



// ── Iniciar servidor (0.0.0.0 = accesible desde cualquier dispositivo en red local) ─
const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   🎤  RÍTMIKA SERVER — TÍO AXOLO LISTO    ║');
  console.log(`║   🌐  http://0.0.0.0:${PORT} (LAN)            ║`);
  console.log(`║   📱  Celulares: http://<IP>:${PORT}/join    ║`);
  console.log('║   💡  Modo: PASARELA PURA (sin lógica)     ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log('');
});
