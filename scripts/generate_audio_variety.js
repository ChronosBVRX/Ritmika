const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'ljWLDJb7OMkYo3VM9z8g';
const OUTPUT_DIR = path.resolve(__dirname, '..', 'public', 'assets', 'audio');
const FORCE = process.argv.includes('--force');
const ONLY = (() => {
  const i = process.argv.indexOf('--only');
  return i >= 0 ? process.argv[i + 1] : null;
})();

if (!API_KEY) {
  console.error('ERROR: ELEVENLABS_API_KEY no está definida en .env');
  process.exit(1);
}

const LINES = {
  // ═══ PREMIACIÓN · 5 variantes por fase ═══
  'podium_intro_ceremony_0': '¡Bienvenidos a la Gran Premiación de Rítmika, banda! Saquen las micheladas, que hoy se corona al Rey del Palenque y se abuchea al Gallo Supremo. ¡Que empiece la carrilla!',
  'podium_intro_ceremony_1': '¡Llegó el momento de la verdad, compas! Aquí se reparten trofeos, aplausos y unas buenas dosis de vergüenza ajena. ¡Arranca la premiación!',
  'podium_intro_ceremony_2': '¡Se acabó el karaoke, pero no la carrilla! Bienvenidos a la premiación, donde el talento se premia y el desafine también. ¡Vamos con todo!',
  'podium_intro_ceremony_3': '¡Banda, llegó la hora de coronar al Rey del Palenque! Y no se preocupen, al Gallo Supremo también le tenemos su trofeo y su salsa. ¡Comienza la fiesta!',
  'podium_intro_ceremony_4': '¡Atención, palenque! La noche se cierra con premios, chistes y algún que otro tomate volador. ¡Que viva la premiación, carnales!',

  'podium_award_gallo_0': '¡Primer premio, banda! Gallo Supremo para el que cantó como gato en licuadora, pero con el corazón en la mano. ¡Que viva el valor!',
  'podium_award_gallo_1': '¡Y el Gallo Supremo se lo lleva el que desafinó más fuerte que la bocina del tianguis! Aplausos, que también se sufre.',
  'podium_award_gallo_2': '¡Gallo Supremo! Para el compa que se aventó al escenario sin miedo y sin afinación. ¡Eso también es arte, carnal!',
  'podium_award_gallo_3': '¡El premio Gallo Supremo es para el que hizo llorar a los perros del barrio! Tranquilo, aquí te queremos igual.',
  'podium_award_gallo_4': '¡Gallo Supremo, señores! El trofeo al valor desafinado. Porque cantar mal frente a la banda tiene su mérito y su carrilla.',

  'podium_award_tomate_0': '¡Salsa de Tomate! Para el que recibió más tomates que la selección en el Azteca. Pero ojo, aquí el tomate es cariño... creo.',
  'podium_award_tomate_1': '¡Y el premio Salsa de Tomate es para el más atacado de la noche! Con tanto jitomate ya puedes abrir tu puesto en el tianguis, carnal.',
  'podium_award_tomate_2': '¡Salsa de Tomate! El público te mandó tomates hasta por debajo de la puerta. No te preocupes, de aquí salió una salsa bien picante.',
  'podium_award_tomate_3': '¡Salsa de Tomate para el superviviente del tomatazo! La banda te quiso tanto que te hizo ensalada. ¡Felicidades, compa!',
  'podium_award_tomate_4': '¡Salsa de Tomate! Porque recibir tomates también es protagonismo. Ya tienes material para tu propio puesto de salsas, mi rey.',

  'podium_award_vengador_0': '¡Vengador Anónimo! Para el que sabotajeó más calladito que ex en WhatsApp. Todos te odiamos un poquito, pero te respetamos.',
  'podium_award_vengador_1': '¡Vengador Anónimo! El que apagó el audio más veces que la luz en el barrio. Estratega, carnal, estratega.',
  'podium_award_vengador_2': '¡Vengador Anónimo! Saboteador profesional con cara de no romper un plato. La banda ya te tiene en la mira.',
  'podium_award_vengador_3': '¡Vengador Anónimo! Robó más atención que el compa que llega tarde a la fiesta. Pero qué bien lo hizo, ¿eh?',
  'podium_award_vengador_4': '¡Vengador Anónimo! El premio al que saboteó con estilo. Nadie sabe quién fuiste... bueno, todos lo sabemos, compadre.',

  'podium_reveal_third_0': '¡Antes del gran campeón, hay que reconocer al tercer lugar! Con una actuación que ni fu ni fa... ¡Tercer lugar!',
  'podium_reveal_third_1': '¡En tercer lugar, el que sobrevivió al karaoke con más pena que gloria! ¡Aplausos para el bronce!',
  'podium_reveal_third_2': '¡Tercer lugar! No fue el mejor, pero tampoco el peor. Un logro muy mexicano, la neta.',
  'podium_reveal_third_3': '¡Y el tercer lugar se lo lleva el que aguantó tres rondas sin que se le acabara la vergüenza! ¡Felicidades!',
  'podium_reveal_third_4': '¡Tercer lugar! El bronce sabe a victoria... o a que faltó ensayo, pero igual se celebra.',

  'podium_reveal_second_0': '¡Y en segundo lugar, alguien que se la rifó y casi arrebata la corona! ¡Segundo lugar, señores!',
  'podium_reveal_second_1': '¡Segundo lugar! Te quedaste a un tomatazo de la gloria, carnal. ¡Bien jugado!',
  'podium_reveal_second_2': '¡En segundo lugar, la banda te quiere, pero el rey ya tiene dueño... por poquito!',
  'podium_reveal_second_3': '¡Segundo lugar! Casi, casi. Como cuando dices que llegas en cinco minutos y llegas en una hora.',
  'podium_reveal_second_4': '¡Segundo lugar! Te faltó un estribillo para coronarte. Pero esta noche te llevas aplausos y carrilla.',

  'podium_winner_buildup_0': '¡Llegó el momento que todos esperaban! Después de tres rondas, canciones, tomatazos y mucha carrilla... ha llegado la hora de coronar al Rey del Palenque. El ganador de Rítmika es...',
  'podium_winner_buildup_1': '¡Banda, llegó la hora de la verdad! Saquen las palomitas, apaguen el WhatsApp y pónganse cómodos, porque vamos a coronar al Rey del Palenque. El ganador es...',
  'podium_winner_buildup_2': '¡Ya se armó el momento épico! Tres rondas, mil desafines y un montón de tomates después... el nuevo Rey del Palenque es...',
  'podium_winner_buildup_3': '¡No se vayan, que esto se pone bueno! La banda ya votó, los tomates ya volaron y el trono está caliente. El Rey del Palenque es...',
  'podium_winner_buildup_4': '¡Atención, palenque! El momento más esperado de la noche: coronar al Rey del Palenque. Y el ganador de Rítmika es...',

  'podium_winner_reveal_0': '¡El nuevo Rey del Palenque! El que demostró que tiene flow y que no le tiembla la voz. ¡Felicidades, campeón, de parte del Tío Axolo y de toda la banda!',
  'podium_winner_reveal_1': '¡Tenemos nuevo Rey del Palenque! La noche queda oficialmente coronada. ¡Que viva el palenque!',
  'podium_winner_reveal_2': '¡El Rey del Palenque ha sido coronado! La banda te aclama, los tomates te respetan y el micrófono ya tiene dueño. ¡Felicidades!',
  'podium_winner_reveal_3': '¡Se acabó la duda! El Rey del Palenque es el que se llevó la noche con flow, carisma y algún que otro berrinche. ¡Que viva el campeón!',
  'podium_winner_reveal_4': '¡El nuevo Rey del Palenque! Porque cantar bien es opcional, pero tener flow... eso no se negocia. ¡Felicidades, mi rey!',

  // ═══ RETO / CATÁLOGO / PREMIO REY ═══
  'challenge_intro_3': '¡Reto activado! Ahora demuestren que además de cantar, tienen resistencia emocional.',
  'challenge_intro_4': '¡Hora del reto! La banda quiere ver de qué están hechos... y si sobreviven al ridículo.',
  'award_rey_4': '¡El Rey del Palenque no se discute: se respeta! ¡Ahí está el campeón!',
  'catalog_ready_3': '¡Catálogo listo, banda! Ya pueden buscar hasta la canción que les rompió el corazón.',
  'catalog_ready_4': '¡Todas las rolas cargadas! Elijan con cuidado, que aquí no hay marcha atrás.',

  // ═══ EMO · prompts y reacciones que faltaban ═══
  'emo/emo_vote_1': 'Hora de votar, banda emo. ¿Fue arte, drama o puro berrinche afinado?',
  'emo/emo_vote_2': 'Saquen las palomitas y el delineador: es hora de calificar el sufrimiento.',
  'emo/emo_vote_3': 'Voten con el corazón roto, no con la razón. ¿Qué tal estuvo la actuación?',
  'emo/emo_vote_4': 'Es momento de la verdad. ¿Lloramos con ustedes o lloramos por nosotros?',
  'emo/emo_vote_good_4': 'Eso estuvo tan intenso que hasta mi playlist de los 2000 se puso celosa.',
  'emo/emo_blackout_2': 'Se apagó la pantalla, pero no el drama. Canta de memoria, corazón.',
  'emo/emo_blackout_3': 'Sin letra y sin señal, como tu ex. Demuestra que te sabes la canción.',
  'emo/emo_blackout_4': 'Apagón emocional: la única luz que queda es tu voz desafinada.',
  'emo/emo_idle_4': '¿Van a empezar o sigo aquí, viendo cómo se acumulan los sentimientos?',

  // ═══ EMO · retos, diario y dedicatorias (archivos faltantes) ═══
  'emo/emo_challenge_0': 'Canta mirando al piso.',
  'emo/emo_challenge_1': 'Canta con la mano en el corazón.',
  'emo/emo_challenge_2': 'Canta como si estuvieras en un videoclip bajo la lluvia.',
  'emo/emo_challenge_3': 'Grita el coro como si doliera.',
  'emo/emo_challenge_4': 'Haz cara de traición.',
  'emo/emo_challenge_5': 'Canta como si nadie te entendiera.',
  'emo/emo_challenge_6': 'Dedica esta parte a tu yo de secundaria.',
  'emo/emo_challenge_7': 'Canta sin sonreír.',
  'emo/emo_challenge_8': 'Haz una pausa dramática antes del coro.',
  'emo/emo_challenge_9': 'Canta como si acabaras de cerrar Messenger.',
  'emo/emo_diary_0': 'Nadie entiende mi playlist.',
  'emo/emo_diary_1': 'No estoy triste, estoy en acústico.',
  'emo/emo_diary_2': 'Mi corazón tiene WiFi, pero nadie se conecta.',
  'emo/emo_diary_3': 'Esta canción me cambió en secundaria.',
  'emo/emo_diary_4': 'Mi fleco sabe cosas que yo no.',
  'emo/emo_diary_5': 'No era una etapa, era mi soundtrack.',
  'emo/emo_diary_6': 'Hoy no lloré, solo afiné por dentro.',
  'emo/emo_diary_7': 'Mi alma está en modo avión.',
  'emo/emo_diary_8': 'Canto porque publicar indirectas ya no basta.',
  'emo/emo_diary_9': 'El delineador se corre, pero el drama permanece.',
  'emo/emo_dedication_0': 'Para tu yo de secundaria.',
  'emo/emo_dedication_1': 'Para quien te dejó en visto.',
  'emo/emo_dedication_2': 'Para tu etapa intensa.',
  'emo/emo_dedication_3': 'Para tu foto de perfil en blanco y negro.',
  'emo/emo_dedication_4': 'Para cuando publicabas indirectas.',
  'emo/emo_dedication_5': 'Para tu antiguo estado de Messenger.',
  'emo/emo_dedication_6': 'Para esa persona que nunca entendió tu playlist.',
  'emo/emo_dedication_7': 'Para cuando decías que estabas bien, pero ponías esta canción.',
  'emo/emo_dedication_8': 'Para quien te cambió por alguien con mejor fleco.',
  'emo/emo_dedication_9': 'Para tu corazón con contraseña olvidada.',

  // ═══ EMO · rondas, podio y carrilla de premios ═══
  'emo/emo_round_1_intro_1': 'Ronda uno: Abran su diario, banda. Hoy se canta con el corazón roto y el delineador corrido.',
  'emo/emo_round_1_intro_2': 'Primera ronda: Tu Diario de Depresión. Saquen esa canción que nadie más entiende.',
  'emo/emo_round_1_intro_3': 'Ronda uno: el diario secreto se abre. Elijan la rola que les recuerda a su ex.',
  'emo/emo_round_1_intro_4': 'Arranca la ronda uno: Tu Diario de Depresión. Aquí no se juzga... bueno, sí.',
  'emo/emo_round_2_intro_1': 'Ronda dos: Trauma Compartido. Elijan la canción más cruel para su rival emocional.',
  'emo/emo_round_2_intro_2': 'Segunda ronda: repartan dolor. Asignen una canción que les duela hasta el alma.',
  'emo/emo_round_2_intro_3': 'Ronda dos: Fuego Cruzado Emo. Denle a su compa la canción que más les rompió.',
  'emo/emo_round_2_intro_4': 'Ronda dos: Trauma Compartido. Hoy el amor se demuestra asignando sufrimiento.',
  'emo/emo_round_3_intro_1': 'Ronda tres: Apagón Emocional. Sin letra, sin luz y sin esperanza.',
  'emo/emo_round_3_intro_2': 'Tercera ronda: canten a oscuras, como en su cuarto a las 3 de la mañana.',
  'emo/emo_round_3_intro_3': 'Ronda tres: el apagón emocional. Demuestren que se saben la canción de memoria.',
  'emo/emo_round_3_intro_4': 'Última ronda: Apagón Emocional. La oscuridad juzga, la banda también.',
  'emo/emo_podium_intro_1': 'La noche se apaga, pero el drama sigue. Es hora de la premiación emo.',
  'emo/emo_podium_intro_2': 'Bienvenidos a la entrega de premios más triste del año. Saquen los pañuelos.',
  'emo/emo_podium_intro_3': 'Se acabó el karaoke, pero no el sufrimiento. Vamos a premiar el dolor.',
  'emo/emo_podium_intro_4': 'Última parada: la premiación emo. Aquí hasta los trofeos lloran.',
  'emo/emo_podium_winner_1': 'El ganador es el que más sufrió... o el que mejor lo disimuló. Felicidades.',
  'emo/emo_podium_winner_2': 'Coronamos al rey de la desgracia. Que viva el drama.',
  'emo/emo_podium_winner_3': 'Ganaste. No sé si es un premio o una advertencia. Felicidades.',
  'emo/emo_podium_winner_4': 'El trono emo es tuyo. Nadie más quería cargar con tanto drama.',
  'emo/emo_award_0_1': 'Tu corazón tiene más grietas que la pantalla de mi celular.',
  'emo/emo_award_0_2': 'Lloraste tanto que hasta el micrófono pidió terapia.',
  'emo/emo_award_0_3': 'El premio al corazón más roto: ni el Titanic se hundió tanto.',
  'emo/emo_award_0_4': 'Tu ex te mandó un mensaje... mentira, pero dolió igual.',
  'emo/emo_award_1_1': 'Tus indirectas tienen más veneno que el WhatsApp de la familia.',
  'emo/emo_award_1_2': 'El premio a la indirecta más filosa: hasta el Tío Axolo se dio por aludido.',
  'emo/emo_award_1_3': 'Publicaste un estado y todos supimos de quién hablabas. Arte.',
  'emo/emo_award_1_4': 'Esa indirecta llegó más lejos que el wifi del vecino.',
  'emo/emo_award_2_1': 'Sobreviviste al apagón como sobreviviste a tu ex: con dignidad y desafinando.',
  'emo/emo_award_2_2': 'El premio a cantar a oscuras: ni la luz se atrevió a verte.',
  'emo/emo_award_2_3': 'Sobreviviente del apagón. La oscuridad te queda bien.',
  'emo/emo_award_2_4': 'Cantaste sin letra, sin luz y sin vergüenza. Un ejemplo para la banda.',
  'emo/emo_podium_award_0_1': 'El premio Corazón Más Roto va para el que lloró hasta en el coro. El ganador es...',
  'emo/emo_podium_award_0_2': 'Corazón Más Roto: un trofeo para el que convirtió el karaoke en terapia. El ganador es...',
  'emo/emo_podium_award_0_3': 'Primer premio: el corazón más roto de la noche. Y no, no es un cumplido. El ganador es...',
  'emo/emo_podium_award_0_4': 'Corazón Más Roto. Porque hay heridas que ni el autotune cura. El ganador es...',
  'emo/emo_podium_award_1_1': 'Mejor Indirecta: el premio a decir todo sin decir nada. El ganador es...',
  'emo/emo_podium_award_1_2': 'Siguiente premio: Mejor Indirecta. Sus estados de WhatsApp deberían venir con advertencia. El ganador es...',
  'emo/emo_podium_award_1_3': 'Mejor Indirecta: para el que publica una canción y todos sabemos de quién habla. El ganador es...',
  'emo/emo_podium_award_1_4': 'Mejor Indirecta. El arte de herir con emojis. El ganador es...',
  'emo/emo_podium_award_2_1': 'Sobreviviente del Apagón: para el que cantó sin luz y sin vergüenza. El premio es para...',
  'emo/emo_podium_award_2_2': 'Último premio: Sobreviviente del Apagón. La oscuridad no pudo contigo. El premio es para...',
  'emo/emo_podium_award_2_3': 'Sobreviviente del Apagón. Cantaste a ciegas y aun así nos hiciste llorar. El premio es para...',
  'emo/emo_podium_award_2_4': 'Último premio: el que sobrevivió al apagón emocional. El premio es para...',
  'emo/emo_podium_award_0': 'Primer premio: Corazón Más Roto. Para quien nos hizo sufrir más que su ex. Y el ganador es...',
  'emo/emo_podium_award_1': 'Siguiente premio: Mejor Indirecta. Para esa persona que lanza dagas como si publicara estados de Messenger...',
  'emo/emo_podium_award_2': 'Último premio: Sobreviviente del Apagón. Brillaste más en la oscuridad. El premio es para...',
  'mode_intro_clasico': '¡Modo Clásico! Rondas, ruleta y la carrilla de siempre. ¡A darle!',
  'mode_intro_ranchera': '¡Noche de despecho! Puro dolor, mariachi y tequila. ¡Agárrense!',
  'mode_intro_nostalgia': '¡Modo Nostalgia 2000s! Saca tu discman y tu lado emo, que esto se va a poner intenso.',
  'mode_intro_anime': '¡Otaku Fest! A cantar los mejores openings antes de que caiga el meteorito.',

  // ═══ LOBBY · presentación y explicación del juego ═══
  'lobby_presentation_0': '¡Bienvenidos a Rítmika, el karaoke party game más picante del palenque! Soy el Tío Axolo y hoy vengo a repartir micrófono, retos y carrilla. Escaneen el QR, elijan su avatar y prepárense para cantar.',
  'lobby_presentation_1': '¡Banda, llegaron al lugar donde el talento es opcional y la carrilla es obligatoria! Rítmika es un karaoke estilo Jackbox: su TV es el escenario y sus celulares son los controles. Únanse con el código.',
  'lobby_presentation_2': '¡Qué onda, compas! Soy el Tío Axolo, su anfitrión. En Rítmika van a cantar, votar, lanzar tomates y sabotearse con cariño. Todo desde el celular. ¡Escanéen el QR y empiecen!',
  'lobby_presentation_3': '¡Bienvenidos al palenque digital! Aquí la ruleta decide quién canta, el público califica y los tomates vuelan. Rítmika es fiesta, karaoke y carrilla mexicana. ¡Conéctense!',
  'lobby_presentation_4': '¡Llegó la fiesta, banda! Rítmika es un karaoke party game para 2 a 8 jugadores. La TV pone el show, sus celulares los controles, y el Tío Axolo la voz. ¡Escanéen el código y empiecen!',
  'lobby_howto_0': 'Para entrar, escaneen el QR o tecleen el código en el celular. Elijan su avatar, sus géneros y sus artistas favoritos. Cuando todos estén listos, el host le da a empezar.',
  'lobby_howto_1': 'Es fácil: cada quien elige avatar, géneros y artistas. La ruleta decide quién canta, el público vota del 10 al 100 y los tomatazos vuelan. Al final, el Rey del Palenque se lleva la corona.',
  'lobby_howto_2': 'El juego tiene tres rondas: Tu Elección, Tu Condena; Fuego Cruzado, donde asignan canciones; y Apagón Mental, donde cantan de memoria. El público vota y la carrilla se sirve.',
  'lobby_howto_3': 'En Rítmika nadie se salva: cantan todos, votan todos y se tomatean todos. El cantante puede recibir retos, apagones y saboteos. La banda decide quién gana.',
  'lobby_howto_4': 'El host inicia desde su celular. La TV muestra la ruleta, las canciones y el podio. Ustedes solo necesitan su celular, sus ganas de cantar y cero vergüenza.',
  'lobby_rounds_0': 'Tres rondas, banda: en la primera cada quien canta lo que quiere; en la segunda le asignan canción a un rival; y en la tercera cantan a oscuras. El que sobreviva, gana.',
  'lobby_rounds_1': 'Ronda uno: Tu Elección, Tu Condena, con ruleta y reto. Ronda dos: Fuego Cruzado, donde te vengan con una canción. Ronda tres: Apagón Mental, a cantar de memoria.',
  'lobby_rounds_2': 'La ruleta decide el orden, pero la banda decide el destino. Ronda uno, elección; ronda dos, venganza; ronda tres, apagón. Y al final, podio y carrilla.',
  'lobby_rounds_3': 'Cada ronda tiene su veneno: ruleta y reto en la uno, canciones asignadas en la dos, y apagón en la tres. El público vota y los tomates hacen su trabajo.',
  'lobby_rounds_4': 'No es solo cantar: es sobrevivir a la ruleta, a los retos y a los tomatazos. Tres rondas, un podio y una corona. ¿Quién se anima?',
  'lobby_carrilla_0': 'Aquí no solo se canta: se lanzan tomates, se sabotea el audio y se reparten indirectas. Todo con cariño, ¿eh? El público decide si te salvas o te hunden.',
  'lobby_carrilla_1': 'El tomatazo cuesta puntos, el sabotaje corta el audio y el reto pone a prueba tu dignidad. La banda tiene el poder. Úsalo con responsabilidad... o no.',
  'lobby_carrilla_2': 'Si te toca el Gallo Supremo, no llores: el premio también es carrilla. Y si te toca la Salsa de Tomate, ya tienes puesto en el tianguis.',
  'lobby_carrilla_3': 'En Rítmika el público vota, comenta y se venga. Los tomates vuelan, los retos aprietan y el podio se corona con drama. ¡Así es la fiesta!',
  'lobby_carrilla_4': 'No hay premio para el más educado, pero sí para el más valiente, el más tomateado y el más vengador. La carrilla es parte del show.',
};

async function generateAudio(filename, text) {
  const filePath = path.join(OUTPUT_DIR, `${filename}.mp3`);
  if (!FORCE && fs.existsSync(filePath)) {
    console.log(`[SKIP] ${filename}.mp3`);
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  try {
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.13, use_speaker_boost: true },
      },
      {
        headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
        responseType: 'stream',
      }
    );
    await new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    console.log(`[OK] ${filename}.mp3`);
  } catch (error) {
    const detail = error.response?.data?.detail;
    console.error(`[ERROR] ${filename}:`, error.response?.status || error.message, detail ? JSON.stringify(detail).slice(0, 200) : '');
  }
}

async function run() {
  const keys = Object.keys(LINES).filter(k => !ONLY || k.startsWith(ONLY));
  console.log(`Generando ${keys.length} audios...`);
  for (const key of keys) {
    await generateAudio(key, LINES[key]);
    await new Promise(r => setTimeout(r, 700));
  }
  console.log('Listo.');
}

run();
