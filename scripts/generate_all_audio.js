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

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 170 game barks and phrases mapping
const PHRASES = {
  // ── Genre barks (reggaeton, banda, ranchera, rock, pop, cumbia, balada, electronica, default)
  "genre_reggaeton_0": "¡Perreo intelectual, la neta!",
  "genre_reggaeton_1": "¡El Benito estaría orgulloso... o llorando!",
  "genre_reggaeton_2": "¡Más sabor que un trompo al pastor!",
  "genre_reggaeton_3": "¡Eso no era nota, era accidente de tráfico musical!",
  "genre_reggaeton_4": "¡Tiembla Bellakath, que ya te salió competencia de la buena!",
  "genre_reggaeton_5": "¡Traes el flow pesado, pero el micrófono te quedó un poco ligero!",
  "genre_reggaeton_6": "¡Eso sí es chacaleo del bueno, mi estimado ajolote!",
  "genre_reggaeton_7": "¡Flow de tianguis de domingo: barato pero con mucho estilo!",
  "genre_reggaeton_8": "¡Eso fue puro dembow de la vieja escuela... o de la prepa!",
  "genre_reggaeton_9": "¡Nos pusiste a perrear hasta el subsuelo, carnal!",

  "genre_banda_0": "¡El Recodo te manda sus condolencias!",
  "genre_banda_1": "¡Eso sonó más raro que tuba en discoteca!",
  "genre_banda_2": "¡El palenque está llorando... de risa!",
  "genre_banda_3": "¡Eso fue banda, pero más bien banda ancha de desafine!",
  "genre_banda_4": "¡Siento que me caigo de la troca con semejantes notas!",
  "genre_banda_5": "¡Sírvanme otro mezcal para aguantar la segunda estrofa!",
  "genre_banda_6": "¡Ese grito dolió más que la cruda del lunes!",
  "genre_banda_7": "¡Hasta a Chuy Lizárraga se le salieron las lágrimas de oírte!",
  "genre_banda_8": "¡Traes todo el sentimiento del rancho, lástima el afinador!",
  "genre_banda_9": "¡Eso sonó a banda sinaloense, pero después de un terremoto!",

  "genre_ranchera_0": "¡Don Vicente te escuchó y pidió otro tequila!",
  "genre_ranchera_1": "¡Eso estuvo tan emocionante que se me fue el hipo!",
  "genre_ranchera_2": "¡El charro más valiente no aguantó esa nota!",
  "genre_ranchera_3": "¡Gritaste el gallo antes de que saliera el sol!",
  "genre_ranchera_4": "¡Se me hace que ese mariachi era de mentiras, carnal!",
  "genre_ranchera_5": "¡Cantas con el sentimiento de quien debe la tanda!",
  "genre_ranchera_6": "¡Esa nota estuvo más desafinada que guitarra de Garibaldi!",
  "genre_ranchera_7": "¡Con ese grito espantaste a los caballos del patrón!",
  "genre_ranchera_8": "¡Le pusiste garra, pero nos quedamos sin gallinero de tanto gallo!",
  "genre_ranchera_9": "¡Para cantar así se necesita tequila, mezcal y mucha anestesia!",

  "genre_rock_0": "¡Maná te hubiera dado el micrófono... para callarte!",
  "genre_rock_1": "¡Eso no fue rock, fue terremoto con guitarra!",
  "genre_rock_2": "¡Hasta las bocinas pidieron piedad!",
  "genre_rock_3": "¡Kurt Cobain se revolvió en su tumba, pero de alegría!",
  "genre_rock_4": "¡Mucho ruido y pocas nueces, como concierto de rock urbano!",
  "genre_rock_5": "¡Traes toda la actitud de rockstar, lástima por las cuerdas vocales!",
  "genre_rock_6": "¡Eso fue metal pesado, sobre todo por lo pesado de escuchar!",
  "genre_rock_7": "¡Alex Lora te daría un abrazo por el puro valor!",
  "genre_rock_8": "¡Sonó como solo de guitarra eléctrica sin afinar desde el 85!",
  "genre_rock_9": "¡Ese headbanging estuvo chido, el canto... dejémoslo en intento!",

  "genre_pop_0": "¡Taylor Swift acaba de bloquear tu número!",
  "genre_pop_1": "¡Eso estuvo tan pop como refresco caliente!",
  "genre_pop_2": "¡Los BTS están viendo el partido de fut!",
  "genre_pop_3": "¡Spotify te quitó 3 reproducciones por eso!",
  "genre_pop_4": "¡Sonó tan fresa que me empalagó el oído!",
  "genre_pop_5": "¡Luismi ya canceló su próximo concierto por tu culpa!",
  "genre_pop_6": "¡Pop de plástico, pero del que se recicla!",
  "genre_pop_7": "¡Ese falsete estuvo más falso que billete de 300 pesos!",
  "genre_pop_8": "¡Parece que cantas pop en inglés pero con pronunciación de secundaria!",
  "genre_pop_9": "¡Un autotune no te caería nada mal para la próxima, de veras!",

  "genre_cumbia_0": "¡Los Ángeles Azules te piden que guardes el micrófono!",
  "genre_cumbia_1": "¡Más sabroso que elote con chile y limón!",
  "genre_cumbia_2": "¡Eso movió el esqueleto y también el estómago!",
  "genre_cumbia_3": "¡La Sonora Dinamita explotó de vergüenza ajena!",
  "genre_cumbia_4": "¡Traes el ritmo en los pies, pero la afinación en otra galaxia!",
  "genre_cumbia_5": "¡Sabor a barrio, sabor a sonidero tapando la calle!",
  "genre_cumbia_6": "¡Eso fue cumbia lagunera, bien rasposa!",
  "genre_cumbia_7": "¡Hasta el microbús se detuvo a bailar con ese ritmo!",
  "genre_cumbia_8": "¡Cumbia de la buena, ideal para barrer el piso con el compadre!",
  "genre_cumbia_9": "¡Traes el güiro bien dominado, al menos eso se escuchó bien!",

  "genre_balada_0": "¡Luis Miguel lloró... pero no de emoción!",
  "genre_balada_1": "¡Eso fue más dramático que telenovela de Televisa!",
  "genre_balada_2": "¡El amor duele, pero esa nota duele más!",
  "genre_balada_3": "¡Alejandro Sanz se fue de tour por no escuchar eso!",
  "genre_balada_4": "¡Perfecto para cortarse las venas con galletas de animalitos!",
  "genre_balada_5": "¡Ese drama no lo tiene ni la Rosa de Guadalupe!",
  "genre_balada_6": "¡Le pusiste sentimiento, pero te faltó tantita escala musical!",
  "genre_balada_7": "¡Esa nota alta fue un grito de auxilio, confiesa!",
  "genre_balada_8": "¡Sonó triste, sobre todo para los que tenemos oídos!",
  "genre_balada_9": "¡La dedicatoria estuvo chida, el canto amerita divorcio exprés!",

  "genre_electronica_0": "¡Daft Punk se quitó el casco de vergüenza!",
  "genre_electronica_1": "¡Eso sonó como Windows 98 crasheando!",
  "genre_electronica_2": "¡El drop estuvo más plano que mi cartera!",
  "genre_electronica_3": "¡Avicii estaría orgulloso... o confundido!",
  "genre_electronica_4": "¡Sonó como licuadora con piedras en la cocina!",
  "genre_electronica_5": "¡Traes el beat de guaracha, pero te faltó el ritmo!",
  "genre_electronica_6": "¡Eso no fue rave, fue cortocircuito en el transformador!",
  "genre_electronica_7": "¡Hasta el DJ se puso audífonos para taparse las orejas!",
  "genre_electronica_8": "¡Mucha luces, mucho humo, pero poca melodía, mi buen!",
  "genre_electronica_9": "¡El sintetizador intentó salvarte, pero ni él pudo tanto!",

  "genre_default_0": "¡Eso fue... algo! ¡No sé si cantar o rezar!",
  "genre_default_1": "¡Los vecinos ya llamaron al 911!",
  "genre_default_2": "¡Hasta el perro de la cuadra aúlla diferente!",
  "genre_default_3": "¡Eso tuvo más quiebres que la economía nacional!",
  "genre_default_4": "¡La afinación está en vacaciones!",
  "genre_default_5": "¡Corazón valiente, oídos sufridos!",
  "genre_default_6": "¡Eso estuvo más raro que tamal de pizza!",
  "genre_default_7": "¡Le faltó sal a ese taco de canción!",
  "genre_default_8": "¡Traes el espíritu afinado, el resto... va en camino!",
  "genre_default_9": "¡Eso fue cantar a capela... pero sin afinación alguna!",

  // ── Singer intros
  "intro_0": "¡Al micrófono! ¡Que el palenque tiemble!",
  "intro_1": "¡Tiene el turno! ¡O canta o paga las chelas!",
  "intro_2": "¡Silencio, que va a demostrar de qué está hecho!",
  "intro_3": "¡El destino habló y tú tienes que obedecer!",
  "intro_4": "¡Abran paso, que viene la verdadera estrella de la noche!",
  "intro_5": "¡A tomar el escenario! Prepárense para lo que venga.",
  "intro_6": "¡Es el momento de la verdad! ¡Sin miedo al éxito, carnal!",
  "intro_7": "¡Agárrense, que viene con todo el flow sonidero!",
  "intro_8": "¡Que pase al frente! ¡Que empiece la magia o el sufrimiento!",
  "intro_9": "¡La ruleta ha hablado y condena a nuestro cantante a deleitarnos!",

  // ── Score reactions
  "vote_100_0": "¡GRAMMY! ¡GRAMMY! ¡Le lloran los micrófonos!",
  "vote_100_1": "¡ESO SÍ ES MÚSICA, no lo que ponen en el radio!",
  "vote_100_2": "¡Se ganó el tequila y la admiración de Tío Axolo!",
  "vote_100_3": "¡Se la rifó como los grandes del escenario!",
  "vote_100_4": "¡Qué bárbaro, cantas mejor que el promedio nacional!",
  "vote_100_5": "¡Traes un vozarrón que hasta a mí me dio escalofríos!",
  "vote_100_6": "¡Eso no fue cantar, fue dar cátedra musical!",

  "vote_60_0": "¡Ni fu ni fa, pero al menos no sangran los oídos!",
  "vote_60_1": "¡Pasable, como el café de la oficina!",
  "vote_60_2": "¡Sobrevivió, que no es poco mérito!",
  "vote_60_3": "¡No estuvo mal, pero tampoco me hagas comprar el disco!",
  "vote_60_4": "¡Cumpliste como los buenos, a secas!",
  "vote_60_5": "¡Digamos que salvaste la noche por los pelos!",
  "vote_60_6": "¡Un desempeño decente, te ganaste media chela!",

  "vote_30_0": "¡Le echó ganas, que no es lo mismo que talento!",
  "vote_30_1": "¡Intento valiente, resultado... cuestionable!",
  "vote_30_2": "¡El esfuerzo se nota, la afinación no tanto!",
  "vote_30_3": "¡Estuviste a dos notas de invocar la lluvia!",
  "vote_30_4": "¡La intención es lo que cuenta, dicen por ahí!",
  "vote_30_5": "¡Uff, faltó aire y sobró confianza!",
  "vote_30_6": "¡Sonó como motor de vocho en subida, compa!",

  "vote_10_0": "¡GALLO SUPREMO DETECTADO! ¡Los gallos de Sonora cantaron mejor!",
  "vote_10_1": "¡Eso no fue cantar, fue torturar las notas musicales!",
  "vote_10_2": "¡Los vecinos ya pusieron denuncia por escándalo!",
  "vote_10_3": "¡Hijo de su... qué fue eso! ¡Mis oídos de ajolote!",
  "vote_10_4": "¡Eso sonó como gato pisado en reversa!",
  "vote_10_5": "¡Una afinación tan ausente como mi ex!",
  "vote_10_6": "¡Te sugiero pedir perdón al micrófono de inmediato!",

  // ── Awards
  "award_rey_0": "¡La banda reconoció al verdadero ídolo de la noche!",
  "award_rey_1": "¡Nadie le llega ni a los talones!",
  "award_rey_2": "¡El micrófono ya tiene nuevo dueño permanente!",
  "award_rey_3": "¡El palenque entero se rinde a tus pies, compa!",

  "award_gallo_0": "¡Los perros del barrio aullaron de solidaridad!",
  "award_gallo_1": "¡Urgen tres meses de solfeo, urgente!",
  "award_gallo_2": "¡El honor de la familia exige práctica diaria!",
  "award_gallo_3": "¡Un gallo con mucha actitud, pero muy desafinado!",

  "award_tomate_0": "¡La banda habló con los proyectiles!",
  "award_tomate_1": "¡Concentró todo el amor en forma de tomate!",
  "award_tomate_2": "¡Tan bueno que mereció atención especial de todos!",
  "award_tomate_3": "¡Te bañaron en salsa roja, y no de la que pica!",

  "award_vengador_0": "¡Robó más puntos que el gobierno!",
  "award_vengador_1": "¡La táctica del ataque silencioso funcionó perfecto!",
  "award_vengador_2": "¡Estratega karaoke de alto nivel!",
  "award_vengador_3": "¡Saboteador profesional con cara de inocente!",

  // ── Single Event Lines
  "room_ready": "¡La sala está lista! Escanéen el código y únanse al juego!",
  "roulette_intro_0": "¡La ruleta decide tu condena! ¡Que el destino sea justo... o no!",
  "roulette_intro_1": "¡Gira, gira, ruedita del dolor! ¡Alguien va a sufrir esta noche!",
  "roulette_intro_2": "¡El universo karaoke ha hablado! ¡Prepárense!",
  "roulette_intro_3": "¡Nadie se escapa! ¡La ruleta del Tío Axolo todo lo ve!",
  "roulette_spin": "¡El destino decide quién sufre primero!",
  "roulette_win": "¡Te toca cantar! ¡La suerte eligió! ¡Que el palenque decida tu destino!",
  "challenge_intro": "¡Reto de actuación activado! ¡A cantar con estilo!",
  "blackout_intro": "¡Apagón mental! ¡Se acabó la letra! ¡Canta de memoria o muere en el intento!",
  "blackout_end": "¡De vuelta! ¿Sobreviviste?",
  "podium_climax": "¡Y así termina la noche más épica del año! ¡El Rey del Palenque ha sido coronado! ¡Gracias banda por esta noche de gloria, carrilla y algún que otro tomate! ¡Hasta la próxima fiesta!",
  "new_game": "¡Nueva partida! Esperando jugadores...",
  "lobby_welcome": "¡Bienvenidos a Rítmika! Escaneen el código para empezar la fiesta",
  "lobby_join_0": "¡El nuevo jugador llegó a echar el grito!",
  "lobby_join_1": "¡Órale, otro valiente se apuntó a sufrir!",
  "lobby_join_2": "¡Bienvenido al ruedo! ¡Espero que afines!",
  "lobby_join_3": "¡Uno más al escenario! ¡El micrófono ya tiembla!",
  "catalog_ready": "¡El catálogo de canciones está listo!",
  "round_1_start": "¡Ronda 1 iniciando! Prepárense para cantar.",
  "round_2_start": "¡Ronda 2 iniciando! Fuego cruzado activado.",
  "round_3_start": "¡Ronda 3 iniciando! Se viene el apagón mental.",
  "audio_sabotage": "¡Auxilio! ¡Mis oídos! ¡Suena peor que un gallo en el mercado!",
  "final_victory": "¡Felicidades al ganador, te la rifaste de veras!",
  "sabotage_reaction": "¡Qué horror! ¡Mis oídos! ¡Apaguen eso por favor!",

  "idle_0": "¡Afinen esa voz, banda!",
  "idle_1": "¿Listos para la carrilla?",
  "idle_2": "¡El que no canta, toma!",
  "idle_3": "¡El Palenque los espera!",

  // ── NEW EXPANDED PHRASES

  // Welcomes
  "lobby_welcome_0": "¡Bienvenidos a Rítmika! Escaneen el código para empezar la fiesta",
  "lobby_welcome_1": "¡Qué onda banda! Bienvenidos a Rítmika. Acerquen sus celulares y conéctense al party.",
  "lobby_welcome_2": "¡Ya se la saben! Bienvenidos a Rítmika. Saquen los chescos y escaneen el código para jugar.",
  "lobby_welcome_3": "¡Buenas, buenas! Tío Axolo les da la bienvenida a Rítmika. Conéctense que esto se va a descontrolar.",
  "lobby_welcome_4": "¡Arrancamos Rítmika! Prepárense para cantar, reír y lanzar tomates. Escaneen el QR ya mismo.",

  // Room Ready
  "room_ready_0": "¡La sala está lista! Escanéen el código y únanse al juego!",
  "room_ready_1": "¡Sala abierta y lista! Ya pueden unirse. ¿Quién se atreve a ser el primero?",
  "room_ready_2": "¡Tenemos código y tenemos ganas! Únanse al lobby con el código en pantalla.",
  "room_ready_3": "¡Lobby listo! Conecten sus controles móviles para iniciar la diversión.",

  // Lobby Join additions
  "lobby_join_4": "¡Eso es todo! Entrando con todo el estilo del palenque.",
  "lobby_join_5": "¡Cuidado que ahí viene la verdadera competencia!",
  "lobby_join_6": "¡Ya llegó por quien lloraban! Prepárense para el show.",
  "lobby_join_7": "¡Le dio clic al peligro! Bienvenido a la fiesta, compa.",
  "lobby_join_8": "¡Qué valor el tuyo de venir a cantar frente a todos!",
  "lobby_join_9": "¡Pásale, pásale! Que hay lugar para un desafinado más.",

  // Idle additions
  "idle_4": "¿Qué esperan para darle al botón de jugar? ¡Me estoy secando!",
  "idle_5": "Saquen las botanas en lo que se deciden a empezar.",
  "idle_6": "Tengo el micrófono listo y el autotune apagado, apúrense.",
  "idle_7": "¡El público se impacienta y yo también! ¡Vamos a darle!",

  // Sabotage Reactions
  "sabotage_reaction_0": "¡Auxilio! ¡Mis oídos! ¡Suena peor que un gallo en el mercado!",
  "sabotage_reaction_1": "¡Qué horror! ¡Mis oídos! ¡Apaguen eso por favor!",
  "sabotage_reaction_2": "¡Uy no! ¡Esa distorsión dolió más que patada de mula!",
  "sabotage_reaction_3": "¡Traigan tapones para los oídos! ¡Alguien está saboteando la frecuencia!",
  "sabotage_reaction_4": "¡Suena horrible! ¡Eso no es música, es una tortura cibernética!",

  // Round Starts additions
  "round_1_start_0": "¡Ronda 1 iniciando! Prepárense para cantar.",
  "round_1_start_1": "¡Arranca la Ronda 1! Escojan sus mejores rolas y demuestren talento.",
  "round_2_start_0": "¡Fuego cruzado activado! Asignen canciones a sus rivales",
  "round_2_start_1": "¡Ronda 2: Fuego Cruzado! Es hora de vengarse y darles la peor canción posible.",
  "round_3_start_0": "¡Ronda 3 iniciando! Se viene el apagón mental.",
  "round_3_start_1": "¡Ronda 3! El Apagón Mental. Canten sin letra o queden en el olvido.",

  // Roulette Spin additions
  "roulette_spin_0": "¡El destino decide quién sufre primero!",
  "roulette_spin_1": "¡Girando la ruleta! A ver a quién le cae la voladora...",
  "roulette_spin_2": "¡Suerte para todos! La rueda está buscando su próxima víctima.",

  // Roulette Win additions
  "roulette_win_0": "¡Te toca cantar! ¡La suerte eligió! ¡Que el palenque decida tu destino!",
  "roulette_win_1": "¡El elegido del destino! Pasa al frente y que dios te acompañe.",
  "roulette_win_2": "¡El boleto ganador es tuyo! Conquista el escenario o muere en el intento.",

  // Challenge Intro additions
  "challenge_intro_0": "¡Reto de actuación activado! ¡A cantar con estilo!",
  "challenge_intro_1": "¡Hora del reto! Cántenle con ganas y pónganle drama.",
  "challenge_intro_2": "¡Reto especial! Demuestren que además de afinación, traen actitud escénica.",

  // Blackout Intro additions
  "blackout_intro_0": "¡Apagón mental! ¡Se acabó la letra! ¡Canta de memoria o muere en el intento!",
  "blackout_intro_1": "¡Luces fuera! Apagón mental activado. ¿Te sabes la rola de memoria?",
  "blackout_intro_2": "¡La pantalla se va a negro! Demuestra si eres un verdadero fan o pura pose.",

  // Blackout End additions
  "blackout_end_0": "¡De vuelta! ¿Sobreviviste?",
  "blackout_end_1": "¡Regresó la señal! ¿Te dio un ataque de pánico o todo chido?",
  "blackout_end_2": "¡Fin del apagón! A ver si lograste salvar la rola.",

  // Final Victory additions
  "final_victory_0": "¡Felicidades al ganador, te la rifaste de veras!",
  "final_victory_1": "¡Tenemos campeón absoluto! Eres el mero mero del palenque.",
  "final_victory_2": "¡Te coronaste! La banda te aclama y el Tío Axolo te aplaude.",

  // Podium Climax additions
  "podium_climax_0": "¡Y así termina la noche más épica del año! ¡El Rey del Palenque ha sido coronado! ¡Gracias banda por esta noche de gloria, carrilla y algún que otro tomate! ¡Hasta la próxima fiesta!",
  "podium_climax_1": "¡Qué noche, señores! El palenque se cierra pero las risas se quedan. ¡Felicidades a los ganadores y gracias a todos por aguantar la carrilla!",
  "podium_climax_2": "¡La fiesta llegó a su fin! Coronamos al rey, abucheamos al gallo y nos divertimos como locos. ¡Nos vemos en la próxima ronda de Rítmika! ¡Adiós!",

  // Catalog Ready additions
  "catalog_ready_0": "¡El catálogo de canciones está listo!",
  "catalog_ready_1": "¡Todas las rolas cargadas y listas para sonar!",
  "catalog_ready_2": "¡Ya pueden buscar sus temas preferidos! Catálogo listo.",

  // New Game additions
  "new_game_0": "¡Nueva partida! Esperando jugadores...",
  "new_game_1": "¡Mesa limpia! Nueva partida iniciada. Vayan entrando todos.",
  "new_game_2": "¡Reiniciamos la diversión! Esperando que se unan los cantantes.",

  // ── CEREMONY PODIUM EXTENDED (immersive TV show style) ──
  "podium_intro_ceremony": "¡Bienvenidos, banda, a la Gran Premiación de Rítmika! Llegó el momento de la verdad. Vamos a coronar al Rey del Palenque, pero también vamos a dar carrilla, porque aquí ni todo es miel sobre hojuelas. Premios especiales, podio de ganadores, y muchas sorpresas más. ¡Que empiece la ceremonia!",
  "podium_award_gallo": "El primero de los premios especiales... Gallo Supremo. Para el más valiente, el que se atrevió a cantar pareciendo gato en licuadora. El que hizo que los perros del barrio aullaran en solidaridad. Banda, el Gallo Supremo de la noche es...",
  "podium_award_tomate": "Y ahora el premio Salsa de Tomate. Para el que recibió más tomatazos que la selección mexicana en el Azteca. La banda habló con proyectiles, pero todo es cariño. El rey de los tomatazos de la noche es...",
  "podium_award_vengador": "El premio al Vengador Anónimo. Saboteador profesional con cara de inocente. Robó más puntos que el SAT en temporada de declaraciones. Un estratega del karaoke. El Vengador Anónimo es...",
  "podium_reveal_third": "Antes del gran campeón, hay que reconocer a los que llegaron al podio. En tercer lugar, con una actuación que ni fu ni fa... el tercer lugar es para...",
  "podium_reveal_second": "Y en segundo lugar, alguien que se la rifó y casi arrebata la corona. El segundo lugar es para...",
  "podium_winner_buildup": "Y llegó el momento que todos esperaban. Después de tres rondas, canciones, tomatazos, y mucha carrilla... ha llegado la hora de coronar al Rey del Palenque. El ganador de Rítmika es...",
  "podium_winner_reveal": "¡El nuevo Rey del Palenque! El que demostró que tiene flow y que no le tiembla la voz. Que suene la tambora, que la banda toque, que el pueblo se arrodille ante su nuevo ídolo. ¡Felicidades, campeón, de parte del Tío Axolo y de toda la banda!"
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateAudio(filename, text) {
  const filepath = path.join(OUTPUT_DIR, `${filename}.mp3`);
  
  if (fs.existsSync(filepath)) {
    console.log(`[SKIPPED] ${filename}.mp3 already exists.`);
    return 'skipped';
  }
  
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;
  
  try {
    const response = await axios({
      method: 'post',
      url: url,
      headers: {
        'accept': 'audio/mpeg',
        'xi-api-key': API_KEY,
        'Content-Type': 'application/json'
      },
      data: {
        text: text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      },
      responseType: 'stream'
    });
    
    const writer = fs.createWriteStream(filepath);
    response.data.pipe(writer);
    
    return new Promise((resolve) => {
      writer.on('finish', () => {
        console.log(`[SUCCESS] Generated ${filename}.mp3`);
        resolve('generated');
      });
      writer.on('error', err => {
        console.error(`[WRITE ERROR] ${filename}.mp3:`, err.message);
        resolve('failed');
      });
    });
  } catch (err) {
    if (err.response) {
      console.error(`[API ERROR] ${filename}.mp3 (HTTP status ${err.response.status})`);
      try {
        let errorData = '';
        err.response.data.on('data', chunk => { errorData += chunk; });
        err.response.data.on('end', () => {
          console.error(`[API DETAILS]:`, errorData);
        });
      } catch (e) {}
    } else {
      console.error(`[REQUEST ERROR] ${filename}.mp3:`, err.message);
    }
    return 'failed';
  }
}

async function main() {
  const keys = Object.keys(PHRASES);
  let generatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const failedList = [];
  
  console.log(`==================================================`);
  console.log(`ElevenLabs mass pre-renderer starting...`);
  console.log(`Target voice ID: ${VOICE_ID}`);
  console.log(`Output folder: ${OUTPUT_DIR}`);
  console.log(`Total barks to generate: ${keys.length}`);
  console.log(`==================================================\n`);
  
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const text = PHRASES[key];
    
    const result = await generateAudio(key, text);
    if (result === 'generated') {
      generatedCount++;
    } else if (result === 'skipped') {
      skippedCount++;
    } else {
      failedCount++;
      failedList.push({ key, text });
    }
    
    // Concurrency delay to prevent HTTP rate throttling (500ms)
    await sleep(500);
  }
  
  console.log(`\n==================================================`);
  console.log(`PRE-RENDERING COMPLETE`);
  console.log(`Total phrases: ${keys.length}`);
  console.log(`WAV/MP3 files newly generated: ${generatedCount}`);
  console.log(`WAV/MP3 files skipped (already exist): ${skippedCount}`);
  console.log(`WAV/MP3 files failed: ${failedCount}`);
  
  if (failedList.length > 0) {
    console.log(`\nFAILED PHRASES:`);
    failedList.forEach(item => {
      console.log(`- ${item.key}: "${item.text}"`);
    });
  }
  console.log(`==================================================`);
}

main();
