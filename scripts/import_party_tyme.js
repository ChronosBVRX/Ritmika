#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const Database = require('better-sqlite3');

const ROOT = path.join(__dirname, '..');
require('dotenv').config({ path: path.join(ROOT, '.env'), quiet: true });

const execFileAsync = promisify(execFile);

const R2_DB_PATH = path.join(ROOT, 'server', 'r2_db.json');
const SQLITE_PATH = path.join(ROOT, 'server', 'songs.db');
const DEFAULT_DIRS = [
  '/media/chronos/Disco Duro/Nueva Carpeta/PARTY TYME KARAOKE EN ESPAÑOL - Mejores artistas - febrero de 2025',
  '/media/chronos/Disco Duro/Nueva Carpeta/PARTY TYME KARAOKE EN ESPAÑOL - ¡TRENDING!',
];
const CDN_BASE = 'https://media.pixelhub.party';
const PROBE_CACHE_PATH = path.join(ROOT, '.cache', 'party_tyme_probe.json');
const DEFAULT_MANIFEST = path.join(ROOT, 'docs', 'party_tyme_manifest.csv');
const DEFAULT_REPORT = path.join(ROOT, 'docs', 'party_tyme_report.json');

const STOP = new Set('el la los las un una uno unos unas de del al a y e o u en por para the of in to and with'.split(' '));
const NOISE = new Set('low multi karaoke version versionkaraoke instrumental hd full oficial official lyric lyrics letra audio video demo cover original completo'.split(' '));

const GENRE_OVERRIDES = {
  'vicente fernandez': 'ranchera',
  'alejandro fernandez': 'ranchera',
  'javier solis': 'ranchera',
  'pedro infante': 'ranchera',
  'vicente fernandez jr': 'ranchera',
  'jenni rivera': 'banda',
  'la arrolladora banda el limon': 'banda',
  'la bandononona clave nueva de max peraza': 'banda',
  'los dareyes de la sierra': 'banda',
  'los tigres del norte': 'banda',
  'el komander': 'banda',
  'christian nodal': 'banda',
  'gloria trevi': 'balada',
  'camila': 'balada',
  'alejandro sanz': 'balada',
  'prince royce': 'balada',
  'sebastian yatra': 'pop',
  'camilo': 'pop',
  'mau y ricky': 'pop',
  'mike bahia': 'pop',
  'floricienta': 'pop',
  'carlos vives': 'cumbia',
  'proyecto uno': 'cumbia',
  'raymix': 'cumbia',
  'bad bunny': 'reggaeton',
  'nicky jam': 'reggaeton',
  'maluma': 'reggaeton',
  'j balvin': 'reggaeton',
  'jhay cortez': 'reggaeton',
  'sech': 'reggaeton',
  'yandel': 'reggaeton',
  'tito el bambino': 'reggaeton',
  '6ix9ine': 'reggaeton',
  'the black eyed peas x j balvin': 'pop',
  'the black eyed peas': 'pop',
  'olga tanon': 'pop',
  'greeicy': 'pop',
};

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const item = argv[i];
    if (!item.startsWith('--')) {
      args._.push(item);
      continue;
    }
    const [rawKey, inlineValue] = item.slice(2).split('=');
    const key = rawKey.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    let value;
    if (inlineValue !== undefined) value = inlineValue;
    else if (argv[i + 1] && !argv[i + 1].startsWith('--')) value = argv[++i];
    else value = true;
    if (key === 'root' && typeof value === 'string') {
      if (!Array.isArray(args.root)) args.root = args.root ? [args.root] : [];
      args.root.push(value);
    } else {
      args[key] = value;
    }
  }
  return args;
}

function printHelp() {
  console.log(`
Uso:
  node scripts/import_party_tyme.js [opciones]

Opciones:
  --dry-run                Fuerza modo simulación (default)
  --root <dir>             Carpeta a escanear. Se puede repetir.
  --out <archivo>          CSV de salida (default: docs/party_tyme_manifest.csv)
  --report <archivo>       JSON de salida (default: docs/party_tyme_report.json)
  --upload                 Sube a R2 los ADD/REPLACE aprobados
  --refresh-r2             Lista R2 y usa el bucket como fuente de verdad
  --skip-same-title        No agregar pistas con el mismo título y otro artista
  --replace-duplicates     Marca duplicados exactos como REPLACE
  --include-probable       Agrega los duplicados probables en vez de dejarlos en REVIEW
  --overwrite              Sobrescribe objetos existentes al subir
  --concurrency <n>        Probes/upload en paralelo (default: 4)
  --limit <n>              Procesa solo las primeras N pistas (para pruebas)
  --no-ffprobe             No ejecuta ffprobe; usa duración 180
  --help                   Muestra esta ayuda
`);
}

