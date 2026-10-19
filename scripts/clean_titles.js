const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const root = path.join(__dirname, '..');
const jsonPath = path.join(root, 'server', 'r2_db.json');
const dbPath = path.join(root, 'server', 'songs.db');
const reportPath = path.join(root, 'docs', 'title_cleanup_report.json');

const ACCENT = { a: '[aáàäâã]', e: '[eéèëê]', i: '[iíìïî]', o: '[oóòöôõ]', u: '[uúùüû]', n: '[nñ]', c: '[cç]' };

function artistRegex(artist) {
  let out = '';
  for (const ch of artist) {
    const low = ch.toLowerCase();
    if (ACCENT[low]) out += ACCENT[low];
    else if (/[a-z0-9]/i.test(ch)) out += ch;
    else out += `\\s*${ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`;
  }
  return out;
}

function stripArtist(text, artist) {
  if (!artist) return { text, stripped: false };
  const re = artistRegex(artist);
  let stripped = false;
  let out = text;
  const patterns = [
    new RegExp(`^\\s*${re}\\s*[-–—:]\\s*`, 'i'),
    new RegExp(`\\s*[-–—:]\\s*${re}\\s*$`, 'i'),
    new RegExp(`^\\s*${re}\\s+`, 'i'),
    new RegExp(`\\s+${re}\\s*$`, 'i'),
    new RegExp(`\\s+(?:&|y|feat\\.?|ft\\.?)\\s+${re}\\s*$`, 'i'),
  ];
  for (const pattern of patterns) {
    const next = out.replace(pattern, ' ');
    if (next !== out) {
      stripped = true;
      out = next;
    }
  }
  return { text: out, stripped };
}

