/**
 * Video cache local — Rítmika Desktop
 * Ubicación: %LOCALAPPDATA%\Ritmika\cache\videos  (o VIDEO_CACHE_DIR env)
 * Política: LRU con límite configurable (default 2048 MB), descarga progresiva, no precarga 3845 canciones.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function getCacheDir() {
  const envDir = process.env.VIDEO_CACHE_DIR;
  if (envDir) return envDir;
  const base = process.env.LOCALAPPDATA || process.env.APPDATA || require('os').homedir();
  // En Linux, LOCALAPPDATA no existe, usar ~/.cache/ritmika
  if (!process.env.LOCALAPPDATA && process.platform !== 'win32') {
    return path.join(require('os').homedir(), '.cache', 'ritmika', 'videos');
  }
  return path.join(base, 'Ritmika', 'cache', 'videos');
}

function getCacheMaxBytes() {
  const mb = parseInt(process.env.VIDEO_CACHE_MAX_MB || '2048', 10);
  return mb * 1024 * 1024;
}

function ensureCacheDir() {
  const dir = getCacheDir();
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  return dir;
}

function getCachePath(songId, url) {
  const dir = ensureCacheDir();
  const safe = songId.replace(/[^a-zA-Z0-9_-]/g, '_');
  let ext = '.mp4';
  try {
    const u = new URL(url);
    const m = u.pathname.match(/(\.[a-z0-9]+)$/i);
    if (m) ext = m[1].toLowerCase();
  } catch {}
  return path.join(dir, safe + ext);
}

function isCached(songId, url) {
  const p = getCachePath(songId, url);
  try { return fs.existsSync(p) && fs.statSync(p).size > 1024; } catch { return false; }
}

function getCachedUrl(songId, url, localBase) {
  // Si está cacheado, devolver URL local http://127.0.0.1:3000/api/video-cache/<id>
  if (isCached(songId, url)) {
    const base = localBase || `http://127.0.0.1:${process.env.PORT || 3000}`;
    return `${base}/api/video-cache/${encodeURIComponent(songId)}`;
  }
  return null;
}

function enforceLRU() {
  const dir = getCacheDir();
  const max = getCacheMaxBytes();
  try {
    const files = fs.readdirSync(dir).map(f => {
      const p = path.join(dir, f);
      try { const s = fs.statSync(p); return { path: p, size: s.size, mtime: s.mtimeMs }; } catch { return null; }
    }).filter(Boolean).sort((a,b)=>a.mtime-b.mtime);
    let total = files.reduce((s,f)=>s+f.size,0);
    for (const f of files) {
      if (total <= max) break;
      try { fs.unlinkSync(f.path); total -= f.size; } catch {}
    }
  } catch {}
}

async function downloadToCache(songId, url) {
  const dest = getCachePath(songId, url);
  if (isCached(songId, url)) return dest;
  const dir = ensureCacheDir();
  // Descarga simple con fetch (Node 18+)
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP '+res.status);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buf);
    enforceLRU();
    return dest;
  } catch (e) {
    try { fs.unlinkSync(dest); } catch {}
    throw e;
  }
}

module.exports = {
  getCacheDir,
  getCacheMaxBytes,
  ensureCacheDir,
  getCachePath,
  isCached,
  getCachedUrl,
  downloadToCache,
  enforceLRU,
};
