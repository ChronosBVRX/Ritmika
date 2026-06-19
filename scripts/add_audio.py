import re
import os

NEW_GENRE_BARKS = {
    'reggaeton': [
        ("¡Hasta Yandel se asustó con ese perreo! 😱", "genre_reggaeton_10.mp3"),
        ("¡Esa nota estuvo más abajo que el subsuelo, rey! ⬇️", "genre_reggaeton_11.mp3"),
        ("¡Le metiste más autotune que J Balvin en concierto! 🤖", "genre_reggaeton_12.mp3"),
        ("¡Con ese flow no pasas ni del casting de Venga la Alegría! 📺", "genre_reggaeton_13.mp3"),
        ("¡Te faltó calle, perro, pero sobró actitud! 🐶", "genre_reggaeton_14.mp3")
    ],
    'banda': [
        ("¡Julión Álvarez te mandó bloquear de WhatsApp! 🚫", "genre_banda_10.mp3"),
        ("¡Parece que estabas arreando vacas en vez de cantar! 🐄", "genre_banda_11.mp3"),
        ("¡Esa trompeta sonó a elefante constipado! 🐘", "genre_banda_12.mp3"),
        ("¡Ni con seis caguamas te sale bien esa rola! 🍻", "genre_banda_13.mp3"),
        ("¡Si fueras del Recodo, ya te habrían regresado al rancho! 🚜", "genre_banda_14.mp3")
    ],
    'ranchera': [
        ("¡Ese mariachi ya pidió asilo político en otro lado! 🏃", "genre_ranchera_10.mp3"),
        ("¡Hasta los agaves se secaron con ese falsete! 🌵", "genre_ranchera_11.mp3"),
        ("¡Le echaste más crema que a los tacos, pero sin sabor! 🌮", "genre_ranchera_12.mp3"),
        ("¡Don Chente desde el cielo te está mandando un rayo! ⚡", "genre_ranchera_13.mp3"),
        ("¡Se me rompió el jarrito de barro de puro dolor auditivo! 🏺", "genre_ranchera_14.mp3")
    ],
    'rock': [
        ("¡Ni Metallica en sus peores días sonaba tan destructivo! 💥", "genre_rock_10.mp3"),
        ("¡El único rock que haces es cuando te tropiezas con una piedra! 🪨", "genre_rock_11.mp3"),
        ("¡Rompiste la guitarra, el bajo, y mis tímpanos de paso! 🎸", "genre_rock_12.mp3"),
        ("¡Ese solo vocal sonó a frenazo de camión de basura! 🚛", "genre_rock_13.mp3"),
        ("¡Axl Rose te mandó saludos... y una orden de restricción! 📜", "genre_rock_14.mp3")
    ],
    'pop': [
        ("¡Más desafinado que corista de quinceañera! 👗", "genre_pop_10.mp3"),
        ("¡Esa coreografía estuvo chida, lástima que estamos calificando la voz! 💃", "genre_pop_11.mp3"),
        ("¡Hasta Timbiriche te hubiera sacado del grupo! 🎤", "genre_pop_12.mp3"),
        ("¡Cantaste tan fresa que me dio alergia musical! 🍓", "genre_pop_13.mp3"),
        ("¡Belinda ya se desmayó de escuchar eso, y no por el sapito! 🐸", "genre_pop_14.mp3")
    ],
    'cumbia': [
        ("¡Ese pasito tun tun te salió más bien pasito pum pum! 💥", "genre_cumbia_10.mp3"),
        ("¡Si esto fuera un sonidero, ya te hubieran desconectado la bocina! 🔌", "genre_cumbia_11.mp3"),
        ("¡Traes la cumbia en las venas, pero la circulación tapada! 🩸", "genre_cumbia_12.mp3"),
        ("¡Celso Piña estaría tocando el acordeón... para no oírte! 🪗", "genre_cumbia_13.mp3"),
        ("¡Qué cumbión tan mareador, me dio vértigo de lo mal que sonó! 😵", "genre_cumbia_14.mp3")
    ],
    'balada': [
        ("¡Lloré, pero porque me acordé que todavía faltan más por cantar! 😭", "genre_balada_10.mp3"),
        ("¡Ese drama no lo compra ni TV Azteca! 📺", "genre_balada_11.mp3"),
        ("¡Cristian Castro te manda sus alas para que vueles lejos del micro! 🕊️", "genre_balada_12.mp3"),
        ("¡Te dolió tanto la rola que hasta el aire te faltó, mijo! 😮‍💨", "genre_balada_13.mp3"),
        ("¡Pura cortavenas, pero de las que infectan! 🩹", "genre_balada_14.mp3")
    ],
    'electronica': [
        ("¡Ese sintetizador sonó como gato peleando en el techo! 🐈", "genre_electronica_10.mp3"),
        ("¡La rola era house pero nos dejaste a todos out! 🏠", "genre_electronica_11.mp3"),
        ("¡Ni Skrillex se atrevería a soltar ese ruido tan random! 🎛️", "genre_electronica_12.mp3"),
        ("¡Parecía que se te quedó trabado el teclado de la computadora! ⌨️", "genre_electronica_13.mp3"),
        ("¡Mucho punchis punchis, pero el talento andaba en el baño! 🚽", "genre_electronica_14.mp3")
    ],
    'default': [
        ("¡Ni Google Translate entiende lo que acabas de cantar! 🌐", "genre_default_10.mp3"),
        ("¡Qué valor, qué coraje, qué falta de talento! 👏", "genre_default_11.mp3"),
        ("¡Esto es un karaoke, no un concurso de gritos en el mercado! 🛒", "genre_default_12.mp3"),
        ("¡Me duelen los oídos, los ojos y la dignidad! 🙈", "genre_default_13.mp3"),
        ("¡Otra así y mejor desconecto el servidor! 🔌", "genre_default_14.mp3")
    ]
}

