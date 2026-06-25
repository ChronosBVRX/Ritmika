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

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Emo / Persona 5 Phrases
const PHRASES = {
  "emo_lobby_0": "Bienvenidos a este rincón de miseria... digo, al lobby de Rítmika. Vamos a llorar juntos.",
  "emo_lobby_1": "Todo es efímero. Igual que tu afinación. Conéctense rápido para terminar con este sufrimiento.",
  "emo_lobby_2": "La pantalla está oscura, como mi alma. Únanse a la sala antes de que me arrepienta.",
  "emo_lobby_3": "Suspirar no sirve de nada. Escaneen el código y preparen esos pulmones rotos.",
  "emo_lobby_idle_0": "El silencio es ensordecedor... igual que sus promesas vacías.",
  "emo_lobby_idle_1": "¿A qué hora empezamos? La depresión no se va a curar sola.",

  "emo_round_1_intro": "Ronda uno: Tu Diario de Depresión. Escojan la canción que más les duela. O la que cantan en la regadera.",
  "emo_round_2_intro": "Ronda dos: Trauma Compartido. Asigna una canción a alguien más. Destruyan su dignidad, confío en ustedes.",
  "emo_round_3_intro": "Ronda tres: Apagón Emocional. Canten desde la memoria, a oscuras. Como si todavía doliera.",

  "emo_roulette_spin": "La ruleta del sufrimiento está girando. A ver a quién le toca exponer su corazón.",
  "emo_roulette_result_0": "Qué tragedia. Te toca cantar.",
  "emo_roulette_result_1": "Destino cruel. El escenario es tuyo.",
  
  "emo_vote_good_0": "Wow. Me hiciste llorar, y eso que soy un ajolote digital.",
  "emo_vote_good_1": "Tanta oscuridad en esa interpretación. Fue... poético.",
  "emo_vote_bad_0": "Eso no dolió por el sentimiento, dolió por la desafinación.",
  "emo_vote_bad_1": "Mis oídos lloran sangre. Y no de manera artística.",

  "emo_sabotage_0": "Alguien acaba de sabotearte. Qué traición tan clásica.",
  "emo_tomato_0": "Te aventaron un tomate virtual. La humillación es total.",
  
  "emo_podium_intro": "Y así termina nuestra sesión de terapia grupal. Veamos quién sufrió más.",
  "emo_podium_winner": "El rey de la desgracia. Ganaste, supongo. Felicidades por tu victoria vacía."
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
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': API_KEY
      },
      data: {
        text: text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.6, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true }
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
    console.error(`Error generando ${phraseId}:`, error.response ? error.response.statusText : error.message);
  }
}

async function main() {
  const keys = Object.keys(PHRASES);
  console.log(`Generando ${keys.length} audios Emo...`);
  for (const key of keys) {
    await generateAudio(key, PHRASES[key]);
    await new Promise(r => setTimeout(r, 500));
  }
  console.log('¡Generación de audios Emo completada!');
}

main();
