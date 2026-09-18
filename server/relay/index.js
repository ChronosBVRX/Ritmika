/**
 * Rítmika Relay — pasarela ligera en Internet
 * Solo salas, presencia y relay TV↔jugadores. CERO lógica de juego.
 */
const express = require('express');
const compression = require('compression');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
require('dotenv').config();

const { config } = require('../shared/config');
const { EVENTS, RATE_LIMITS, sanitizeName, sanitizeAvatarId, sanitizeScore, sanitizeRoomCode } = require('../shared/protocol');
const RoomManager = require('../shared/rooms');
const { RateLimiter, IpRateLimiter } = require('../shared/rateLimiter');

const app = express();
app.use(compression());
app.use(express.json({ limit: '20kb' }));

const httpServer = http.createServer(app);

// CORS para relay: permitir cualquier origen móvil, pero validar en socket
const io = new Server(httpServer, {
  cors: {
    origin: (origin, cb) => {
      // Relay es público: permitir cualquier origen (móviles por datos)
      // Si CORS_ALLOWED_ORIGINS está configurado, validar contra lista
      if (config.corsAllowedOrigins.length === 0) return cb(null, true);
      if (!origin) return cb(null, true);
      try {
        const host = new URL(origin).hostname;
        if (config.corsAllowedOrigins.some(p => host === p || host.endsWith('.' + p) || origin.includes(p))) {
          return cb(null, true);
        }
      } catch {}
      return cb(null, true); // fallback permisivo para móviles
    },
    methods: ['GET', 'POST'],
  },
  pingTimeout: 20000,
  pingInterval: 25000,
});

// Static: servir /join y assets ligeros para móvil
const publicDir = path.join(__dirname, '../../public');
const oneYear = 31536000000;
app.use(express.static(publicDir, {
  maxAge: oneYear,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    else res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
}));

app.get('/', (req, res) => {
  // Relay root: info ligera, no TV
  res.json({ relay: true, version: require('../../package.json').version, join: '/join' });
});

app.get('/join', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.sendFile(path.join(publicDir, 'mobile.html'));
});

// Lightweight health
app.get('/api/relay-health', (req, res) => {
  res.json({
    relay: true,
    rooms: roomManager.rooms.size,
    uptime: process.uptime(),
    version: require('../../package.json').version,
  });
});

// Health para TV boot (compat)
app.get('/api/health', (req, res) => {
  res.json({ relay: true, server: true, catalog: false, catalogCount: 0, videoSource: 'none' });
});

// Room info para móvil pre-join
app.get('/api/room/:code', (req, res) => {
  const code = sanitizeRoomCode(req.params.code);
  const room = roomManager.getRoom(code);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json({ mode: room.mode || 'clasico' });
});

// Artist metadata ligera — si existe archivo generado, servirlo; si no, fallback
app.get('/api/artist-map', (req, res) => {
  const fs = require('fs');
  const metaPath = path.join(__dirname, '../shared/artist-metadata.json');
  if (fs.existsSync(metaPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      // filtrar por mode si se pidió
      const mode = req.query.mode ? String(req.query.mode).toLowerCase() : null;
      if (mode && mode !== 'clasico' && data[mode]) {
        const out = {}; out[mode] = data[mode];
        return res.json(out);
      }
      // si piden modo clásico, devolver solo géneros clásicos
      return res.json(data);
    } catch {}
  }
  // Fallback mínimo sin DB
  res.json({
    pop: [], rock: [], reggaeton: [], banda: [], cumbia: [], ranchera: [], balada: [], electronica: []
  });
});

// Room manager con TTL y max players
const roomManager = new RoomManager({
  maxPlayers: config.maxPlayersPerRoom,
  ttlMs: config.roomTtlMs,
  cleanupIntervalMs: 60 * 1000,
});
roomManager.isSocketAlive = (sid) => io.sockets.sockets.has(sid);

const rateLimiter = new RateLimiter();
const ipLimiter = new IpRateLimiter(60, 60 * 1000); // 60 req/min por IP para REST

// Helpers
function getRoomByTvSocket(socketId) { return roomManager.getRoomByTvSocket(socketId); }
function getRoomByPlayerSocket(socketId) { return roomManager.getRoomByPlayerSocket(socketId); }

const packageVersion = require('../../package.json').version;

