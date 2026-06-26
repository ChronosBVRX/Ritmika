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
const os = require('os');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const internalIp = require('internal-ip');
require('dotenv').config();

// ── Cloudflare R2 client (presigned URLs) ─────────────────────
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
let r2Client = null;
function getR2Client() {
  if (!r2Client && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY) {
    r2Client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT || 'https://3bb6544fbc15f95620470c922b1a0dfe.r2.cloudflarestorage.com',
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
    console.log('[R2] Client initialized for presigned URLs');
  }
  return r2Client;
}

let renderHostname = '';
if (process.env.RENDER_EXTERNAL_URL) {
  try {
    renderHostname = new URL(process.env.RENDER_EXTERNAL_URL).hostname;
  } catch (e) {}
}

function isLocalOrigin(origin) {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    const hostname = url.hostname;
    
    // Allow Render external URL
    if (renderHostname && hostname === renderHostname) {
      return true;
    }
    
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

// ── Admin auth middleware ────────────────────────────────
function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

const app = express();
app.use(compression());
app.use(express.json());
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
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.sendFile(path.join(__dirname, '../public/tv.html'));
});

// ── Ruta para celulares ──────────────────────────────────────
app.get('/join', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.sendFile(path.join(__dirname, '../public/mobile.html'));
});

// ── Admin: Dashboard de Modos de Juego ───────────────────────
app.get('/admin', requireAdmin, (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.sendFile(path.join(__dirname, 'views/admin_modes.html'));
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

// ── SQLite Database ──────────────────────────────────────
const Database = require('better-sqlite3');
const sqlitePath = path.join(__dirname, 'songs.db');
let db;
try {
  db = new Database(sqlitePath);
  db.pragma('journal_mode = WAL');
  const count = db.prepare('SELECT COUNT(*) as cnt FROM songs').get().cnt;
  console.log(`[DB] SQLite loaded — ${count} songs from songs.db`);
} catch (err) {
  console.error('[DB] Could not open songs.db:', err.message);
  db = null;
}

function isDbReady() {
  return db !== null;
}

function gitCommitAndPush(callback) {
  const gitDir = path.resolve(__dirname, '..');
  const repoUrl = 'https://github.com/ChronosBVRX/Ritmika.git';
  const token = process.env.GITHUB_TOKEN;
  const pushRemote = token ? `https://x-access-token:${token}@github.com/ChronosBVRX/Ritmika.git` : 'origin';
  const cmds = [
    'git add server/songs.db',
    `git diff --cached --quiet || git commit -m "auto: actualizar modos de juego"`,
    `git push ${pushRemote} main`
  ].join(' && ');
  exec(cmds, { cwd: gitDir }, (err, stdout, stderr) => {
    if (err) {
      console.error('[GIT] Error:', stderr || err.message);
      if (callback) callback(err);
    } else {
      console.log('[GIT] songs.db committed and pushed');
      if (callback) callback(null);
    }
  });
}

// ── Filtered songs API ───────────────────────────────────
// Query params:
//   genres   — comma-separated genre filter
//   artists  — comma-separated artist filter (partial match)
//   exclude  — comma-separated song IDs to exclude
//   random   — if "true", ORDER BY RANDOM()
//   limit    — max results (default 100)
//   id       — single song lookup by ID
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

  if (!isDbReady()) return res.json([]);

  // Single song lookup by ID
  if (req.query.id) {
    const song = db.prepare('SELECT * FROM songs WHERE id = ?').get(req.query.id);
    return res.json(song || null);
  }

  let where = [];
  let params = [];

  if (req.query.genres) {
    const genres = req.query.genres.split(',').map(g => g.trim().toLowerCase()).filter(Boolean);
    if (genres.length > 0) {
      where.push(`LOWER(genre) IN (${genres.map(() => '?').join(',')})`);
      params.push(...genres);
    }
  }

  if (req.query.artists) {
    const artists = req.query.artists.split(',').map(a => a.trim()).filter(Boolean);
    if (artists.length > 0) {
      const likeClauses = artists.map(() => `LOWER(artist) LIKE ?`);
      where.push(`(${likeClauses.join(' OR ')})`);
      params.push(...artists.map(a => `%${a.toLowerCase()}%`));
    }
  }

  if (req.query.exclude) {
    const excludeIds = req.query.exclude.split(',').map(e => e.trim()).filter(Boolean);
    if (excludeIds.length > 0) {
      where.push(`id NOT IN (${excludeIds.map(() => '?').join(',')})`);
      params.push(...excludeIds);
    }
  }

  // Filter by game mode
  if (req.query.mode && req.query.mode.toLowerCase() !== 'clasico') {
    const modeStr = req.query.mode.trim().toLowerCase();
    where.push(`LOWER(mode) = ?`);
    params.push(modeStr);
  }

  const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';
  const orderBy = req.query.random === 'true' ? 'ORDER BY RANDOM()' : 'ORDER BY artist, title';
  const limit = Math.min(parseInt(req.query.limit) || 100, 5000);

  const sql = `SELECT * FROM songs ${whereClause} ${orderBy} LIMIT ?`;
  params.push(limit);

  try {
    const songs = db.prepare(sql).all(...params);
    res.json(songs);
  } catch (err) {
    console.error('[DB] Query error:', err.message);
    res.json([]);
  }
});

