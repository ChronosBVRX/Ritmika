/**
 * Config centralizada — evita hardcodear URLs en múltiples archivos
 */
function getEnv(name, fallback) {
  return process.env[name] !== undefined && process.env[name] !== '' ? process.env[name] : fallback;
}

function parseOrigins(str) {
  if (!str) return [];
  return str.split(',').map(s => s.trim()).filter(Boolean);
}

const config = {
  // Local
  localPort: parseInt(getEnv('PORT', '3000'), 10),
  // Relay público (usado por TV y por QR)
  relayUrl: getEnv('RELAY_URL', getEnv('RELAY_PUBLIC_URL', '')),
  // Si relayUrl está vacío, TV está en modo LOCAL_LAN (usa mismo origen)
  // Para relay server, su propio puerto público
  relayPort: parseInt(getEnv('RELAY_PORT', process.env.PORT || '3000'), 10),
  // Comportamiento TV: 'online' (relay) o 'lan' (mismo origen)
  connectionMode: (() => {
    const m = getEnv('CONNECTION_MODE', '').toLowerCase();
    if (m === 'online' || m === 'lan') return m;
    // auto: si hay RELAY_URL, online; si no, lan
    return getEnv('RELAY_URL', getEnv('RELAY_PUBLIC_URL', '')) ? 'online' : 'lan';
  })(),
  // Salas
  roomTtlMs: parseInt(getEnv('ROOM_TTL_MS', String(2 * 60 * 60 * 1000)), 10),
  roomTtlSec: parseInt(getEnv('ROOM_TTL', String(2 * 60 * 60)), 10),
  maxPlayersPerRoom: parseInt(getEnv('MAX_PLAYERS_PER_ROOM', '8'), 10),
  // CORS relay
  corsAllowedOrigins: parseOrigins(getEnv('CORS_ALLOWED_ORIGINS', '')),
  // R2 — solo local, nunca en relay bundle
  r2: {
    accessKeyId: getEnv('R2_ACCESS_KEY_ID', ''),
    secretAccessKey: getEnv('R2_SECRET_ACCESS_KEY', ''),
    endpoint: getEnv('R2_ENDPOINT', 'https://3bb6544fbc15f95620470c922b1a0dfe.r2.cloudflarestorage.com'),
    bucket: getEnv('R2_BUCKET', 'ritmika'),
  },
  // Otros
  adminToken: getEnv('ADMIN_TOKEN', ''),
  githubToken: getEnv('GITHUB_TOKEN', ''),
  // Video cache
  videoCacheDir: getEnv('VIDEO_CACHE_DIR', ''),
  videoCacheMaxMb: parseInt(getEnv('VIDEO_CACHE_MAX_MB', '2048'), 10),
};

function isOnlineMode() {
  return config.connectionMode === 'online' && !!config.relayUrl;
}

module.exports = { config, isOnlineMode, getEnv };
