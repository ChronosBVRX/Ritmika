/**
 * Room manager — usado por local y relay.
 * No contiene lógica de juego, solo presencia y relay.
 */
const crypto = require('crypto');
const { generateRoomCode } = require('./protocol');

class RoomManager {
  constructor(opts = {}) {
    this.rooms = new Map(); // roomCode -> room
    this.maxPlayers = opts.maxPlayers || 8;
    this.ttlMs = opts.ttlMs || 2 * 60 * 60 * 1000; // 2h huérfanas
    this.cleanupIntervalMs = opts.cleanupIntervalMs || 60 * 1000;
    this._cleanupTimer = null;
    if (opts.autoCleanup !== false) this.startCleanup();
  }

  startCleanup() {
    if (this._cleanupTimer) return;
    this._cleanupTimer = setInterval(() => this.cleanup(), this.cleanupIntervalMs);
    if (this._cleanupTimer.unref) this._cleanupTimer.unref();
  }

  stopCleanup() {
    if (this._cleanupTimer) clearInterval(this._cleanupTimer);
    this._cleanupTimer = null;
  }

  createRoom(tvSocketId, mode = 'clasico') {
    const validModes = new Set(['clasico', 'emo']);
    const cleanMode = validModes.has(mode) ? mode : 'clasico';
    const code = generateRoomCode(this.rooms);
    const hostToken = crypto.randomBytes(24).toString('hex'); // 48 hex chars, nunca va a jugadores
    const room = {
      code,
      tvSocketId,
      hostToken, // solo para TV/relay auth
      players: new Map(), // socketId -> player {name, avatarId, socketId, playerId, joinedAt}
      playerIdToSocket: new Map(), // playerId -> socketId (estable)
      disconnected: new Map(), // playerId -> {player, disconnectedAt}
      hostPlayerSocketId: null,
      hostPlayerId: null,
      mode: cleanMode,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code) {
    if (!code) return null;
    return this.rooms.get(code.toUpperCase().trim()) || null;
  }

  getRoomByTvSocket(socketId) {
    for (const room of this.rooms.values()) {
      if (room.tvSocketId === socketId) return room;
    }
    return null;
  }

  getRoomByPlayerSocket(socketId) {
    for (const room of this.rooms.values()) {
      if (room.players.has(socketId)) return room;
    }
    return null;
  }

  // Búsqueda por playerId estable
  findPlayerByPlayerId(room, playerId) {
    if (!playerId) return null;
    for (const p of room.players.values()) {
      if (p.playerId === playerId) return p;
    }
    return null;
  }

  addPlayer(room, socketId, { name, avatarId, playerId, resumeToken }) {
    // Caso 1: Reconexión desde disconnected — requiere resumeToken válido
    if (playerId && room.disconnected.has(playerId)) {
      const saved = room.disconnected.get(playerId);
      if (!this.verifyResumeToken(saved.resumeToken, resumeToken)) {
        return { error: 'Token de reconexión inválido', code: 'INVALID_RESUME_TOKEN' };
      }
      room.disconnected.delete(playerId);
      const oldSocketId = saved.socketId;
      const updated = { ...saved, socketId, lastSeenAt: Date.now(), name: name || saved.name, avatarId: avatarId ?? saved.avatarId };
      room.players.set(socketId, updated);
      room.playerIdToSocket.set(playerId, socketId);
      if (room.hostPlayerId === playerId) room.hostPlayerSocketId = socketId;
      room.lastActivityAt = Date.now();
      return { player: updated, reconnected: true, oldSocketId };
    }
    // Caso 2: playerId ya conectado (intento de hijack) — requiere token
    if (playerId) {
      const existing = this.findPlayerByPlayerId(room, playerId);
      if (existing) {
        if (!this.verifyResumeToken(existing.resumeToken, resumeToken)) {
          return { error: 'playerId ya en uso, token inválido', code: 'PLAYERID_TAKEN' };
        }
        // Reconexión rápida (mismo player, token correcto, pero aún conectado)
        // Permitir solo si el socket existente está desconectado o es el mismo cliente reconectando
        // Si ya está conectado, reemplazar (caso de refresh rápido)
        const oldSocketId = existing.socketId;
        room.players.delete(oldSocketId);
        room.playerIdToSocket.set(playerId, socketId);
        const updated = { ...existing, socketId, lastSeenAt: Date.now() };
        room.players.set(socketId, updated);
        if (room.hostPlayerId === playerId) room.hostPlayerSocketId = socketId;
        room.lastActivityAt = Date.now();
        return { player: updated, reconnected: true, oldSocketId };
      }
      // playerId no existe en players ni disconnected, pero fue proporcionado por cliente
      // Verificar si ese playerId está en playerIdToSocket pero sin player (caso de limpieza parcial)
      // Si el cliente inventó un playerId, lo tratamos como nuevo pero generamos nuevo resumeToken
      // Para evitar suplantación, solo permitimos reutilizar playerId si tiene token válido;
      // si no existe en ningún lado, es un ID nuevo del cliente — lo aceptamos pero generamos token
      // Si el cliente intenta usar playerId de otro jugador que está en disconnected pero sin token, ya fue rechazado arriba
    }
    // Caso 3: nuevo jugador (o playerId nuevo) — verificar límite
    if (room.players.size >= this.maxPlayers) {
      return { error: 'Sala llena (máx ' + this.maxPlayers + ')' };
    }
    // Generar credenciales
    const pid = playerId || crypto.randomUUID();
    // Si el cliente proporcionó playerId nuevo, usarlo, pero generar nuevo resumeToken
    const token = crypto.randomBytes(32).toString('hex'); // 64 hex, secreto
    const player = {
      name,
      avatarId,
      socketId,
      playerId: pid,
      resumeToken: token,
      joinedAt: Date.now(),
      lastSeenAt: Date.now(),
    };
    room.players.set(socketId, player);
    room.playerIdToSocket.set(pid, socketId);
    if (!room.hostPlayerSocketId || !room.hostPlayerId) {
      room.hostPlayerSocketId = socketId;
      room.hostPlayerId = pid;
    }
    room.lastActivityAt = Date.now();
    return { player, reconnected: false };
  }

  removePlayer(room, socketId) {
    const p = room.players.get(socketId);
    if (!p) return null;
    room.players.delete(socketId);
    // Guardar para reconexión 5min
    room.disconnected.set(p.playerId, { ...p, disconnectedAt: Date.now() });
    // No borrar de playerIdToSocket inmediatamente — permitir reconexión
    room.lastActivityAt = Date.now();
    // Reasignar host si era el que se fue
    if (room.hostPlayerSocketId === socketId) {
      const next = [...room.players.values()].find(pl => !pl.socketId.startsWith('bot_'));
      if (next) {
        room.hostPlayerSocketId = next.socketId;
        room.hostPlayerId = next.playerId;
        return { removed: p, newHost: next };
      } else {
        room.hostPlayerSocketId = null;
        room.hostPlayerId = null;
        return { removed: p, newHost: null };
      }
    }
    return { removed: p, newHost: null };
  }

  isHost(room, socketId, playerId) {
    // Compatibilidad: primero socketId (viejo), luego playerId estable
    if (room.hostPlayerSocketId === socketId) return true;
    if (playerId && room.hostPlayerId === playerId) return true;
    return false;
  }

  verifyHostToken(room, token) {
    if (!token || !room.hostToken) return false;
    try {
      return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(room.hostToken));
    } catch {
      return token === room.hostToken;
    }
  }