// ── Artists by genre (for mobile catalog) ────────────────
app.get('/api/artists', (req, res) => {
  const origin = req.headers.origin;
  if (isLocalOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else {
    return res.status(403).json({ error: 'CORS not allowed' });
  }
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!isDbReady()) return res.json([]);

  if (req.query.genres) {
    const genres = req.query.genres.split(',').map(g => g.trim().toLowerCase()).filter(Boolean);
    if (genres.length > 0) {
      const placeholders = genres.map(() => '?').join(',');
      const artists = db.prepare(
        `SELECT DISTINCT artist FROM songs WHERE LOWER(genre) IN (${placeholders}) ORDER BY artist`
      ).all(...genres).map(r => r.artist);
      return res.json(artists);
    }
  }

  const artists = db.prepare('SELECT DISTINCT artist FROM songs ORDER BY artist').all().map(r => r.artist);
  res.json(artists);
});

// ── Artist map by genre (for mobile) ─────────────────────
app.get('/api/artist-map', (req, res) => {
  const origin = req.headers.origin;
  if (isLocalOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else {
    return res.status(403).json({ error: 'CORS not allowed' });
  }
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!isDbReady()) return res.json({});

  const mode = req.query.mode ? req.query.mode.trim().toLowerCase() : null;
  let query = 'SELECT DISTINCT genre, artist FROM songs WHERE genre IS NOT NULL';
  let params = [];

  if (mode && mode !== 'clasico') {
    query += " AND LOWER(mode) = ?";
    params.push(mode);
  }

  query += ' ORDER BY genre, artist';
  
  const rows = db.prepare(query).all(...params);
  const map = {};
  for (const row of rows) {
    const g = (mode && mode !== 'clasico') ? mode : row.genre.toLowerCase();
    if (!map[g]) map[g] = [];
    if (!map[g].includes(row.artist)) {
      map[g].push(row.artist);
    }
  }
  res.json(map);
});

// ── Bulk update modes (Admin) ──
app.put('/api/songs/bulk-mode', requireAdmin, (req, res) => {
  const origin = req.headers.origin;
  if (!isLocalOrigin(origin)) return res.status(403).json({ error: 'CORS not allowed' });
  
  const { songIds, mode } = req.body;
  if (!Array.isArray(songIds)) {
    return res.status(400).json({ error: 'songIds debe ser un array' });
  }

  if (!isDbReady()) return res.status(500).json({ error: 'DB not ready' });

  try {
    const placeholders = songIds.map(() => '?').join(',');
    const sql = `UPDATE songs SET mode = ? WHERE id IN (${placeholders})`;
    const result = db.prepare(sql).run(mode || '', ...songIds);
    if (result.changes > 0) {
      gitCommitAndPush();
    }
    res.json({ success: true, updatedCount: result.changes });
  } catch (err) {
    console.error('[ADMIN] Error updating bulk modes:', err.message);
    res.status(500).json({ error: 'No se pudo actualizar el modo en la BD.' });
  }
});

