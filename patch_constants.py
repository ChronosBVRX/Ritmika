import sys

file_path = "public/js/tv/constants.js"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

emo_phrases = """
const EMO_MODE_PHRASES = {
  intro: [
    { text: '¡Bienvenidos a Fiesta Emo! Hoy no se canta, se sangra emocionalmente. 🖤', file: 'emo_intro_0.mp3' },
    { text: 'Delineador listo, corazón roto y garganta temblando. Esto es Rítmika Emo. 💔', file: 'emo_intro_1.mp3' },
    { text: 'No es una fase, es una competencia con trauma musical. 🖤🎤', file: 'emo_intro_2.mp3' }
  ],
  roulette: [
    { text: 'La ruleta va a elegir quién abre su diario frente a todos. 📓🖤', file: 'emo_roulette_0.mp3' },
    { text: 'Gira la rueda del dolor adolescente. A ver quién llora primero. 💔', file: 'emo_roulette_1.mp3' }
  ],
  selected: [
    { text: 'Te tocó. Sube al escenario y decepciona a tu ex con estilo. 🖤', file: 'emo_selected_0.mp3' },
    { text: 'El destino eligió tu sufrimiento. Canta como si fuera 2008. 💀', file: 'emo_selected_1.mp3' }
  ],
  vote: [
    { text: 'Hora de votar. ¿Fue arte, drama o puro berrinche afinado? 🗳️', file: 'emo_vote_0.mp3' },
    { text: 'Califiquen con el corazón roto, pero con honestidad. 💔', file: 'emo_vote_1.mp3' }
  ],
  blackout: [
    { text: 'Se fue la letra, como se fue esa persona. Sigue cantando. 🌑', file: 'emo_blackout_0.mp3' },
    { text: 'Sin pantalla, sin ayuda y sin estabilidad emocional. 🖤', file: 'emo_blackout_1.mp3' }
  ]
};
"""

if "EMO_MODE_PHRASES" not in content:
    content += emo_phrases

# Now I need to inject these phrases into the axoloSay logic, but in constants.js it just defines them.
# The actual logic for using them might be in ui.js or game.js, but let's just make sure they are defined here.
with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("constants.js updated!")
