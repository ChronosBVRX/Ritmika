const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..', 'server', 'songs.db');
const jsonPath = process.argv[3] ? path.resolve(process.argv[3]) : path.join(__dirname, '..', 'server', 'r2_db.json');

if (!fs.existsSync(jsonPath)) {
  console.error('r2_db.json not found at', jsonPath);
  process.exit(1);
}

const db = new Database(dbPath);
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
  CREATE INDEX IF NOT EXISTS idx_genre_lower ON songs(LOWER(genre));
  CREATE INDEX IF NOT EXISTS idx_genre_lower_artist ON songs(LOWER(genre), artist);
  CREATE INDEX IF NOT EXISTS idx_artist_lower ON songs(LOWER(artist));
  CREATE INDEX IF NOT EXISTS idx_mode_lower ON songs(LOWER(mode));
  CREATE INDEX IF NOT EXISTS idx_title ON songs(title);
`);

const raw = fs.readFileSync(jsonPath, 'utf8');
const songs = JSON.parse(raw);

const upsert = db.prepare(`
  INSERT INTO songs (id, title, artist, genre, url, duration)
  VALUES (@id, @title, @artist, @genre, @url, @duration)
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title,
    artist = excluded.artist,
    genre = excluded.genre,
    url = excluded.url,
    duration = excluded.duration
`);

const tx = db.transaction((items) => {
  for (const song of items) {
    upsert.run({
      id: song.id,
      title: song.title,
      artist: song.artist,
      genre: song.genre || 'pop',
      url: song.url,
      duration: song.duration || 180,
    });
  }
});

tx(songs);
db.exec('ANALYZE');
db.pragma('optimize');
db.pragma('wal_checkpoint(TRUNCATE)');

const count = db.prepare('SELECT COUNT(*) as cnt FROM songs').get().cnt;
console.log(`Upserted ${songs.length} songs (${count} total) to ${dbPath}`);
db.close();
