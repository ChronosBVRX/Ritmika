/**
 * Protocolo compartido — nombres de eventos y helpers de validación
 * Congelado en f341ac1, no renombrar eventos sin actualizar docs/PROTOCOL.md
 */
const VALID_SCORES = [10, 30, 60, 100];
const ROOM_CODE_REGEX = /^[A-Z2-9]{4}$/;
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const EVENTS = {
  // TV -> Relay
  TV_CREATE_ROOM: 'tv:create_room',
  TV_CLOSE_ROOM: 'tv:close_room',
  TV_BROADCAST: 'tv:broadcast',
  TV_SEND_TO_PLAYER: 'tv:send_to_player',
  TV_ADD_BOT: 'tv:add_bot',
  TV_START_GAME: 'tv:start_game',
  // Player -> Relay
  PLAYER_JOIN: 'player:join',
  PLAYER_SELECT_GENRES: 'player:select_genres',
  PLAYER_SELECT_ARTISTS: 'player:select_artists',
  PLAYER_TOMATAZO: 'player:tomatazo',
  PLAYER_EMOJI: 'player:emoji',
  PLAYER_SABOTAGE: 'player:sabotage_audio',
  PLAYER_VOTE: 'player:vote',
  PLAYER_ASSIGN_SONG: 'player:assign_song',
  PLAYER_START_GAME: 'player:start_game',
  PLAYER_START_SONG: 'player:start_song',
  PLAYER_NEXT_TURN: 'player:next_turn',
  PLAYER_NEW_GAME: 'player:new_game',
  // Relay -> TV
  TV_ROOM_CREATED: 'tv:room_created',
  TV_PLAYER_JOINED: 'tv:player_joined',
  TV_PLAYER_LEFT: 'tv:player_left',
  TV_PLAYER_GENRES: 'tv:player_genres',
  TV_PLAYER_ARTISTS: 'tv:player_artists',
  TV_TOMATAZO: 'tv:tomatazo',
  TV_EMOJI: 'tv:emoji',
  TV_SABOTAGE: 'tv:sabotage_audio',
  TV_VOTE: 'tv:vote',
  TV_SONG_ASSIGNED: 'tv:song_assigned',
  TV_START_GAME_TRIGGER: 'tv:start_game_trigger',
  TV_START_SONG_TRIGGER: 'tv:start_song_trigger',
  TV_NEXT_TURN_TRIGGER: 'tv:next_turn_trigger',
  TV_NEW_GAME_TRIGGER: 'tv:new_game_trigger',
  // Relay -> Player
  PLAYER_JOIN_ACK: 'player:join_ack',
  GAME_STARTED: 'game:started',
  GAME_UPDATE: 'game:update',
  GAME_PRIVATE: 'game:private',
  GAME_TV_DISCONNECTED: 'game:tv_disconnected',
  SERVER_VERSION: 'server_version',
};

const RATE_LIMITS = {
  [EVENTS.PLAYER_TOMATAZO]: 2000,
  [EVENTS.PLAYER_EMOJI]: 500,
  [EVENTS.PLAYER_SABOTAGE]: 3000,
};

function sanitizeName(name) {
  let clean = typeof name === 'string' ? name.trim() : 'Jugador';
  if (clean.length > 15) clean = clean.substring(0, 15);
  if (!clean) clean = 'Jugador ' + Math.floor(Math.random() * 100);
  clean = clean.replace(/<[^>]*>/g, '');
  return clean;
}

function sanitizeAvatarId(avatarId) {
  let n = parseInt(avatarId, 10);
  if (isNaN(n) || n < 0 || n > 7) return 0;
  return n;
}

function sanitizeScore(score) {
  return VALID_SCORES.includes(score) ? score : 10;
}

function sanitizeRoomCode(code) {
  return typeof code === 'string' ? code.toUpperCase().trim() : '';
}

function generateRoomCode(existingSet) {
  let code;
  do {
    code = '';
    for (let i = 0; i < 4; i++) code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  } while (existingSet && existingSet.has(code));
  return code;
}

module.exports = {
  EVENTS,
  VALID_SCORES,
  ROOM_CODE_REGEX,
  ROOM_CODE_CHARS,
  RATE_LIMITS,
  sanitizeName,
  sanitizeAvatarId,
  sanitizeScore,
  sanitizeRoomCode,
  generateRoomCode,
};
