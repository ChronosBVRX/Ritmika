const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'server', 'songs.db');

const EMO_ARTISTS = [
  'Panda', 'PXNDX', 'Kudai', 'Linkin Park', 'Green Day', 'Simple Plan',
  'Nikki Clan', 'Mago De Oz', 'Mago de Oz', 'Zoe', 'Fobia', 'Allison',
  'My Chemical Romance', 'Paramore', 'Fall Out Boy', 'Blink 182', 'Blink-182',
];

const NOSTALGIA_ARTISTS = [
  'Timbiriche', 'La Nueva Banda Timbiriche', 'OV7', 'Kabah', 'Mecano',
  'Magneto', 'Fey', 'Sentidos Opuestos', 'Flans', 'Pandora', 'Luis Miguel',
  'Chayanne', 'Ricky Martin', 'Thalia', 'Paulina Rubio', 'Alejandra Guzman',
  'Gloria Trevi', 'RBD', 'Belinda', 'Menudo', 'Garibaldi', 'Jeans', 'MDO',
];

const RANCHERA_ARTISTS = [
  'Paquita La Del Barrio', "Lupita D'alessio", 'Rocio Durcal', 'Ana Gabriel',
  'Rocio Jurado', 'Juan Gabriel', 'Alejandro Fernandez', 'Vicente Fernandez',
  'Jenni Rivera', 'Christian Nodal', 'Carin Leon', 'Espinoza Paz',
  'El Komander', 'Chalino Sanchez', 'Los Tigres Del Norte', 'Banda MS',
  'Intocable', 'Los Temerarios', 'Julion Alvarez', 'Banda El Recodo',
  'La Arrolladora Banda el Limon',
];

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const setMode = db.prepare("UPDATE songs SET mode = ? WHERE (mode IS NULL OR mode = '') AND LOWER(artist) LIKE LOWER(?)");
const setGenreMode = db.prepare("UPDATE songs SET mode = ? WHERE (mode IS NULL OR mode = '') AND LOWER(genre) = ?");

const transaction = db.transaction(() => {
  setGenreMode.run('ranchera', 'ranchera');
  for (const artist of RANCHERA_ARTISTS) setMode.run('ranchera', `%${artist}%`);
  for (const artist of EMO_ARTISTS) setMode.run('emo', `%${artist}%`);
  for (const artist of NOSTALGIA_ARTISTS) setMode.run('nostalgia', `%${artist}%`);
});

transaction();
db.exec('ANALYZE');
db.pragma('optimize');
db.pragma('wal_checkpoint(TRUNCATE)');

const counts = db.prepare("SELECT CASE WHEN mode IS NULL OR mode = '' THEN '(vacio)' ELSE mode END m, COUNT(*) c FROM songs GROUP BY m ORDER BY c DESC").all();
db.close();
console.log('Modos asignados:');
for (const row of counts) console.log(`  ${row.m}: ${row.c}`);
