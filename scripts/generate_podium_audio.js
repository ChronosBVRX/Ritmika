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

const NEW_PHRASES = {
  "final_victory_0": "¡Felicidades al ganador, te la rifaste de veras!",
  "final_victory_1": "¡Tenemos campeón absoluto! Eres el mero mero del palenque.",
  "final_victory_2": "¡Te coronaste! La banda te aclama y el Tío Axolo te aplaude.",
  "podium_climax_0": "¡Y así termina la noche más épica del año! ¡El Rey del Palenque ha sido coronado! ¡Gracias banda por esta noche de gloria, carrilla y algún que otro tomate! ¡Hasta la próxima fiesta!",
  "podium_climax_1": "¡Qué noche, señores! El palenque se cierra pero las risas se quedan. ¡Felicidades a los ganadores y gracias a todos por aguantar la carrilla!",
  "podium_climax_2": "¡La fiesta llegó a su fin! Coronamos al rey, abucheamos al gallo y nos divertimos como locos. ¡Nos vemos en la próxima ronda de Rítmika! ¡Adiós!",
  "new_game_0": "¡Nueva partida! Esperando jugadores...",
  "new_game_1": "¡Mesa limpia! Nueva partida iniciada. Vayan entrando todos.",
  "new_game_2": "¡Reiniciamos la diversión! Esperando que se unan los cantantes."
};

const SFX_PROMPTS = {
  "sfx_drumroll": "A dramatic snare drum roll building up tension for a grand reveal in a stadium.",
  "sfx_applause": "A huge stadium crowd cheering and applauding enthusiastically with whistles.",
  "sfx_magic_reveal": "A magical sparkling glissando sound effect for a glorious grand reveal, golden tone.",
  "sfx_comedy_fail": "A funny cartoon boing or slide whistle fail sound for a loser.",
  "sfx_tada": "A victorious orchestral ta-da brass hit for winning first place."
};

async function generateAudio(filename, text) {
  const filePath = path.join(OUTPUT_DIR, `${filename}.mp3`);
  if (fs.existsSync(filePath)) {
    console.log(`[SKIPPED] ${filename}.mp3 ya existe.`);
    return;
  }
  
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
    console.error(`[ERROR] Falló ${filename}:`, error.response ? error.response.statusText : error.message);
  }
}

async function generateSFX(filename, text) {
  const filePath = path.join(OUTPUT_DIR, `${filename}.mp3`);
  if (fs.existsSync(filePath)) {
    console.log(`[SKIPPED] ${filename}.mp3 ya existe.`);
    return;
  }
  
  try {
    console.log(`Generando SFX: ${filename}`);
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/sound-generation`,
      {
        text: text,
        duration_seconds: filename === "sfx_drumroll" ? 5 : filename === "sfx_applause" ? 6 : 3,
        prompt_influence: 0.3
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
    console.error(`[ERROR] Falló ${filename}:`, error.response ? (error.response.data.detail ? JSON.stringify(error.response.data) : error.response.statusText) : error.message);
  }
}

async function run() {
  const voiceKeys = Object.keys(NEW_PHRASES);
  for (let key of voiceKeys) {
    await generateAudio(key, NEW_PHRASES[key]);
    await new Promise(r => setTimeout(r, 1000));
  }
  
  const sfxKeys = Object.keys(SFX_PROMPTS);
  for (let key of sfxKeys) {
    await generateSFX(key, SFX_PROMPTS[key]);
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log('¡Todos los audios y SFX generados exitosamente!');
}

run();
