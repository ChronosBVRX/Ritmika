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
const OUTPUT_DIR = path.resolve(__dirname, '..', 'public', 'assets', 'audio', 'emo');

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const PHRASES = {
  // Nuevas frases adicionales para mayor variedad en modo Emo
  "emo_intro_3": "¡Oh vaya, otra fiesta Emo! Prepárense para llorar por sus ex y desafinar con orgullo. 🖤",
  "emo_intro_4": "Si no traes delineador negro, puedes salir de la sala. Esto es Rítmika Emo. 💔",
  "emo_intro_5": "Hoy no venimos a ganar, venimos a desahogarnos. Bienvenidos al club de los corazones rotos.",
  "emo_roulette_2": "La ruleta gira, al igual que nuestra espiral de tristeza. ¿A quién le toca sufrir?",
  "emo_roulette_3": "Es hora de que la rueda decida quién va a pasar el ridículo más triste de la noche.",
  "emo_selected_2": "Te tocó a ti. Saca ese dolor atorado en la garganta y dale con todo.",
  "emo_selected_3": "No te escondas, el destino ya te eligió. Vamos, sube a decepcionarnos.",
  "emo_vote_good_2": "¡Qué intensidad! Si sigo escuchándote, me voy a pintar las uñas de negro.",
  "emo_vote_good_3": "Mis respetos. Cantaste con tanto dolor que me dieron ganas de mandarle un mensaje a mi ex.",
  "emo_vote_bad_2": "Eso dolió más que cuando se separó My Chemical Romance.",
  "emo_vote_bad_3": "Qué desastre. Cantas peor que mis decisiones amorosas en el 2009.",
  "emo_vote_bad_4": "Creí que venías a cantar Emo, no a hacer berrinche desafinado."
};

async function generateAudio(phraseId, text) {
  const filePath = path.join(OUTPUT_DIR, `${phraseId}.mp3`);
  if (fs.existsSync(filePath)) {
    console.log(`[SKIP] Ya existe ${phraseId}.mp3`);
    return;
  }
  console.log(`[GENERANDO] ${phraseId}...`);
  try {
    const response = await axios({
      method: 'post',
      url: `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      headers: { 'Accept': 'audio/mpeg', 'Content-Type': 'application/json', 'xi-api-key': API_KEY },
      data: { text: text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.6, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true } },
      responseType: 'stream'
    });
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);
    return new Promise((resolve, reject) => { writer.on('finish', resolve); writer.on('error', reject); });
  } catch (error) {
    console.error(`Error generando ${phraseId}:`, error.response ? error.response.statusText : error.message);
  }
}

async function main() {
  const keys = Object.keys(PHRASES);
  console.log(`Generando ${keys.length} audios Emo ADICIONALES...`);
  for (const key of keys) {
    await generateAudio(key, PHRASES[key]);
    await new Promise(r => setTimeout(r, 500));
  }
  console.log('¡Generación de audios Emo adicionales completada!');
}

main();
