const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'server', 'songs.db');
const jsonPath = path.join(__dirname, '..', 'server', 'r2_db.json');

if (!fs.existsSync(jsonPath)) {
  console.error('r2_db.json not found at', jsonPath);
  process.exit(1);
}

// Remove existing DB if present
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE songs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    genre TEXT DEFAULT 'pop',
    url TEXT NOT NULL,
    duration INTEGER DEFAULT 180
  );
  CREATE INDEX idx_genre ON songs(genre);
  CREATE INDEX idx_artist ON songs(artist);
`);

const raw = fs.readFileSync(jsonPath, 'utf8');
const songs = JSON.parse(raw);

const insert = db.prepare('INSERT INTO songs (id, title, artist, genre, url, duration) VALUES (?, ?, ?, ?, ?, ?)');

const tx = db.transaction((items) => {
  for (const s of items) {
    insert.run(s.id, s.title, s.artist, s.genre || 'pop', s.url, s.duration || 180);
  }
});

tx(songs);

const count = db.prepare('SELECT COUNT(*) as cnt FROM songs').get().cnt;
console.log(`Migrated ${count} songs to ${dbPath}`);
db.close();