NEW_INTROS = [
    ("¡Pásale a lo barrido, que aquí no hay piedad! 🧹", "intro_10.mp3"),
    ("¡Agarra el micrófono como si fuera tu última caguama! 🍺", "intro_11.mp3"),
    ("¡Demuestra que esos años cantando en la regadera valieron la pena! 🚿", "intro_12.mp3"),
    ("¡El que sigue! Que no tiemblen las corvas. 🦵", "intro_13.mp3"),
    ("¡Prepárense para una obra maestra... o para el fin del mundo! 🌎", "intro_14.mp3")
]

NEW_VOTES = {
    100: [
        ("¡Pónganle una estatua a este compa en su barrio! 🗽", "vote_100_7.mp3"),
        ("¡Impecable! ¡Sublime! ¡Te quiero mucho! ❤️", "vote_100_8.mp3"),
        ("¡De aquí directo a llenar el Foro Sol! 🏟️", "vote_100_9.mp3")
    ],
    60: [
        ("¡Suficiente para aprobar la materia, pero sin honores! 🎓", "vote_60_7.mp3"),
        ("¡Cantaste como en martes: ni muy muy, ni tan tan! 🗓️", "vote_60_8.mp3"),
        ("¡Hubo fallas técnicas, pero la actitud te salvó de milagro! 🛠️", "vote_60_9.mp3")
    ],
    30: [
        ("¡De panzazo y rozando la tragedia, carnal! 🤕", "vote_30_7.mp3"),
        ("¡Traías el volumen al cien pero el talento en modo avión! ✈️", "vote_30_8.mp3"),
        ("¡Se agradece la participación, ahora siéntate por favor! 🪑", "vote_30_9.mp3")
    ],
    10: [
        ("¡Por favor, que alguien llame a control de animales! 🐕", "vote_10_7.mp3"),
        ("¡Mis respetos... por tener el valor de hacer el ridículo así! 🤡", "vote_10_8.mp3"),
        ("¡Ni con autotune divino se arregla ese desastre! 👼", "vote_10_9.mp3")
    ]
}

def remove_emoji(text):
    return re.sub(r'[^\w\s¡!¿?,.ÁÉÍÓÚáéíóúñÑ-]', '', text).strip()

def update_tv_html():
    path = r"C:\Users\Axel Rosete\Desktop\Ritmika\public\tv.html"
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Update GENRE_BARKS
    for genre, barks in NEW_GENRE_BARKS.items():
        # Find the end of the genre array
        pattern = rf'({genre}:\s*\[.*?)(?=\s*\]\,)'
        match = re.search(pattern, content, re.DOTALL)
        if match:
            new_elements = ",\n    ".join([f"{{ text: '{t}', file: '{f}' }}" for t, f in barks])
            replacement = match.group(1) + ",\n    " + new_elements
            content = content.replace(match.group(0), replacement)

    # Update AXOLO_SINGER_INTROS
    pattern = r'(const AXOLO_SINGER_INTROS = \[\s*.*?)(?=\s*\];)'
    match = re.search(pattern, content, re.DOTALL)
    if match:
        new_elements = ",\n  ".join([f"{{ text: '{t}', file: '{f}' }}" for t, f in NEW_INTROS])
        replacement = match.group(1) + ",\n  " + new_elements
        content = content.replace(match.group(0), replacement)

    # Update AXOLO_VOTE_REACTIONS
    for score, reactions in NEW_VOTES.items():
        pattern = rf'({score}:\s*\[.*?)(?=\s*\]\,)'
        match = re.search(pattern, content, re.DOTALL)
        if match:
            new_elements = ",\n    ".join([f"{{ text: '{t}', file: '{f}' }}" for t, f in reactions])
            replacement = match.group(1) + ",\n    " + new_elements
            content = content.replace(match.group(0), replacement)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

def update_generate_audio():
    path = r"C:\Users\Axel Rosete\Desktop\Ritmika\scripts\generate_all_audio.js"
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Add phrases
    new_js_lines = []
    
    for genre, barks in NEW_GENRE_BARKS.items():
        for t, file in barks:
            key = file.replace('.mp3', '')
            clean_text = remove_emoji(t)
            new_js_lines.append(f'  "{key}": "{clean_text}",')

    for t, file in NEW_INTROS:
        key = file.replace('.mp3', '')
        clean_text = remove_emoji(t)
        new_js_lines.append(f'  "{key}": "{clean_text}",')

    for score, reactions in NEW_VOTES.items():
        for t, file in reactions:
            key = file.replace('.mp3', '')
            clean_text = remove_emoji(t)
            new_js_lines.append(f'  "{key}": "{clean_text}",')

    new_js_str = "\n".join(new_js_lines)

    # Insert before the last closing brace of PHRASES
    pattern = r'(const PHRASES = \{.*?)(?=\s*\n\};)'
    match = re.search(pattern, content, re.DOTALL)
    if match:
        replacement = match.group(1) + ",\n\n  // ── NEW PROCEDURAL PHRASES ──\n" + new_js_str
        content = content.replace(match.group(0), replacement)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

update_tv_html()
update_generate_audio()
print("Updated successfully!")