io.on('connection', (socket) => {
  // IP rate limit para sockets (opcional)
  const ip = socket.handshake.address;
  if (!ipLimiter.hit(ip)) {
    socket.disconnect(true);
    return;
  }
  socket.emit(EVENTS.SERVER_VERSION, packageVersion);

  // TV crea sala -> devuelve roomCode + hostToken (privado)
  socket.on(EVENTS.TV_CREATE_ROOM, (payload = {}) => {
    const oldRoom = getRoomByTvSocket(socket.id);
    if (oldRoom) {
      socket.to(oldRoom.code).emit(EVENTS.GAME_TV_DISCONNECTED, { message: 'La partida terminó. La sala fue cerrada.' });
      roomManager.deleteRoom(oldRoom.code);
    }
    const room = roomManager.createRoom(socket.id, payload.mode);
    socket.join(room.code);
    socket.emit(EVENTS.TV_ROOM_CREATED, {
      roomCode: room.code,
      hostToken: room.hostToken, // NUNCA va a jugadores
      mode: room.mode,
      relayUrl: config.relayUrl || `http://localhost:${config.relayPort}`,
    });
    console.log(`[RELAY][SALA] Creada ${room.code} por TV ${socket.id}`);
  });

  // TV reconecta a sala existente con token
  socket.on('tv:reconnect_host', ({ roomCode, hostToken }) => {
    const room = roomManager.getRoom(sanitizeRoomCode(roomCode));
    if (!room || !roomManager.verifyHostToken(room, hostToken)) {
      socket.emit('tv:reconnect_ack', { success: false, error: 'Token inválido o sala no encontrada' });
      return;
    }
    // Migrar TV a nuevo socket
    const oldTv = room.tvSocketId;
    room.tvSocketId = socket.id;
    socket.join(room.code);
    room.lastActivityAt = Date.now();
    socket.emit('tv:reconnect_ack', { success: true, roomCode: room.code, mode: room.mode });
    // Notificar jugadores que TV volvió
    socket.to(room.code).emit(EVENTS.GAME_UPDATE, { event: 'HOST_RECONNECTED', data: {} });
    console.log(`[RELAY][RECONNECT] TV ${oldTv} -> ${socket.id} sala ${room.code}`);
  });

  socket.on(EVENTS.TV_CLOSE_ROOM, () => {
    const room = getRoomByTvSocket(socket.id);
    if (!room) return;
    socket.to(room.code).emit(EVENTS.GAME_TV_DISCONNECTED, { message: 'La sala ha sido cerrada.' });
    roomManager.deleteRoom(room.code);
    console.log(`[RELAY][SALA] Cerrada ${room.code}`);
  });

  // Jugador se une — soporta playerId estable
  socket.on(EVENTS.PLAYER_JOIN, ({ roomCode, name, avatarId, playerId, resumeToken }) => {
    const code = sanitizeRoomCode(roomCode);
    const room = roomManager.getRoom(code);
    if (!room) {
      socket.emit(EVENTS.PLAYER_JOIN_ACK, { success: false, error: 'Sala no encontrada. Revisa el código.' });
      return;
    }
    const cleanName = sanitizeName(name);
    const cleanAvatar = sanitizeAvatarId(avatarId);
    let cleanPlayerId = null;
    if (typeof playerId === 'string' && playerId.length >= 8 && playerId.length <= 64) {
      cleanPlayerId = playerId.trim();
    }
    let cleanResumeToken = null;
    if (typeof resumeToken === 'string' && resumeToken.length >= 32 && resumeToken.length <= 128) {
      cleanResumeToken = resumeToken.trim();
    }
    const result = roomManager.addPlayer(room, socket.id, { name: cleanName, avatarId: cleanAvatar, playerId: cleanPlayerId, resumeToken: cleanResumeToken });
    if (result.error) {
      socket.emit(EVENTS.PLAYER_JOIN_ACK, { success: false, error: result.error, code: result.code || 'JOIN_ERROR' });
      return;
    }
    socket.join(code);
    const players = roomManager.getPublicPlayers(room);
    // Ack incluye playerId y resumeToken (solo al propietario, secreto)
    socket.emit(EVENTS.PLAYER_JOIN_ACK, {
      success: true,
      roomCode: code,
      mode: room.mode,
      players,
      playerId: result.player.playerId,
      resumeToken: result.player.resumeToken,
      isHost: room.hostPlayerId === result.player.playerId,
      reconnected: result.reconnected || false,
    });
    // Notificar TV con player sanitizado (sin resumeToken)
    const sanitizedPlayer = { name: result.player.name, avatarId: result.player.avatarId, socketId: result.player.socketId, playerId: result.player.playerId };
    io.to(room.tvSocketId).emit(EVENTS.TV_PLAYER_JOINED, { player: sanitizedPlayer, players });
    // Notificar a otros jugadores (game:update PLAYER_JOINED)
    socket.to(code).emit(EVENTS.GAME_UPDATE, { event: 'PLAYER_JOINED', data: { players } });
    console.log(`[RELAY][JOIN] ${cleanName} (${socket.id} pid:${result.player.playerId.slice(0,8)}) -> ${code}${result.reconnected ? ' (reconnect)' : ''}`); // resumeToken never logged
  });

  // Jugador reconecta explícitamente con playerId + resumeToken
  socket.on('player:reconnect', ({ roomCode, playerId, resumeToken }) => {
    const room = roomManager.getRoom(sanitizeRoomCode(roomCode));
    if (!room || !playerId) {
      socket.emit('player:reconnect_ack', { success: false, error: 'Sala o playerId inválido' });
      return;
    }
    // Buscar en disconnected o players
    let existing = null;
    if (room.disconnected.has(playerId)) {
      const saved = room.disconnected.get(playerId);
      if (!roomManager.verifyResumeToken(saved.resumeToken, resumeToken)) {
        socket.emit('player:reconnect_ack', { success: false, error: 'Token inválido', code: 'INVALID_RESUME_TOKEN' });
        return;
      }
      // Restaurar desde disconnected
      room.disconnected.delete(playerId);
      existing = { ...saved, socketId: socket.id, lastSeenAt: Date.now() };
      room.players.set(socket.id, existing);
      room.playerIdToSocket.set(playerId, socket.id);
      if (room.hostPlayerId === playerId) room.hostPlayerSocketId = socket.id;
    } else {
      existing = roomManager.findPlayerByPlayerId(room, playerId);
      if (!existing) {
        socket.emit('player:reconnect_ack', { success: false, error: 'Jugador no encontrado, haz join de nuevo' });
        return;
      }
      if (!roomManager.verifyResumeToken(existing.resumeToken, resumeToken)) {
        socket.emit('player:reconnect_ack', { success: false, error: 'Token inválido', code: 'INVALID_RESUME_TOKEN' });
        return;
      }
      const oldSid = existing.socketId;
      room.players.delete(oldSid);
      existing.socketId = socket.id;
      existing.lastSeenAt = Date.now();
      room.players.set(socket.id, existing);
      room.playerIdToSocket.set(playerId, socket.id);
      if (room.hostPlayerId === playerId) room.hostPlayerSocketId = socket.id;
    }
    socket.join(room.code);
    const players = roomManager.getPublicPlayers(room);
    socket.emit('player:reconnect_ack', { success: true, roomCode: room.code, playerId, players, isHost: room.hostPlayerId === playerId });
    const sanitized = { name: existing.name, avatarId: existing.avatarId, socketId: existing.socketId, playerId: existing.playerId };
    io.to(room.tvSocketId).emit(EVENTS.TV_PLAYER_JOINED, { player: sanitized, players });
    socket.to(room.code).emit(EVENTS.GAME_UPDATE, { event: 'PLAYER_JOINED', data: { players } });
    console.log(`[RELAY][RECONNECT] ${existing.name} ${oldSid} -> ${socket.id} sala ${room.code}`);
  });

  socket.on(EVENTS.PLAYER_SELECT_GENRES, ({ roomCode, genres }) => {
    const room = roomManager.getRoom(sanitizeRoomCode(roomCode));
    if (!room || !room.players.has(socket.id)) return;
    roomManager.touch(room);
    io.to(room.tvSocketId).emit(EVENTS.TV_PLAYER_GENRES, { socketId: socket.id, playerId: room.players.get(socket.id)?.playerId, genres });
  });

  socket.on(EVENTS.PLAYER_SELECT_ARTISTS, ({ roomCode, artists }) => {
    const room = roomManager.getRoom(sanitizeRoomCode(roomCode));
    if (!room || !room.players.has(socket.id)) return;
    roomManager.touch(room);
    io.to(room.tvSocketId).emit(EVENTS.TV_PLAYER_ARTISTS, { socketId: socket.id, playerId: room.players.get(socket.id)?.playerId, artists });
  });

  // Broadcast TV -> jugadores
  socket.on(EVENTS.TV_BROADCAST, ({ roomCode, event, data, hostToken }) => {
    const room = roomManager.getRoom(sanitizeRoomCode(roomCode));
    if (!room) return;
    // Verificar que es la TV dueña (por socket o token)
    const isTv = room.tvSocketId === socket.id || (hostToken && roomManager.verifyHostToken(room, hostToken));
    if (!isTv) return;
    // Validar tamaño payload (no > 20KB)
    try { if (JSON.stringify({ event, data }).length > 20000) return; } catch { return; }
    roomManager.touch(room);
    socket.to(room.code).emit(EVENTS.GAME_UPDATE, { event, data });
  });

  socket.on(EVENTS.TV_SEND_TO_PLAYER, ({ targetSocketId, event, data, hostToken, targetPlayerId, roomCode }) => {
    let room = null;
    if (roomCode) room = roomManager.getRoom(sanitizeRoomCode(roomCode));
    else room = getRoomByTvSocket(socket.id);
    if (!room) return;
    const isTv = room.tvSocketId === socket.id || (hostToken && roomManager.verifyHostToken(room, hostToken));
    if (!isTv) return;
    let targetSid = targetSocketId;
    if (targetPlayerId) {
      const p = roomManager.findPlayerByPlayerId(room, targetPlayerId);
      if (p) targetSid = p.socketId;
    }
    if (!targetSid || !room.players.has(targetSid)) return;
    try { if (JSON.stringify({ event, data }).length > 20000) return; } catch { return; }
    io.to(targetSid).emit(EVENTS.GAME_PRIVATE, { event, data });
  });

  // Jugador -> TV (con rate limit)
  socket.on(EVENTS.PLAYER_TOMATAZO, ({ roomCode, targetName }) => {
    const key = socket.id + ':' + EVENTS.PLAYER_TOMATAZO;
    if (!rateLimiter.canAct(key, RATE_LIMITS[EVENTS.PLAYER_TOMATAZO])) return;
    const room = roomManager.getRoom(sanitizeRoomCode(roomCode));
    if (!room || !room.players.has(socket.id)) return;
    const attacker = room.players.get(socket.id);
    const cleanTarget = typeof targetName === 'string' ? targetName.trim().substring(0, 15).replace(/<[^>]*>/g, '') : 'Alguien';
    roomManager.touch(room);
    io.to(room.tvSocketId).emit(EVENTS.TV_TOMATAZO, { attackerName: attacker.name, attackerSocketId: socket.id, attackerPlayerId: attacker.playerId, targetName: cleanTarget });
  });

  socket.on(EVENTS.PLAYER_EMOJI, ({ roomCode, emoji }) => {
    const key = socket.id + ':' + EVENTS.PLAYER_EMOJI;
    if (!rateLimiter.canAct(key, RATE_LIMITS[EVENTS.PLAYER_EMOJI])) return;
    const room = roomManager.getRoom(sanitizeRoomCode(roomCode));
    if (!room || !room.players.has(socket.id)) return;
    const sender = room.players.get(socket.id);
    // validar emoji longitud
    if (typeof emoji !== 'string' || emoji.length > 10) return;
    roomManager.touch(room);
    io.to(room.tvSocketId).emit(EVENTS.TV_EMOJI, { senderName: sender.name, emoji });
  });

  socket.on(EVENTS.PLAYER_SABOTAGE, ({ roomCode }) => {
    const key = socket.id + ':' + EVENTS.PLAYER_SABOTAGE;
    if (!rateLimiter.canAct(key, RATE_LIMITS[EVENTS.PLAYER_SABOTAGE])) return;
    const room = roomManager.getRoom(sanitizeRoomCode(roomCode));
    if (!room || !room.players.has(socket.id)) return;
    roomManager.touch(room);
    io.to(room.tvSocketId).emit(EVENTS.TV_SABOTAGE, { socketId: socket.id, playerId: room.players.get(socket.id)?.playerId });
  });

  socket.on(EVENTS.PLAYER_VOTE, ({ roomCode, score, performerSocketId, performerPlayerId }) => {
    const room = roomManager.getRoom(sanitizeRoomCode(roomCode));
    if (!room || !room.players.has(socket.id)) return;
    const voter = room.players.get(socket.id);
    const cleanScore = sanitizeScore(score);
    let perfSid = performerSocketId;
    if (performerPlayerId) {
      const p = roomManager.findPlayerByPlayerId(room, performerPlayerId);
      if (p) perfSid = p.socketId;
    }
    if (typeof perfSid === 'string') perfSid = perfSid.trim();
    if (!perfSid || (!room.players.has(perfSid) && room.tvSocketId !== perfSid)) return;
    roomManager.touch(room);
    io.to(room.tvSocketId).emit(EVENTS.TV_VOTE, { voterName: voter.name, voterSocketId: socket.id, voterPlayerId: voter.playerId, performerSocketId: perfSid, score: cleanScore });
  });

  socket.on(EVENTS.PLAYER_ASSIGN_SONG, ({ roomCode, targetSocketId, targetPlayerId, songId }) => {
    const room = roomManager.getRoom(sanitizeRoomCode(roomCode));
    if (!room || !room.players.has(socket.id)) return;
    let targetSid = targetSocketId;
    if (targetPlayerId) {
      const p = roomManager.findPlayerByPlayerId(room, targetPlayerId);
      if (p) targetSid = p.socketId;
    }
    if (!targetSid || !room.players.has(targetSid)) return;
    if (typeof songId !== 'string' || songId.length > 100) return;
    // Relay NO valida contra songs.db (no tiene DB). Validación básica de formato
    if (!/^r2_[a-f0-9]+$/.test(songId) && !/^[\w-]{3,100}$/.test(songId)) {
      // permitir ids genéricos pero limitar caracteres
      if (/[<>"'&]/.test(songId)) return;
    }
    const attacker = room.players.get(socket.id);
    roomManager.touch(room);
    io.to(room.tvSocketId).emit(EVENTS.TV_SONG_ASSIGNED, { attackerName: attacker.name, attackerSocketId: socket.id, attackerPlayerId: attacker.playerId, targetSocketId: targetSid, targetPlayerId: room.players.get(targetSid)?.playerId, songId });
  });

  socket.on(EVENTS.TV_ADD_BOT, ({ roomCode }) => {
    const code = sanitizeRoomCode(roomCode);
    const room = roomManager.getRoom(code);
    if (!room || room.tvSocketId !== socket.id) return;
    if (room.players.size >= roomManager.maxPlayers) return;
    const botSocketId = 'bot_' + Math.random().toString(36).substr(2, 9);
    const names = ['Axolote Veloz', 'Catarina Rockera', 'Tlacuache Punk', 'Mariachi Loco', 'Llama Popstar', 'Chiba DJ'];
    const botName = names[room.players.size % names.length] + ' (Bot)';
    const botPlayerId = 'bot_' + botSocketId;
    const playerInfo = { name: botName, avatarId: Math.floor(Math.random() * 8), socketId: botSocketId, playerId: botPlayerId };
    room.players.set(botSocketId, { ...playerInfo, joinedAt: Date.now() });
    room.playerIdToSocket.set(botPlayerId, botSocketId);
    const players = roomManager.getPublicPlayers(room);
    io.to(room.tvSocketId).emit(EVENTS.TV_PLAYER_JOINED, { player: playerInfo, players });
    setTimeout(() => {
      io.to(room.tvSocketId).emit(EVENTS.TV_PLAYER_GENRES, { socketId: botSocketId, playerId: botPlayerId, genres: ['pop', 'rock'].slice(0, 2) });
    }, 500);
    setTimeout(() => {
      io.to(room.tvSocketId).emit(EVENTS.TV_PLAYER_ARTISTS, { socketId: botSocketId, playerId: botPlayerId, artists: ['Shakira', 'Maná'].slice(0, 2) });
    }, 1000);
  });

  socket.on(EVENTS.TV_START_GAME, ({ roomCode, hostToken }) => {
    const room = roomManager.getRoom(sanitizeRoomCode(roomCode));
    if (!room) return;
    const isTv = room.tvSocketId === socket.id || (hostToken && roomManager.verifyHostToken(room, hostToken));
    if (!isTv) return;
    socket.to(room.code).emit(EVENTS.GAME_STARTED, { message: '¡La fiesta comenzó! 🎤' });
  });

  // Host triggers via player socket
  function forwardHostTrigger(eventName, tvEvent) {
    socket.on(eventName, ({ roomCode }) => {
      const room = roomManager.getRoom(sanitizeRoomCode(roomCode));
      if (!room) return;
      if (!roomManager.isHost(room, socket.id, room.players.get(socket.id)?.playerId)) return;
      roomManager.touch(room);
      io.to(room.tvSocketId).emit(tvEvent);
    });
  }
  forwardHostTrigger(EVENTS.PLAYER_START_GAME, EVENTS.TV_START_GAME_TRIGGER);
  forwardHostTrigger(EVENTS.PLAYER_START_SONG, EVENTS.TV_START_SONG_TRIGGER);
  forwardHostTrigger(EVENTS.PLAYER_NEXT_TURN, EVENTS.TV_NEXT_TURN_TRIGGER);
  forwardHostTrigger(EVENTS.PLAYER_NEW_GAME, EVENTS.TV_NEW_GAME_TRIGGER);

  socket.on('disconnect', () => {
    rateLimiter.clear(socket.id + ':' + EVENTS.PLAYER_TOMATAZO);
    rateLimiter.clear(socket.id + ':' + EVENTS.PLAYER_EMOJI);
    rateLimiter.clear(socket.id + ':' + EVENTS.PLAYER_SABOTAGE);

    const tvRoom = getRoomByTvSocket(socket.id);
    if (tvRoom) {
      // No borrar sala inmediatamente — dar 2min para reconexión TV con hostToken
      console.log(`[RELAY][TV DISC] ${tvRoom.code} TV ${socket.id} desconectada, esperando reconexión...`);
      socket.to(tvRoom.code).emit(EVENTS.GAME_TV_DISCONNECTED, { message: 'La TV se desconectó. Esperando reconexión...', reconnectable: true });
      // Marcar TV como desconectada pero no borrar sala aún
      tvRoom.tvSocketId = null;
      tvRoom.lastActivityAt = Date.now();
      // Programar borrado si no reconecta en TTL
      setTimeout(() => {
        const r = roomManager.getRoom(tvRoom.code);
        if (r && !r.tvSocketId && r.players.size === 0) {
          roomManager.deleteRoom(tvRoom.code);
          console.log(`[RELAY][CLEANUP] Sala huérfana ${tvRoom.code} borrada`);
        } else if (r && !r.tvSocketId) {
          // si aún tiene jugadores, notificar cierre definitivo
          io.to(r.code).emit(EVENTS.GAME_TV_DISCONNECTED, { message: 'Sala cerrada por inactividad de TV' });
          roomManager.deleteRoom(tvRoom.code);
        }
      }, 120000);
      return;
    }

    const playerRoom = getRoomByPlayerSocket(socket.id);
    if (playerRoom) {
      const result = roomManager.removePlayer(playerRoom, socket.id);
      if (!result) return;
      const players = roomManager.getPublicPlayers(playerRoom);
      if (result.newHost) {
        io.to(result.newHost.socketId).emit(EVENTS.GAME_PRIVATE, { event: 'HOST_ASSIGNED', data: { isHost: true } });
        console.log(`[RELAY][HOST] ${result.newHost.name} heredó host en ${playerRoom.code}`);
      }
      io.to(playerRoom.tvSocketId).emit(EVENTS.TV_PLAYER_LEFT, { socketId: socket.id, playerId: result.removed.playerId, name: result.removed.name, players });
      socket.to(playerRoom.code).emit(EVENTS.GAME_UPDATE, { event: 'PLAYER_LEFT', data: { players } });
      console.log(`[RELAY][LEAVE] ${result.removed.name} salió de ${playerRoom.code}`);
      // Si sala queda vacía y TV desconectada, programar borrado
      if (playerRoom.players.size === 0 && !playerRoom.tvSocketId) {
        setTimeout(() => {
          const r = roomManager.getRoom(playerRoom.code);
          if (r && r.players.size === 0 && !r.tvSocketId) {
            roomManager.deleteRoom(playerRoom.code);
            console.log(`[RELAY][CLEANUP] Sala vacía ${playerRoom.code} borrada`);
          }
        }, 60000);
      }
    }
  });
});

const PORT = config.relayPort;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   🌐  RÍTMIKA RELAY — PASARELA LIGERA     ║');
  console.log(`║   📡  http://0.0.0.0:${PORT}               ║`);
  console.log(`║   📱  /join  +  Socket.IO relay            ║`);
  console.log('╚════════════════════════════════════════════╝');
  console.log('');
});

module.exports = { app, io, roomManager, httpServer };
