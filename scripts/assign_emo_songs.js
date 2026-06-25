const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'server', 'songs.db');
const db = new Database(dbPath);

const emoArtists = [
  'pxndx', 'panda', 'my chemical romance', 'paramore', 'fall out boy', 'allison', 
  'simple plan', 'kudai', 'moderatto', 'evanescence', 'linkin park', 'green day', 
  'avril lavigne', 'panic! at the disco', 'belanova', 'insite', 'division minuscula', 
  'división minúscula', 'good charlotte', 'blink-182', 'blink 182', '30 seconds to mars', 
  'tokio hotel', 'zoé', 'zoe', 'cafe tacvba', 'enjambre', 'porter', 'moenia',
  // Extra bonus to have plenty of songs
  'pimpinela', 'mago de oz', 'enrique bunbury', 'heroes del silencio'
];

console.log('Asignando modo emo a canciones de artistas específicos...');

const updateStmt = db.prepare(`UPDATE songs SET mode = 'emo' WHERE LOWER(artist) LIKE ?`);

let totalUpdated = 0;

emoArtists.forEach(artist => {
  const result = updateStmt.run(`%${artist.toLowerCase()}%`);
  if (result.changes > 0) {
    console.log(`- ${artist}: ${result.changes} canciones actualizadas.`);
    totalUpdated += result.changes;
  }
});

console.log(`Total de canciones actualizadas al modo emo: ${totalUpdated}`);
