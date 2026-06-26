const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "ljWLDJb7OMkYo3VM9z8g";

if (!API_KEY) {
  console.error('ERROR: ELEVENLABS_API_KEY no está definida en .env');
  process.exit(1);
}

const CONSTANTS_PATH = path.join(__dirname, '../public/js/tv/constants.js');
const AUDIO_DIR = path.join(__dirname, '../public/assets/audio');
const EMO_AUDIO_DIR = path.join(AUDIO_DIR, 'emo');

if (!fs.existsSync(EMO_AUDIO_DIR)) {
  fs.mkdirSync(EMO_AUDIO_DIR, { recursive: true });
}

// 1. Extraer todas las frases a generar desde constants.js
const constantsContent = fs.readFileSync(CONSTANTS_PATH, 'utf-8');

// Regex para encontrar algo como: text: "...", file: "emo/..."
const phraseRegex = /text:\s*["']([^"']+)["'][^}]+file:\s*["'](emo\/[^"']+\.mp3)["']/g;
let match;
const phrasesToGenerate = [];

while ((match = phraseRegex.exec(constantsContent)) !== null) {
  phrasesToGenerate.push({ text: match[1], file: match[2] });
}

console.log(`Encontradas ${phrasesToGenerate.length} frases con referencia de audio en constants.js`);

// 2. Filtrar las que ya existen
const missingPhrases = phrasesToGenerate.filter(item => {
  const fullPath = path.join(AUDIO_DIR, item.file);
  return !fs.existsSync(fullPath);
});

console.log(`Audios faltantes a generar: ${missingPhrases.length}\n`);

if (missingPhrases.length === 0) {
  console.log("Todos los audios Emo ya existen. No hay nada que generar.");
  process.exit(0);
}

const delay = ms => new Promise(res => setTimeout(res, ms));

async function generateAudio(text, outputPath) {
  try {
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        text: text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true
        }
      },
      {
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': API_KEY,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );
    
    fs.writeFileSync(outputPath, response.data);
    return true;
  } catch (error) {
    console.error(`Error generando audio para "${text}":`, error.response ? error.response.statusText : error.message);
    return false;
  }
}

async function main() {
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < missingPhrases.length; i++) {
    const item = missingPhrases[i];
    const fullPath = path.join(AUDIO_DIR, item.file);
    
    console.log(`[${i+1}/${missingPhrases.length}] Generando: ${item.file} -> "${item.text}"`);
    
    const success = await generateAudio(item.text, fullPath);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
    
    // Rate limiting: 1 segundo de espera entre peticiones
    await delay(1000);
  }
  
  console.log(`\nResumen de generación Emo:`);
  console.log(`- Exitosos: ${successCount}`);
  console.log(`- Fallidos: ${failCount}`);
  
  if (failCount > 0) {
    console.error("No se pudieron generar todos los audios.");
    process.exit(1);
  } else {
    console.log("¡Generación completa exitosamente!");
    process.exit(0);
  }
}

main();