function cleanTitle(raw, artist) {
  let text = String(raw || '');
  if (!text) return text;
  const original = text;

  text = text.replace(/\.(mp4|mpg|mpeg|avi|wmv|flv|mkv|webm|mov|3gp)$/i, ' ');
  text = text.replace(/\(\s*\)/g, ' ').replace(/\[\s*\]/g, ' ');
  text = text.replace(/\((?:[^()]*\b(?:con\s+letra|letra|lyrics?|instrumental|karaoke|kareoke|kv|versi[oó]n|version|cover|demo|original|oficial|official|full\s*hd|hd|1080p|720p|radio|piano|remake|canta\s*gratis|pista|no\s+lead\s+vocal|backing\s+vocals)\b[^()]*)\)/gi, ' ');

  if (artist) {
    const re = artistRegex(artist);
    text = text.replace(new RegExp(`\\(\\s*${re}\\s*\\)`, 'gi'), ' ');
    text = text.replace(new RegExp(`\\[\\s*${re}\\s*\\]`, 'gi'), ' ');
    text = text.replace(new RegExp(`['"“”]\\s*${re}\\s*['"“”]`, 'gi'), ' ');
  }

  text = text.replace(/\bin\s+the\s+style\s+of\b.*$/i, ' ');
  text = text.replace(/\bin\s+style\s+of\b.*$/i, ' ');
  text = text.replace(/\bwith\s+lyrics\b.*$/i, ' ');
  text = text.replace(/\bno\s+lead\s+vocal\b.*$/i, ' ');
  text = text.replace(/\bwith\s+backing\s+vocals\b.*$/i, ' ');
  text = text.replace(/\bbacking\s+vocals\b.*$/i, ' ');
  text = text.replace(/\bsonido\s+original\b.*$/i, ' ');
  text = text.replace(/\bofficial\s+clip\b.*$/i, ' ');
  text = text.replace(/\bvideo\s+oficial\b.*$/i, ' ');
  text = text.replace(/\bal\s+estilo\s+de\b.*$/i, ' ');
  text = text.replace(/\bestilo\s+de\b.*$/i, ' ');
  text = text.replace(/\bpista\s+y\s+letra\b.*$/i, ' ');
  text = text.replace(/\bcon\s+letra\b.*$/i, ' ');
  text = text.replace(/\bpopular\s+por\b.*$/i, ' ');
  text = text.replace(/\bguitar\s+version\b.*$/i, ' ');
  text = text.replace(/\bkaraokanta\b\s*-?\s*/gi, ' ');
  text = text.replace(/[►\u25ba]?\s*exito\s+de\b.*$/i, ' ');
  text = text.replace(/\bsolo\s+como\s+referencia\b.*$/i, ' ');
  text = text.replace(/\bversion\s+original\b.*$/i, ' ');
  text = text.replace(/\boriginal\s+\d{4}\b.*$/i, ' ');

  if (artist) {
    const re = artistRegex(artist);
    text = text.replace(new RegExp(`^\\s*como\\s+${re}\\b\\s*[-–—:]?\\s*`, 'i'), ' ');
    text = text.replace(new RegExp(`\\bcomo\\s+${re}\\b\\s*[-–—:]?\\s*`, 'i'), ' ');
    text = text.replace(new RegExp(`\\bcomo\\s+${re}\\b.*$`, 'i'), ' ');
  }

  text = text.replace(/^(?:(?:multi|karaoke|karaokanta|hd|full\s*hd|pistas?|and)\b)\s*[-–—:]?\s+/i, ' ');
  text = text.replace(/\b(?:cdg|avi|mpg|mp4|wmv|flv|midi)\b/gi, ' ');

  let previous;
  do {
    previous = text;
    text = text.replace(/\s+(?:low|multi|hd|gratis|online|completo|y|e)\s*$/i, ' ');
    text = text.replace(/[-–—:;,.]+\s*$/, ' ');
    text = text.replace(/\s+/g, ' ').trim();
  } while (text !== previous);

  if (artist) {
    let strippedAny = false;
    for (let i = 0; i < 2; i++) {
      const result = stripArtist(text, artist);
      text = result.text;
      if (result.stripped) strippedAny = true;
      text = text.replace(/[-–—:;,.]+\s*$/, ' ').replace(/\s+/g, ' ').trim();
    }
    if (strippedAny) text = text.replace(/^\s*(?:&|\by\b)\s+/i, ' ');
  }

  do {
    previous = text;
    text = text.replace(/\s+(?:low|multi|hd|gratis|online|completo|y|e)\s*$/i, ' ');
    text = text.replace(/[-–—:;,.]+\s*$/, ' ');
    text = text.replace(/\s+/g, ' ').trim();
  } while (text !== previous);

  text = text.replace(/^[-–—:;,.!¡¿?"'“”]+/, '').replace(/[-–—:;,.]+\s*$/, '').trim();
  text = text.replace(/^&\s*/, '').trim();

  if (!/[a-z0-9áéíóúñ]/i.test(text) || text.length < 2) return original;
  return text;
}

const songs = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const changes = [];
for (const song of songs) {
  const cleaned = cleanTitle(song.title, song.artist);
  if (cleaned !== song.title) changes.push({ id: song.id, artist: song.artist, before: song.title, after: cleaned });
}

const apply = process.argv.includes('--apply');
const summary = {
  generated_at: new Date().toISOString(),
  total: songs.length,
  changed: changes.length,
  samples: changes.slice(0, 200),
};

if (!apply) {
  summary.mode = 'dry-run';
  fs.writeFileSync(reportPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(`Dry-run: ${changes.length}/${songs.length} títulos cambiarían.`);
  for (const change of changes.slice(0, 40)) {
    console.log(`  [${change.artist}] "${change.before}" -> "${change.after}"`);
  }
  console.log(`Reporte: ${reportPath}`);
  process.exit(0);
}

for (const change of changes) {
  const song = songs.find((item) => item.id === change.id);
  if (song) song.title = change.after;
}
const temporaryPath = `${jsonPath}.tmp`;
fs.writeFileSync(temporaryPath, `${JSON.stringify(songs, null, 2)}\n`, 'utf8');
fs.renameSync(temporaryPath, jsonPath);

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
const update = db.prepare('UPDATE songs SET title = ? WHERE id = ?');
const transaction = db.transaction((items) => {
  for (const item of items) update.run(item.after, item.id);
});
transaction(changes);
db.exec('ANALYZE');
db.pragma('optimize');
db.pragma('wal_checkpoint(TRUNCATE)');
const count = db.prepare('SELECT COUNT(*) c FROM songs').get().c;
db.close();

summary.mode = 'apply';
summary.applied = changes.length;
summary.db_count = count;
fs.writeFileSync(reportPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
console.log(`Aplicados ${changes.length} cambios de título. Total en SQLite: ${count}.`);
