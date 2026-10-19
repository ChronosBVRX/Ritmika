const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const root = path.join(__dirname, '..');
const overridesPath = path.join(root, 'server', 'genre_overrides.json');
const jsonPath = path.join(root, 'server', 'r2_db.json');
const dbPath = path.join(root, 'server', 'songs.db');

function norm(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' y ')
    .replace(/\b(feat|ft|featuring)\b\.?/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function resolveGenre(artist, overrides) {
  const key = norm(artist);
  if (overrides.exact && overrides.exact[key]) {
    return { genre: overrides.exact[key], source: 'exact' };
  }
  for (const [prefix, genre] of Object.entries(overrides.prefix || {})) {
    if (key === prefix || key.startsWith(`${prefix} `)) return { genre, source: `prefix:${prefix}` };
  }
  return null;
}

const overrides = JSON.parse(fs.readFileSync(overridesPath, 'utf8'));
const songs = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const changes = [];
const byArtist = {};
const before = {};
const after = {};

for (const song of songs) {
  const current = song.genre || 'pop';
  before[current] = (before[current] || 0) + 1;
  const resolved = resolveGenre(song.artist, overrides);
  const next = resolved ? resolved.genre : current;
  after[next] = (after[next] || 0) + 1;
  if (next !== current) {
    changes.push({ id: song.id, artist: song.artist, title: song.title, from: current, to: next, source: resolved.source });
    byArtist[song.artist] ||= { from: current, to: next, count: 0, source: resolved.source };
    byArtist[song.artist].count++;
    song.genre = next;
  }
}

if (!changes.length) {
  console.log('Sin cambios de género.');
  process.exit(0);
}

const temporaryPath = `${jsonPath}.tmp`;
fs.writeFileSync(temporaryPath, `${JSON.stringify(songs, null, 2)}\n`, 'utf8');
fs.renameSync(temporaryPath, jsonPath);

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
const update = db.prepare('UPDATE songs SET genre = ? WHERE id = ?');
const transaction = db.transaction((items) => {
  for (const item of items) update.run(item.to, item.id);
});
transaction(changes);
db.exec('ANALYZE');
db.pragma('optimize');
db.pragma('wal_checkpoint(TRUNCATE)');
const finalGenres = db.prepare('SELECT genre, COUNT(*) c FROM songs GROUP BY genre ORDER BY c DESC').all();
db.close();

console.log(`Canciones actualizadas: ${changes.length}`);
console.log('Por artista:');
for (const [artist, data] of Object.entries(byArtist).sort((a, b) => b[1].count - a[1].count)) {
  console.log(`  ${artist}: ${data.from} -> ${data.to} (${data.count}) [${data.source}]`);
}
console.log('Antes:', before);
console.log('Después:', after);
console.log('DB final:', Object.fromEntries(finalGenres.map((row) => [row.genre, row.c])));
