// ═══ ESTADO DEL JUEGO ═══
// Módulo extraído de tv.html
// ==============================================

function saveGameState() {
  try {
    const data = {
      v: 1,
      savedAt: Date.now(),
      players: state.players.filter(p => !p.disconnected).map(p => ({
        name: p.name, avatarId: p.avatarId,
        score: p.score || 0, genres: p.genres || [],
        artists: p.artists || [], tomatazos: p.tomatazos || 0,
      })),
      round: state.round,
      currentSingerIdx: state.currentSingerIdx,
      songQueue: state.songQueue,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) { /* ignore */ }
}

function loadSavedGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data.players || !data.players.length || Date.now() - data.savedAt > SAVE_TTL) {
      localStorage.removeItem(SAVE_KEY);
      return null;
    }
    return data;
  } catch (e) { return null; }
}

function clearSavedGame() {
  localStorage.removeItem(SAVE_KEY);
}

const TOMATAZO_COST = 30;

const state = {
  roomCode:   null,
  localIP:    '127.0.0.1',
  hotspotSSID: 'Ritmika',
  hotspotPassword: '',
  players:    [],   // { socketId, name, avatarId, score, genres, artists, tomatazos }
  round:      0,    // 0=lobby, 1, 2, 3
  isRestored: false, // true si se restauró desde localStorage
  singerQueue:  [],
  currentSingerIdx: 0,
  currentSong:  null,
  votes:        [],
  audioSabotageCount: 0,
  AUDIO_SABOTAGE_THRESHOLD: 3,
  songQueue:    [],  // songs already used
  tomatazoCounts: {},
  assignedSongs: {}, // targetSocketId → { attackerName, songId }
};
