const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const root = path.join(__dirname, '..');
const overridesPath = path.join(root, 'server', 'artist_overrides.json');
const jsonPath = path.join(root, 'server', 'r2_db.json');
const dbPath = path.join(root, 'server', 'songs.db');

function norm(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' y ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const overrides = JSON.parse(fs.readFileSync(overridesPath, 'utf8'));
const songs = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const changes = [];
const byArtist = {};

for (const song of songs) {
  const canonical = overrides[norm(song.artist)];
  if (canonical && canonical !== song.artist) {
    changes.push({ id: song.id, before: song.artist, after: canonical });
    byArtist[song.artist] = canonical;
    song.artist = canonical;
  }
}

if (!changes.length) {
  console.log('Sin cambios de artista.');
  process.exit(0);
}

const temporaryPath = `${jsonPath}.tmp`;
fs.writeFileSync(temporaryPath, `${JSON.stringify(songs, null, 2)}\n`, 'utf8');
fs.renameSync(temporaryPath, jsonPath);

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
const update = db.prepare('UPDATE songs SET artist = ? WHERE id = ?');
const transaction = db.transaction((items) => {
  for (const item of items) update.run(item.after, item.id);
});
transaction(changes);
db.exec('ANALYZE');
db.pragma('optimize');
db.pragma('wal_checkpoint(TRUNCATE)');
const uniqueArtists = db.prepare('SELECT COUNT(DISTINCT artist) c FROM songs').get().c;
db.close();

console.log(`Canciones actualizadas: ${changes.length}`);
for (const [before, after] of Object.entries(byArtist)) {
  console.log(`  ${before} -> ${after}`);
}
console.log(`Artistas únicos: ${uniqueArtists}`);
