const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '../server/songs.db');
const outPath = path.join(__dirname, '../server/shared/artist-metadata.json');

if (!fs.existsSync(dbPath)) {
  console.error('songs.db not found at', dbPath);
  process.exit(1);
}
const db = new Database(dbPath, { readonly: true });
const rows = db.prepare('SELECT DISTINCT genre, artist FROM songs WHERE genre IS NOT NULL ORDER BY genre, artist').all();
const map = {};
for (const r of rows) {
  const g = r.genre.toLowerCase();
  if (!map[g]) map[g] = [];
  if (!map[g].includes(r.artist)) map[g].push(r.artist);
}
// Also include every game mode grouping (if mode column exists)
const modes = db.prepare("SELECT DISTINCT LOWER(mode) AS mode, artist FROM songs WHERE mode IS NOT NULL AND mode != '' ORDER BY mode, artist").all();
for (const row of modes) {
  if (!map[row.mode]) map[row.mode] = [];
  if (!map[row.mode].includes(row.artist)) map[row.mode].push(row.artist);
}
fs.writeFileSync(outPath, JSON.stringify(map, null, 2), 'utf8');
console.log(`[artist-metadata] Wrote ${Object.keys(map).length} genres to ${outPath}`);
for (const g of Object.keys(map)) console.log(`  ${g}: ${map[g].length}`);
db.close();