  verifyResumeToken(stored, provided) {
    if (!stored || !provided) return false;
    try {
      const a = Buffer.from(stored);
      const b = Buffer.from(provided);
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    } catch {
      return stored === provided;
    }
  }

  getPublicPlayers(room) {
    return [...room.players.values()].map(p => ({
      name: p.name,
      avatarId: p.avatarId,
      socketId: p.socketId,
      playerId: p.playerId,
      // resumeToken NUNCA se expone aquí
    }));
  }

  touch(room) { room.lastActivityAt = Date.now(); }

  deleteRoom(code) {
    this.rooms.delete(code.toUpperCase().trim());
  }

  cleanup() {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      // Salas sin TV y sin jugadores por TTL -> borrar
      const isOrphan = !room.tvSocketId || !this.isSocketAlive(room.tvSocketId);
      // En tests, no tenemos lista de sockets vivos — usamos timestamp
      // Si lastActivity > TTL y 0 players o TV desconectada, borrar
      const stale = (now - room.lastActivityAt) > this.ttlMs;
      if (stale && (room.players.size === 0 || isOrphan)) {
        this.rooms.delete(code);
      }
      // Limpiar mapeo playerId -> socket muerto después de 5min sin reconexión
      for (const [pid, sid] of room.playerIdToSocket) {
        const pl = room.players.get(sid);
        if (!pl) {
          // buscar si hay otro socket con mismo pid (reconectó)
          const stillExists = [...room.players.values()].some(v => v.playerId === pid);
          if (!stillExists) {
            // si lleva >5min sin estar en players, borrar mapeo
            // usamos lastActivity como proxy
            if (stale) room.playerIdToSocket.delete(pid);
          }
        }
      }
    }
  }

  // Hook para que relay/local inyecte verificación de socket vivo (io.sockets.sockets.has)
  isSocketAlive(socketId) { return true; }
}

module.exports = RoomManager;
