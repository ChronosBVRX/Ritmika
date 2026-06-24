import sys

file_path = "public/js/tv/constants.js"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

emo_phrases_new = """
const EMO_MODE_PHRASES = {
  intro: [
    { text: '¡Bienvenidos a Fiesta Emo! Hoy no se canta, se sangra emocionalmente. 🖤', file: 'emo_intro_0.mp3' },
    { text: 'Delineador listo, corazón roto y garganta temblando. Esto es Rítmika Emo. 💔', file: 'emo_intro_1.mp3' },
    { text: 'No es una fase, es una competencia con trauma musical. 🖤🎤', file: 'emo_intro_2.mp3' },
    { text: 'Saquen el delineador y las lágrimas falsas. Empezamos la masacre emocional.', file: 'emo_intro_3.mp3' },
    { text: 'Aquí venimos a sufrir por elección. ¡Que empiece la depresión colectiva!', file: 'emo_intro_4.mp3' }
  ],
  roulette: [
    { text: 'La ruleta va a elegir quién abre su diario frente a todos. 📓🖤', file: 'emo_roulette_0.mp3' },
    { text: 'Gira la rueda del dolor adolescente. A ver quién llora primero. 💔', file: 'emo_roulette_1.mp3' },
    { text: 'Girando la ruleta de la desgracia musical...', file: 'emo_roulette_2.mp3' },
    { text: 'A ver a quién le toca exponer sus sentimientos oscuros esta vez.', file: 'emo_roulette_3.mp3' }
  ],
  selected: [
    { text: 'Te tocó. Sube al escenario y decepciona a tu ex con estilo. 🖤', file: 'emo_selected_0.mp3' },
    { text: 'El destino eligió tu sufrimiento. Canta como si fuera 2008. 💀', file: 'emo_selected_1.mp3' },
    { text: 'Vas tú. Rompe el micrófono o rompe a llorar, pero haz algo.', file: 'emo_selected_2.mp3' },
    { text: 'Es tu turno de transmitir todo ese dolor reprimido. ¡Échale ganas!', file: 'emo_selected_3.mp3' }
  ],
  vote: [
    { text: 'Hora de votar. ¿Fue arte, drama o puro berrinche afinado? 🗳️', file: 'emo_vote_0.mp3' },
    { text: 'Califiquen con el corazón roto, pero con honestidad. 💔', file: 'emo_vote_1.mp3' },
    { text: 'Digan la verdad: ¿nos hizo llorar o solo nos dio pena ajena?', file: 'emo_vote_2.mp3' },
    { text: 'Voten sin piedad, como cuando tu ex te dejó por mensaje.', file: 'emo_vote_3.mp3' }
  ],
  blackout: [
    { text: 'Se fue la letra, como se fue esa persona. Sigue cantando. 🌑', file: 'emo_blackout_0.mp3' },
    { text: 'Sin pantalla, sin ayuda y sin estabilidad emocional. 🖤', file: 'emo_blackout_1.mp3' },
    { text: 'Te apagamos la luz porque ya estabas bastante oscuro por dentro.', file: 'emo_blackout_2.mp3' }
  ],
  idle: [
    { text: '¿Se van a apurar o sigo escribiendo en mi fotolog? 🖤', file: 'emo_idle_0.mp3' },
    { text: 'Tanto drama y ni siquiera han empezado. Qué decepción.', file: 'emo_idle_1.mp3' },
    { text: 'Si no empiezan pronto, voy a escuchar My Chemical Romance solo.', file: 'emo_idle_2.mp3' },
    { text: 'Tanta oscuridad en esta sala y nadie presiona Iniciar. 🦇', file: 'emo_idle_3.mp3' }
  ]
};
"""

# Find the start and end of the existing EMO_MODE_PHRASES
start_idx = content.find("const EMO_MODE_PHRASES = {")
if start_idx != -1:
    end_idx = content.find("};\n", start_idx) + 2
    if end_idx != -1:
        content = content[:start_idx] + emo_phrases_new + content[end_idx:]
    else:
        # Maybe it ends differently
        end_idx = content.find("};", start_idx) + 2
        content = content[:start_idx] + emo_phrases_new + content[end_idx:]
else:
    print("EMO_MODE_PHRASES not found, appending to file.")
    content += emo_phrases_new

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("constants.js updated with new emo phrases!")
