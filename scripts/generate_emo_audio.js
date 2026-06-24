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
const OUTPUT_DIR = path.resolve(__dirname, '..', 'public', 'assets', 'audio');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const PHRASES = {
  "emo_intro_0": "¡Bienvenidos a Fiesta Emo! Hoy no se canta, se sangra emocionalmente.",
  "emo_intro_1": "Delineador listo, corazón roto y garganta temblando. Esto es Rítmika Emo.",
  "emo_intro_2": "No es una fase, es una competencia con trauma musical.",
  "emo_roulette_0": "La ruleta va a elegir quién abre su diario frente a todos.",
  "emo_roulette_1": "Gira la rueda del dolor adolescente. A ver quién llora primero.",
  "emo_selected_0": "Te tocó. Sube al escenario y decepciona a tu ex con estilo.",
  "emo_selected_1": "El destino eligió tu sufrimiento. Canta como si fuera 2008.",
  "emo_vote_0": "Hora de votar. ¿Fue arte, drama o puro berrinche afinado?",
  "emo_vote_1": "Califiquen con el corazón roto, pero con honestidad.",
  "emo_blackout_0": "Se fue la letra, como se fue esa persona. Sigue cantando.",
  "emo_blackout_1": "Sin pantalla, sin ayuda y sin estabilidad emocional.",
  "emo_award_0": "Ni tu ex te dejó tan mal como esta puntuación.",
  "emo_award_1": "Esa indirecta dolió hasta en la otra cuadra.",
  "emo_award_2": "Cantaste en la oscuridad mejor que en la luz."
};

async function generateAudio(text, filename) {
  const filePath = path.join(OUTPUT_DIR, filename);
  if (fs.existsSync(filePath)) {
    console.log(`El archivo ${filename} ya existe. Saltando...`);
    return;
  }

  console.log(`Generando: ${filename} - "${text}"`);
  
  try {
    const response = await axios({
      method: 'post',
      url: `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      headers: {
        'Accept': 'audio/mpeg',
        'xi-api-key': API_KEY,
        'Content-Type': 'application/json'
      },
      data: {
        text: text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true
        }
      },
      responseType: 'stream'
    });

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  } catch (error) {
    console.error(`Error generando ${filename}:`, error.message);
    if (error.response && error.response.status === 401) {
       console.error("API KEY INVALIDE");
       process.exit(1);
    }
  }
}

async function run() {
  for (const [key, text] of Object.entries(PHRASES)) {
    await generateAudio(text, `${key}.mp3`);
    await new Promise(r => setTimeout(r, 500)); // Respect rate limits
  }
  console.log('¡Generación de audio completada!');
}

run();