function norm(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' y ')
    .replace(/['’`´]/g, '')
    .replace(/\b(feat|ft|featuring)\b\.?/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function alnum(value) {
  return norm(value).replace(/ /g, '');
}

function sigToks(value) {
  return norm(value).split(' ').filter((t) => t && !STOP.has(t) && !NOISE.has(t));
}

function artistToks(value) {
  return norm(value)
    .replace(/\b(y|and)\b/g, ' ')
    .split(' ')
    .filter((t) => t && !STOP.has(t) && t !== 'y' && t !== 'and');
}

function stripMeta(name) {
  let out = name.replace(/\.mp4$/i, '').trim();
  for (let i = 0; i < 4; i++) {
    const before = out;
    out = out
      .replace(/\s*\((?:versi[oó]n karaoke|version karaoke|descripci[oó]n|bq|[^()]*(?:1080p|720p|h264|kbit|aac|opus)[^()]*)\)\s*$/i, '')
      .trim();
    if (out === before) break;
  }
  return out;
}

function parseBase(base) {
  const ix = base.indexOf(' - ');
  if (ix < 0) return { artist: '', title: base.trim() };
  return { artist: base.slice(0, ix).trim(), title: base.slice(ix + 3).trim() };
}

function stripArtist(title, artist) {
  const t = sigToks(title);
  const a = artistToks(artist);
  if (!a.length) return t.join(' ');
  const ts = t.join(' ');
  const as = a.join(' ');
  if (ts.startsWith(as)) return t.slice(a.length).join(' ');
  if (ts.includes(` ${as} `)) return ts.replace(` ${as} `, ' ').replace(/\s+/g, ' ').trim();
  return ts;
}

function lev(a, b) {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m || !n) return Math.max(m, n);
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

function sim(a, b) {
  const length = Math.max(a.length, b.length);
  return length ? 1 - lev(a, b) / length : 0;
}

function jacc(a, b) {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const token of setA) if (setB.has(token)) intersection++;
  return intersection / (setA.size + setB.size - intersection);
}

function cover(a, b) {
  if (!a.length) return 0;
  const setB = new Set(b);
  let intersection = 0;
  for (const token of a) if (setB.has(token)) intersection++;
  return intersection / a.length;
}

function makeSongId(artist, title) {
  return `r2_${crypto.createHash('md5').update(`${artist}||${title}`, 'utf8').digest('hex').slice(0, 12)}`;
}

function cleanKeyPart(value) {
  return String(value || '')
    .replace(/[\/\\\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');
}

function makeR2Key(artist, title) {
  const cleanArtist = cleanKeyPart(artist) || 'Desconocido';
  const cleanTitle = cleanKeyPart(title) || 'Sin titulo';
  return `${cleanArtist} - ${cleanTitle}.mp4`;
}

function coreForGrouping(value) {
  return norm(String(value || '').replace(/\([^)]*\)/g, ' '));
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function walkMp4(target, baseDir, out = []) {
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(target)) walkMp4(path.join(target, name), baseDir, out);
    return out;
  }
  if (!/\.mp4$/i.test(target)) return out;
  out.push({
    path: target,
    file: path.basename(target),
    relative: path.relative(baseDir, target),
    collection: path.basename(path.dirname(target)),
    size: stat.size,
    mtimeMs: stat.mtimeMs,
  });
  return out;
}

function readProbeCache() {
  try {
    return JSON.parse(fs.readFileSync(PROBE_CACHE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function writeProbeCache(cache) {
  fs.mkdirSync(path.dirname(PROBE_CACHE_PATH), { recursive: true });
  fs.writeFileSync(PROBE_CACHE_PATH, JSON.stringify(cache));
}

async function probeDuration(file, size, mtimeMs, cache, useFfprobe) {
  const cached = cache[file];
  if (cached && cached.size === size && cached.mtimeMs === mtimeMs) return cached.duration;
  let duration = null;
  if (useFfprobe) {
    try {
      const { stdout } = await execFileAsync(
        'ffprobe',
        ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file],
        { timeout: 20000 }
      );
      const parsed = Number.parseFloat(String(stdout).trim());
      if (Number.isFinite(parsed) && parsed > 0) duration = Math.round(parsed);
    } catch {
      duration = null;
    }
  }
  if (duration === null && !useFfprobe) duration = 180;
  cache[file] = { size, mtimeMs, duration };
  return duration;
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function makeDbSongFromRow(row) {
  let file = '';
  try {
    file = decodeURIComponent(new URL(row.url).pathname.replace(/^\//, ''));
  } catch {
    file = decodeURIComponent(String(row.url || '').split('/').pop() || '');
  }
  const base = file.replace(/\.mp4$/i, '');
  const parsed = parseBase(base);
  const artist = row.artist || parsed.artist;
  const title = parsed.title || row.title;
  const core = sigToks(stripArtist(title, parsed.artist || row.artist));
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    genre: row.genre || 'pop',
    url: row.url,
    duration: row.duration,
    file,
    base,
    fArtist: parsed.artist,
    fTitle: parsed.title,
    artistT: artistToks(artist),
    nArtist: norm(artist),
    aArtist: alnum(artist),
    nTitle: norm(title),
    aTitle: alnum(title),
    aTitleBase: alnum(parsed.title),
    titleSig: sigToks(title),
    titleSigBase: sigToks(parsed.title),
    core,
    aCore: alnum(core.join(' ')),
    aFull: alnum(`${artist} ${title}`),
    aFullBase: alnum(`${artist} ${parsed.title}`),
  };
}

function loadLocalLibrary() {
  const rows = JSON.parse(fs.readFileSync(R2_DB_PATH, 'utf8'));
  return rows.map(makeDbSongFromRow);
}

function makeR2Client() {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('Faltan R2_ACCESS_KEY_ID y/o R2_SECRET_ACCESS_KEY en .env');
  }
  const { S3Client } = require('@aws-sdk/client-s3');
  return new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT || 'https://3bb6544fbc15f95620470c922b1a0dfe.r2.cloudflarestorage.com',
    credentials: { accessKeyId, secretAccessKey },
  });
}

async function listR2Keys(client, bucket) {
  const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
  const keys = [];
  let token;
  do {
    const response = await client.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }));
    for (const object of response.Contents || []) keys.push(object.Key);
    token = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

function primaryArtistKey(artist) {
  const normalized = norm(artist);
  if (GENRE_OVERRIDES[normalized]) return normalized;
  const parts = normalized.split(/\s+(?:y|and|feat|ft|x)\s+|,\s*/).filter(Boolean);
  return parts[0] || normalized;
}

function buildGenreMap(library) {
  const map = new Map();
  for (const song of library) {
    const key = norm(song.artist);
    if (!key) continue;
    if (!map.has(key)) map.set(key, new Map());
    const genres = map.get(key);
    genres.set(song.genre || 'pop', (genres.get(song.genre || 'pop') || 0) + 1);
  }
  for (const [key, genres] of map) {
    const best = [...genres.entries()].sort((a, b) => b[1] - a[1])[0];
    map.set(key, best[0]);
  }
  return map;
}

function inferGenre(artist, genreMap) {
  const normalized = norm(artist);
  if (GENRE_OVERRIDES[normalized]) return { genre: GENRE_OVERRIDES[normalized], source: 'override:exact' };
  if (genreMap.has(normalized)) return { genre: genreMap.get(normalized), source: 'db:exact' };
  const primary = primaryArtistKey(artist);
  if (GENRE_OVERRIDES[primary]) return { genre: GENRE_OVERRIDES[primary], source: 'override:primary' };
  if (genreMap.has(primary)) return { genre: genreMap.get(primary), source: 'db:primary' };
  return { genre: 'pop', source: 'fallback' };
}

function makeNewSong(file, genreMap) {
  const base = stripMeta(file.file);
  const parsed = parseBase(base);
  const genre = inferGenre(parsed.artist, genreMap);
  const core = sigToks(stripArtist(parsed.title, parsed.artist));
  return {
    ...file,
    base,
    artist: parsed.artist,
    title: parsed.title,
    artistT: artistToks(parsed.artist),
    nArtist: norm(parsed.artist),
    aArtist: alnum(parsed.artist),
    nTitle: norm(parsed.title),
    aTitle: alnum(parsed.title),
    titleSig: sigToks(parsed.title),
    core,
    aCore: alnum(core.join(' ')),
    aFull: alnum(`${parsed.artist} ${parsed.title}`),
    genre: genre.genre,
    genreSource: genre.source,
    r2Key: makeR2Key(parsed.artist, parsed.title),
    id: makeSongId(parsed.artist, parsed.title),
  };
}

function buildIndex(library) {
  const index = new Map();
  for (let i = 0; i < library.length; i++) {
    const song = library[i];
    for (const token of new Set([...song.titleSig, ...song.titleSigBase, ...song.core])) {
      if (token.length < 3 || NOISE.has(token)) continue;
      if (!index.has(token)) index.set(token, new Set());
      index.get(token).add(i);
    }
  }
  return index;
}

function artistScore(newSong, dbSong) {
  if (newSong.nArtist === dbSong.nArtist || newSong.aArtist === dbSong.aArtist) return 1;
  const a = newSong.artistT;
  const b = dbSong.artistT;
  let score = Math.max(jacc(a, b), Math.min(cover(a, b), cover(b, a)));
  if (b.includes('jr') || b.includes('hijo')) score = Math.min(score, 0.5);
  return score;
}

function evaluateCandidate(newSong, dbSong) {
  const dbSig = new Set([...dbSong.titleSig, ...dbSong.titleSigBase, ...dbSong.core]);
  const titleCoverage = cover(newSong.titleSig, [...dbSig]);
  const dbCoverage = cover([...dbSig], newSong.titleSig);
  const titleSim = Math.max(
    sim(newSong.aTitle, dbSong.aTitle),
    sim(newSong.aTitle, dbSong.aTitleBase),
    sim(newSong.aTitle, dbSong.aCore),
    sim(newSong.aTitle, dbSong.aTitle.replace(/low$/, ''))
  );
  const coreSim = Math.max(sim(newSong.aCore, dbSong.aCore), sim(newSong.aCore, dbSong.aTitle));
  return {
    dbSong,
    titleCoverage,
    dbCoverage,
    titleSim,
    coreSim,
    artistScore: artistScore(newSong, dbSong),
  };
}

function findBestMatch(newSong, library, index) {
  const candidateIndexes = new Set();
  for (const token of new Set(newSong.titleSig)) {
    const found = index.get(token);
    if (!found || found.size > 2500) continue;
    for (const indexValue of found) candidateIndexes.add(indexValue);
  }
  let pool = [...candidateIndexes].map((indexValue) => evaluateCandidate(newSong, library[indexValue]));
  if (!pool.length) pool = library.map((dbSong) => evaluateCandidate(newSong, dbSong));
  for (const entry of pool) {
    entry.titleBest = Math.max(entry.titleSim, entry.coreSim);
    entry.score = 0.55 * entry.titleBest + 0.25 * Math.min(entry.titleCoverage, 1) + 0.2 * entry.artistScore;
  }
  pool.sort((a, b) => b.score - a.score);
  return pool[0] || null;
}

function classify(newSong, best) {
  if (!best) return { state: 'NUEVO', score: 0, reason: '' };
  const { titleCoverage, dbCoverage, titleSim, coreSim, artistScore: artist } = best;
  const titleBest = Math.max(titleSim, coreSim);
  const reason = `artist=${artist.toFixed(2)} title=${titleBest.toFixed(2)} cover=${titleCoverage.toFixed(2)} db=${dbCoverage.toFixed(2)}`;
  if (artist >= 0.99 && (titleBest >= 0.97 || (titleCoverage === 1 && dbCoverage >= 0.8 && titleSim >= 0.8))) {
    return { state: 'DUPLICADO', score: best.score, reason };
  }
  if (artist >= 0.99 && titleBest >= 0.86) return { state: 'PROBABLE', score: best.score, reason };
  if (titleBest >= 0.985 && titleCoverage === 1 && dbCoverage >= 0.75) {
    return { state: 'MISMO_TITULO_OTRO_ARTISTA', score: best.score, reason };
  }
  if (artist >= 0.6 && titleBest >= 0.8) return { state: 'PROBABLE', score: best.score, reason };
  if (titleBest >= 0.93) return { state: 'TITULO_SIMILAR', score: best.score, reason };
  return { state: 'NUEVO', score: best.score, reason };
}

function decideAction(state, options) {
  if (state === 'PROMO') return 'SKIP_PROMO';
  if (state === 'DUPLICADO') return options.replaceDuplicates ? 'REPLACE' : 'SKIP_DUPLICATE';
  if (state === 'PROBABLE') return options.includeProbable ? 'ADD' : 'REVIEW';
  if (state === 'MISMO_TITULO_OTRO_ARTISTA' || state === 'TITULO_SIMILAR') {
    return options.skipSameTitle ? 'SKIP_SAME_TITLE' : 'ADD';
  }
  return 'ADD';
}

function groupEditionVariants(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (row.action !== 'ADD') continue;
    const key = `${norm(row.artist)}|${coreForGrouping(row.title)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.values()].filter((group) => group.length > 1);
}

function summarize(rows) {
  const counts = {};
  const genres = {};
  const artists = {};
  const collections = {};
  let addBytes = 0;
  for (const row of rows) {
    counts[row.action] = (counts[row.action] || 0) + 1;
    if (row.action === 'ADD') {
      addBytes += row.sizeBytes;
      genres[row.genre] = (genres[row.genre] || 0) + 1;
      artists[row.artist] = (artists[row.artist] || 0) + 1;
      collections[row.collection] = (collections[row.collection] || 0) + 1;
    }
  }
  return { counts, genres, artists, collections, addBytes };
}

function writeManifest(rows, outPath) {
  const headers = [
    'accion',
    'estado',
    'coleccion',
    'archivo',
    'artista',
    'titulo',
    'clave_r2',
    'id',
    'genero',
    'origen_genero',
    'duracion_seg',
    'tamano_mb',
    'coincidencia_r2',
    'artista_r2',
    'titulo_r2',
    'genero_r2',
    'score',
  ];
  const order = { ADD: 0, REPLACE: 1, REVIEW: 2, SKIP_DUPLICATE: 3, SKIP_SAME_TITLE: 4, SKIP_PROMO: 5 };
  const sorted = [...rows].sort((a, b) => {
    const actionDiff = (order[a.action] ?? 99) - (order[b.action] ?? 99);
    if (actionDiff) return actionDiff;
    return `${a.artist} ${a.title}`.localeCompare(`${b.artist} ${b.title}`, 'es');
  });
  const lines = [headers.join(',')];
  for (const row of sorted) {
    lines.push([
      row.action,
      row.state,
      row.collection,
      row.relative,
      row.artist,
      row.title,
      row.r2Key,
      row.id,
      row.genre,
      row.genreSource,
      row.duration,
      (row.sizeBytes / 1e6).toFixed(2),
      row.matchR2Key,
      row.matchArtist,
      row.matchTitle,
      row.matchGenre,
      row.score === null || row.score === undefined ? '' : Number(row.score).toFixed(3),
    ].map(csvCell).join(','));
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `\uFEFF${lines.join('\n')}\n`, 'utf8');
}

function writeReport(report, reportPath) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

function upsertSqlite(entries) {
  const db = new Database(SQLITE_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS songs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      genre TEXT DEFAULT 'pop',
      url TEXT NOT NULL,
      duration INTEGER DEFAULT 180
    );
  `);
  const columns = db.prepare('PRAGMA table_info(songs)').all().map((column) => column.name);
  if (!columns.includes('mode')) db.exec("ALTER TABLE songs ADD COLUMN mode TEXT DEFAULT ''");
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_genre ON songs(genre);
    CREATE INDEX IF NOT EXISTS idx_artist ON songs(artist);
  `);
  const statement = db.prepare(`
    INSERT INTO songs (id, title, artist, genre, url, duration)
    VALUES (@id, @title, @artist, @genre, @url, @duration)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      artist = excluded.artist,
      genre = excluded.genre,
      url = excluded.url,
      duration = excluded.duration
  `);
  const transaction = db.transaction((items) => {
    for (const item of items) {
      statement.run({
        id: item.id,
        title: item.title,
        artist: item.artist,
        genre: item.genre || 'pop',
        url: item.url,
        duration: item.duration || 180,
      });
    }
  });
  transaction(entries);
  db.pragma('wal_checkpoint(TRUNCATE)');
  const count = db.prepare('SELECT COUNT(*) AS count FROM songs').get().count;
  db.close();
  return count;
}

async function uploadApproved(rows, options, report) {
  const { PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
  const client = makeR2Client();
  const bucket = process.env.R2_BUCKET || 'ritmika';
  const existingKeys = new Set(await listR2Keys(client, bucket));
  const approved = rows.filter((row) => row.action === 'ADD' || row.action === 'REPLACE');
  const uploaded = [];
  const skipped = [];
  await mapLimit(approved, options.concurrency, async (row) => {
    const key = row.r2Key;
    if (existingKeys.has(key) && !options.overwrite && row.action === 'ADD') {
      skipped.push({ ...row, reason: 'object-exists' });
      return;
    }
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fs.createReadStream(row.absolutePath),
      ContentLength: row.sizeBytes,
      ContentType: 'video/mp4',
      CacheControl: 'public, max-age=31536000, immutable',
    }));
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    uploaded.push({ ...row, etag: head.ETag, uploaded: true });
  });
  const entries = JSON.parse(fs.readFileSync(R2_DB_PATH, 'utf8'));
  const byId = new Map(entries.map((entry, index) => [entry.id, index]));
  const byUrl = new Map(entries.map((entry, index) => [entry.url, index]));
  const dbEntries = [];
  for (const row of uploaded) {
    const entry = {
      id: row.id,
      title: row.title,
      artist: row.artist,
      genre: row.genre,
      url: `${CDN_BASE}/${encodeURIComponent(row.r2Key)}`,
      duration: row.duration || 180,
    };
    let finalEntry = entry;
    if (row.action === 'REPLACE' && row.matchR2Key) {
      const matchUrl = `${CDN_BASE}/${encodeURIComponent(row.matchR2Key)}`;
      const existingIndex = byUrl.has(matchUrl) ? byUrl.get(matchUrl) : byId.get(row.id);
      if (existingIndex !== undefined) {
        finalEntry = { ...entry, id: entries[existingIndex].id };
        entries[existingIndex] = finalEntry;
        byId.set(finalEntry.id, existingIndex);
        byUrl.set(finalEntry.url, existingIndex);
        row.id = finalEntry.id;
        dbEntries.push(finalEntry);
        continue;
      }
    }
    if (byId.has(entry.id)) {
      entry.id = makeSongId(`${row.artist} ${row.r2Key}`, row.title);
      row.id = entry.id;
    }
    byId.set(entry.id, entries.length);
    byUrl.set(entry.url, entries.length);
    entries.push(entry);
    dbEntries.push(entry);
  }
  const temporaryPath = `${R2_DB_PATH}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(entries, null, 2)}\n`, 'utf8');
  fs.renameSync(temporaryPath, R2_DB_PATH);
  const sqliteCount = upsertSqlite(dbEntries);
  report.upload = {
    enabled: true,
    uploaded: uploaded.length,
    skipped: skipped.length,
    skippedObjects: skipped.map((row) => ({ file: row.relative, key: row.r2Key, reason: row.reason })),
    r2DbCount: entries.length,
    sqliteCount,
  };
  return report;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  if (!fs.existsSync(R2_DB_PATH)) throw new Error(`No existe ${R2_DB_PATH}`);
  const options = {
    upload: Boolean(args.upload),
    refreshR2: Boolean(args.refreshR2),
    skipSameTitle: Boolean(args.skipSameTitle),
    replaceDuplicates: Boolean(args.replaceDuplicates),
    includeProbable: Boolean(args.includeProbable),
    overwrite: Boolean(args.overwrite),
    concurrency: Math.max(1, Number.parseInt(args.concurrency || '4', 10) || 4),
    limit: args.limit ? Number.parseInt(args.limit, 10) : null,
    useFfprobe: !args.noFfprobe,
    manifestPath: args.out ? path.resolve(args.out) : DEFAULT_MANIFEST,
    reportPath: args.report ? path.resolve(args.report) : DEFAULT_REPORT,
  };
  const roots = args.root
    ? (Array.isArray(args.root) ? args.root : [args.root]).map((item) => path.resolve(item))
    : DEFAULT_DIRS;
  const baseDir = args.root
    ? (roots.length === 1 ? (fs.statSync(roots[0]).isDirectory() ? roots[0] : path.dirname(roots[0])) : path.dirname(roots[0]))
    : path.dirname(DEFAULT_DIRS[0]);

  const files = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) throw new Error(`No existe la carpeta ${root}`);
    for (const file of walkMp4(root, baseDir)) files.push(file);
  }
  files.sort((a, b) => a.relative.localeCompare(b.relative, 'es'));
  const limitedFiles = options.limit ? files.slice(0, options.limit) : files;

  let library;
  let librarySource = 'local-r2-db';
  if (options.refreshR2 || options.upload) {
    const client = makeR2Client();
    const bucket = process.env.R2_BUCKET || 'ritmika';
    const keys = await listR2Keys(client, bucket);
    const local = loadLocalLibrary();
    const localByKey = new Map(local.map((song) => [song.file, song]));
    const fallbackGenreMap = buildGenreMap(local);
    library = keys.map((key) => {
      if (localByKey.has(key)) return localByKey.get(key);
      const parsed = parseBase(key.replace(/\.mp4$/i, ''));
      const genre = inferGenre(parsed.artist, fallbackGenreMap);
      return makeDbSongFromRow({
        id: makeSongId(parsed.artist, parsed.title),
        title: parsed.title,
        artist: parsed.artist,
        genre: genre.genre,
        url: `${CDN_BASE}/${encodeURIComponent(key)}`,
        duration: 180,
      });
    });
    librarySource = `r2-list:${keys.length}`;
  } else {
    library = loadLocalLibrary();
  }

  const genreMap = buildGenreMap(library);
  const index = buildIndex(library);
  const probeCache = readProbeCache();

  const probed = await mapLimit(limitedFiles, options.concurrency, async (file) => ({
    ...file,
    duration: await probeDuration(file.path, file.size, file.mtimeMs, probeCache, options.useFfprobe),
  }));
  writeProbeCache(probeCache);

  const keyCounts = new Map();
  const rows = [];
  const warnings = [];
  for (const file of probed) {
    const isPromo = /watch party/i.test(file.file) || !file.file.includes(' - ') || (file.duration !== null && file.duration < 20);
    const newSong = makeNewSong(file, genreMap);
    if (isPromo) {
      rows.push({
        action: 'SKIP_PROMO',
        state: 'PROMO',
        collection: file.collection,
        relative: file.relative,
        absolutePath: file.path,
        sizeBytes: file.size,
        artist: newSong.artist,
        title: newSong.title,
        r2Key: newSong.r2Key,
        id: newSong.id,
        genre: newSong.genre,
        genreSource: newSong.genreSource,
        duration: file.duration,
        matchR2Key: '',
        matchArtist: '',
        matchTitle: '',
        matchGenre: '',
        score: null,
        reason: 'promo',
      });
      continue;
    }
    const best = findBestMatch(newSong, library, index);
    const classification = classify(newSong, best);
    const action = decideAction(classification.state, options);
    const matched = classification.state !== 'NUEVO' && best;
    const keyBase = newSong.r2Key;
    let r2Key = keyBase;
    if (action === 'ADD' || action === 'REPLACE') {
      const keyCount = (keyCounts.get(keyBase) || 0) + 1;
      keyCounts.set(keyBase, keyCount);
      r2Key = keyCount === 1 ? keyBase : keyBase.replace(/\.mp4$/i, ` (${keyCount}).mp4`);
    }
    rows.push({
      action,
      state: classification.state,
      collection: file.collection,
      relative: file.relative,
      absolutePath: file.path,
      sizeBytes: file.size,
      artist: newSong.artist,
      title: newSong.title,
      r2Key,
      id: newSong.id,
      genre: newSong.genre,
      genreSource: newSong.genreSource,
      duration: file.duration,
      matchR2Key: matched ? best.dbSong.file : '',
      matchArtist: matched ? best.dbSong.artist : '',
      matchTitle: matched ? best.dbSong.title : '',
      matchGenre: matched ? best.dbSong.genre : '',
      score: matched ? classification.score : null,
      reason: matched ? classification.reason : '',
    });
  }

  const summary = summarize(rows);
  const duplicates = rows.filter((row) => row.state === 'DUPLICADO');
  const probable = rows.filter((row) => row.state === 'PROBABLE');
  const sameTitle = rows.filter((row) => row.state === 'MISMO_TITULO_OTRO_ARTISTA' || row.state === 'TITULO_SIMILAR');
  const promos = rows.filter((row) => row.state === 'PROMO');
  const editionVariants = groupEditionVariants(rows);
  const addRows = rows.filter((row) => row.action === 'ADD');

  if (probable.length) warnings.push(`${probable.length} duplicados probables quedaron en REVIEW; revisar el CSV.`);
  if (duplicates.length) warnings.push(`${duplicates.length} duplicados exactos serán omitidos.`);
  if (promos.length) warnings.push(`${promos.length} video(s) promocionales serán omitidos.`);
  if (!options.useFfprobe) warnings.push('ffprobe desactivado: las duraciones se guardaron como 180 s.');

  const report = {
    generated_at: new Date().toISOString(),
    mode: options.upload ? 'upload' : 'dry-run',
    options: {
      skip_same_title: options.skipSameTitle,
      replace_duplicates: options.replaceDuplicates,
      include_probable: options.includeProbable,
      overwrite: options.overwrite,
      use_ffprobe: options.useFfprobe,
    },
    scan: {
      roots,
      total_files: rows.length,
      total_bytes: rows.reduce((sum, row) => sum + row.sizeBytes, 0),
      songs: rows.length - promos.length,
      promos: promos.length,
    },
    library: {
      source: librarySource,
      count: library.length,
    },
    counts: summary.counts,
    add: {
      tracks: addRows.length,
      bytes: summary.addBytes,
      genres: summary.genres,
      artists: summary.artists,
      collections: summary.collections,
    },
    duplicates: duplicates.map((row) => ({
      file: row.relative,
      artist: row.artist,
      title: row.title,
      matched_key: row.matchR2Key,
      score: row.score,
    })),
    probable: probable.map((row) => ({
      file: row.relative,
      artist: row.artist,
      title: row.title,
      matched_key: row.matchR2Key,
      matched_artist: row.matchArtist,
      score: row.score,
      reason: row.reason,
    })),
    same_title: sameTitle.map((row) => ({
      file: row.relative,
      artist: row.artist,
      title: row.title,
      matched_key: row.matchR2Key,
      matched_artist: row.matchArtist,
      score: row.score,
    })),
    promos: promos.map((row) => ({ file: row.relative, duration: row.duration })),
    edition_variants: editionVariants.map((group) => group.map((row) => ({
      artist: row.artist,
      title: row.title,
      file: row.relative,
    }))),
    warnings,
  };

  writeManifest(rows, options.manifestPath);
  if (options.upload) {
    await uploadApproved(rows, options, report);
  }
  writeReport(report, options.reportPath);

  console.log(`Modo: ${report.mode}`);
  console.log(`Escaneados: ${report.scan.total_files} MP4 (${(report.scan.total_bytes / 1e9).toFixed(2)} GB)`);
  console.log(`Biblioteca: ${library.length} canciones (${librarySource})`);
  console.log(`Acciones: ${JSON.stringify(report.counts)}`);
  console.log(`Nuevas a agregar: ${report.add.tracks} (${(report.add.bytes / 1e9).toFixed(2)} GB)`);
  console.log(`Géneros: ${JSON.stringify(report.add.genres)}`);
  console.log(`Manifest: ${options.manifestPath}`);
  console.log(`Reporte: ${options.reportPath}`);
  if (warnings.length) warnings.forEach((warning) => console.log(`Aviso: ${warning}`));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
