const fs = require('fs');
const path = require('path');

const CONSTANTS_PATH = path.join(__dirname, '../public/js/tv/constants.js');
const AUDIO_DIR = path.join(__dirname, '../public/assets/audio');

// Leer constants.js
const constantsContent = fs.readFileSync(CONSTANTS_PATH, 'utf-8');

// Encontrar todas las menciones a archivos Emo
const fileRegex = /file:\s*['"](emo\/[^'"]+\.mp3)['"]/g;
let match;
const filesToVerify = new Set();

while ((match = fileRegex.exec(constantsContent)) !== null) {
  filesToVerify.add(match[1]);
}

console.log(`Auditoría de Audio Emo: ${filesToVerify.size} archivos referenciados en constants.js`);

const missingFiles = [];
const foundFiles = [];

filesToVerify.forEach(fileRelPath => {
  const fullPath = path.join(AUDIO_DIR, fileRelPath);
  if (fs.existsSync(fullPath)) {
    foundFiles.push(fileRelPath);
  } else {
    missingFiles.push(fileRelPath);
  }
});

console.log(`\nArchivos encontrados: ${foundFiles.length}`);
console.log(`Archivos faltantes: ${missingFiles.length}`);

if (missingFiles.length > 0) {
  console.log('\n[FALTAN LOS SIGUIENTES AUDIOS]');
  missingFiles.forEach(file => {
    console.log(`- ${file}`);
  });
  console.error('\nERROR: Faltan archivos de audio Emo. Ejecuta npm run generate:emo-audio');
  process.exit(1);
} else {
  console.log('\n¡Todo listo! Todos los archivos Emo requeridos existen.');
  process.exit(0);
}
