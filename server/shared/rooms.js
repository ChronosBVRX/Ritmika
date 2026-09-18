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

  addPlayer(room, socketId, { name, avatarId, playerId }) {
    if (room.players.size >= this.maxPlayers) {
      return { error: 'Sala llena (máx ' + this.maxPlayers + ')' };
    }
    // Si playerId ya existe, es reconexión — reemplazar socket
    if (playerId) {
      const existing = this.findPlayerByPlayerId(room, playerId);
      if (existing) {
        const oldSocketId = existing.socketId;
        room.players.delete(oldSocketId);
        room.playerIdToSocket.set(playerId, socketId);
        const updated = { ...existing, socketId, lastSeenAt: Date.now() };
        room.players.set(socketId, updated);
        if (room.hostPlayerId === playerId) room.hostPlayerSocketId = socketId;
        room.lastActivityAt = Date.now();
        return { player: updated, reconnected: true, oldSocketId };
      }
    }
    const pid = playerId || crypto.randomUUID();
    const player = {
      name,
      avatarId,
      socketId,
      playerId: pid,
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
    // No borrar de playerIdToSocket inmediatamente — permitir reconexión 5min
    // se limpia en cleanup si no vuelve
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

  getPublicPlayers(room) {
    return [...room.players.values()].map(p => ({
      name: p.name,
      avatarId: p.avatarId,
      socketId: p.socketId,
      playerId: p.playerId,
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
