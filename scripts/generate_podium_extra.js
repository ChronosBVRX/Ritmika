const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "ljWLDJb7OMkYo3VM9z8g";

const OUTPUT_DIR = path.resolve(__dirname, '..', 'public', 'assets', 'audio');

const EXTRA_PHRASES = {
  "podium_intro_ceremony": "¡Llegó la hora! Vamos a ver quién se lleva la gloria y quién se lleva la carrilla. ¡Comienza la premiación!",
  "podium_winner_reveal": "¡Y el ganador de la noche es... El Rey del Palenque ha sido coronado!"
};

async function generateAudio(filename, text) {
  const filePath = path.join(OUTPUT_DIR, `${filename}.mp3`);
  try {
    console.log(`Generando Voz: ${filename}`);
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        text: text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.1, use_speaker_boost: true }
      },
      {
        headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
        responseType: 'stream'
      }
    );

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve());
      writer.on('error', reject);
    });
  } catch (error) {
    console.error(`[ERROR] Falló ${filename}:`, error.message);
  }
}

async function run() {
  const keys = Object.keys(EXTRA_PHRASES);
  for (let key of keys) {
    await generateAudio(key, EXTRA_PHRASES[key]);
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log('Extra audios generated.');
}

run();