// ── Room Info (for mobile check before joining) ──
app.get('/api/room/:code', (req, res) => {
  const origin = req.headers.origin;
  if (isLocalOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else {
    return res.status(403).json({ error: 'CORS not allowed' });
  }
  const code = req.params.code ? req.params.code.toUpperCase() : '';
  const room = rooms.get(code);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  res.json({ mode: room.mode || 'clasico' });
});

// ── Audio files listing (for preloader) ──
app.get('/api/audio-files', (req, res) => {
  const audioDir = path.join(__dirname, '../public/assets/audio');
  fs.readdir(audioDir, (err, files) => {
    if (err) return res.status(500).json({ error: 'Cannot read audio directory' });
    res.json(files.filter(f => f.endsWith('.mp3')).sort());
  });
});

// ── Health check for bootloader ──
app.get('/api/health', (req, res) => {
  const origin = req.headers.origin;
  if (isLocalOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  const count = isDbReady() ? db.prepare('SELECT COUNT(*) as cnt FROM songs').get().cnt : 0;
  res.json({
    server: true,
    catalog: count > 0,
    catalogCount: count,
    videoSource: 'cloudflare-r2',
  });
});

// ── Presigned URL for R2 video (proxy alternativo sin estrés) ──
const urlReqCount = new Map();
app.get('/api/video-url', async (req, res) => {
  const origin = req.headers.origin;
  if (!isLocalOrigin(origin)) return res.status(403).json({ error: 'CORS not allowed' });
  res.setHeader('Access-Control-Allow-Origin', origin || '*');

  const songId = req.query.id;
  if (!songId || typeof songId !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid song id' });
  }

  // Rate limiting: 30 requests/min por IP
  const ip = req.ip || req.connection?.remoteAddress || '?';
  const count = (urlReqCount.get(ip) || 0) + 1;
  urlReqCount.set(ip, count);
  setTimeout(() => { const c = urlReqCount.get(ip); if (c && c > 0) urlReqCount.set(ip, c - 1); }, 60000);
  if (count > 30) return res.status(429).json({ error: 'Too many requests. Slow down.' });

  // Find song in database
  const song = isDbReady() ? db.prepare('SELECT * FROM songs WHERE id = ?').get(songId) : null;
  if (!song) return res.status(404).json({ error: 'Song not found' });

  // Extract filename from the R2 URL
  // URL format: "https://media.pixelhub.party/Artist - Title.mp4"
  try {
    const urlPath = new URL(song.url).pathname; // "/Artist - Title.mp4"
    const filename = decodeURIComponent(urlPath.slice(1)); // remove leading "/"

    const client = getR2Client();
    if (!client) {
      // Fallback: serve public URL (bucket is public)
      return res.json({ url: song.url, expiresIn: 0, note: 'public' });
    }

    const command = new GetObjectCommand({
      Bucket: 'ritmika',
      Key: filename,
    });

    const presignedUrl = await getSignedUrl(client, command, { expiresIn: 1800 });
    res.json({ url: presignedUrl, expiresIn: 1800 });
  } catch (err) {
    console.error('[R2] Error generating presigned URL:', err.message);
    // Fallback to public URL if bucket is still public
    res.json({ url: song.url, expiresIn: 0, note: 'fallback-public' });
  }
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
  socket.on('tv:create_room', (payload = {}) => {
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

    const validModes = new Set(['clasico', 'emo', 'ranchera', 'nostalgia', 'anime']);
    const cleanMode = validModes.has(payload.mode) ? payload.mode : 'clasico';

    rooms.set(code, {
      tvSocketId: socket.id,
      players: new Map(),
      hostPlayerSocketId: null,
      mode: cleanMode,
    });

    socket.join(code);
    socket.emit('tv:room_created', {
      roomCode: code,
      mode: cleanMode,
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
    // First player to join becomes host
    if (room.players.size === 1 && !room.hostPlayerSocketId) {
      room.hostPlayerSocketId = socket.id;
    }
    socket.join(code);

    const players = getPublicPlayerList(room);

    // Confirmar al jugador
    socket.emit('player:join_ack', { success: true, roomCode: code, mode: room.mode || 'clasico', players });

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
    if (!room || !room.players.has(socket.id)) return;
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
    if (!room || !room.players.has(socket.id)) return;
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
    const room = rooms.get(roomCode);
    if (!room || room.tvSocketId !== socket.id) return;
    socket.to(roomCode).emit('game:update', { event, data });
  });

  // ──────────────────────────────────────────────────────────
  // TV → JUGADOR ESPECÍFICO: Envío privado (ej. asignación de canción)
  // Payload: { targetSocketId, event: string, data: object }
  // ──────────────────────────────────────────────────────────
  socket.on('tv:send_to_player', ({ targetSocketId, event, data }) => {
    const myRoom = getRoomByTvSocket(socket.id);
    if (!myRoom) return;
    const { room } = myRoom;
    if (!room.players.has(targetSocketId)) return;
    io.to(targetSocketId).emit('game:private', { event, data });
  });

  // ──────────────────────────────────────────────────────────
  // JUGADOR → TV: TOMATAZO 🍅
  // Payload: { roomCode, targetName }
  // ──────────────────────────────────────────────────────────
  socket.on('player:tomatazo', ({ roomCode, targetName }) => {
    if (!canAct(socket.id, 2000)) return;
    const room = rooms.get(roomCode);
    if (!room || !room.players.has(socket.id)) return;
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
    if (!room || !room.players.has(socket.id)) return;
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
    if (!room || !room.players.has(socket.id)) return;
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
    if (!room || !room.players.has(socket.id)) return;
    if (!room.players.has(targetSocketId)) return;
    if (typeof songId !== 'string' || songId.length > 100) return;
    if (isDbReady() && !db.prepare('SELECT id FROM songs WHERE id = ?').get(songId)) return;
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
    if (!room || room.tvSocketId !== socket.id) return;

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
      const availableGenres = isDbReady()
        ? db.prepare('SELECT DISTINCT genre FROM songs WHERE genre IS NOT NULL').all().map(r => r.genre)
        : ['pop', 'rock', 'reggaeton', 'banda', 'cumbia', 'ranchera', 'balada'];
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
      const availableArtists = isDbReady()
        ? db.prepare('SELECT DISTINCT artist FROM songs').all().map(r => r.artist)
        : ['Luis Miguel', 'Bad Bunny', 'Caifanes', 'Shakira', 'Bronco', 'Maná'];
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

  // Retransmitir comandos de avance desde el host a la TV
  socket.on('player:start_game', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.hostPlayerSocketId !== socket.id) return;
    io.to(room.tvSocketId).emit('tv:start_game_trigger');
  });

  socket.on('player:start_song', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.hostPlayerSocketId !== socket.id) return;
    io.to(room.tvSocketId).emit('tv:start_song_trigger');
  });

  socket.on('player:next_turn', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.hostPlayerSocketId !== socket.id) return;
    io.to(room.tvSocketId).emit('tv:next_turn_trigger');
  });

  socket.on('player:new_game', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.hostPlayerSocketId !== socket.id) return;
    io.to(room.tvSocketId).emit('tv:new_game_trigger');
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
      // Reasignar host si el que se fue era el host
      if (room.hostPlayerSocketId === socket.id) {
        const nextHost = Array.from(room.players.keys()).find(id => !id.startsWith('bot_')) || null;
        room.hostPlayerSocketId = nextHost;
        if (nextHost) {
          io.to(nextHost).emit('game:private', {
            event: 'HOST_ASSIGNED',
            data: { isHost: true },
          });
          console.log(`[HOST] ${room.players.get(nextHost)?.name} heredó el control en sala ${code}`);
        }
      }
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
