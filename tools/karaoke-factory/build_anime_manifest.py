#!/usr/bin/env python3
"""Construye el manifiesto del lote anime y mide disponibilidad de letras."""

import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

SONGS = [
    ("01", "Dragon Ball Z", "Cha-La Head-Cha-La", "dragon ball z chala head chala latino", "Mauren Mendo", "Cha-La Head-Cha-La"),
    ("02", "Los Caballeros del Zodiaco", "Pegasus Fantasy", "pegasus fantasy español latino mauren mendo", "Mauren Mendo", "Pegasus Fantasy"),
    ("03", "Sailor Moon", "Luz de Luna", "sailor moon opening 1 espanol latino", "Sailor Moon", "Luz de Luna"),
    ("04", "Pokémon", "Atrápalos Ya", "pokemon atrapalos ya opening espanol latino", "Pokemon", "Atrapalos Ya"),
    ("05", "Slam Dunk", "Quiero Gritar Te Amo", "slam dunk opening 1 latino adrian barba", "Adrian Barba", "Quiero Gritar Te Amo"),
    ("06", "Dragon Ball", "La Fantástica Aventura", "dragon ball la fantastica aventura latino", "Dragon Ball", "La Fantastica Aventura"),
    ("07", "Sakura Card Captor", "Yo Te Atrapo, Tú Me Atrapas", "sakura card captor opening 1 latino", "Sakura Card Captor", "Yo Te Atrapo Tu Me Atrapas"),
    ("08", "Ranma ½", "Fuego", "ranma 1/2 opening 1 latino", "Ranma 1/2", "Fuego"),
    ("09", "Sailor Moon R", "El Poder de Nuestro Amor", "el poder de nuestro amor sailor moon r latino", "Sailor Moon", "El Poder de Nuestro Amor"),
    ("10", "Supercampeones", "Capitán Tsubasa", "supercampeones opening 1 espanol latino", "Supercampeones", "Capitan Tsubasa"),
    ("11", "Dragon Ball", "Romance Te Puedo Dar", "romance te puedo dar ending latino", "Dragon Ball", "Romance Te Puedo Dar"),
    ("12", "Dragon Ball Z", "Ángeles Fuimos", "angeles fuimos dragon ball z adrian barba", "Adrian Barba", "Angeles Fuimos"),
    ("13", "Slam Dunk", "Solo un Corazón", "slam dunk ending 1 espanol latino", "Slam Dunk", "Solo un Corazon"),
    ("14", "Los Caballeros del Zodiaco", "Soldier Dream", "saint seiya soldier dream espanol latino", "Saint Seiya", "Soldier Dream"),
    ("15", "Ranma ½", "Ya Verás", "ranma 1/2 ya veras ending 1 latino", "Ranma 1/2", "Ya Veras"),
    ("16", "Detective Conan", "Detective Conan", "detective conan opening 1 espanol latino", "Detective Conan", "Detective Conan"),
    ("17", "Medabots", "Medabots", "medabots opening espanol latino", "Medabots", "Medabots"),
    ("18", "Digimon Adventure", "Butterfly", "butterfly digimon cesar franco latino", "Cesar Franco", "Butterfly"),
    ("19", "Dragon Ball GT", "Mi Corazón Encantado", "mi corazon encantado aaron montalvo", "Aaron Montalvo", "Mi Corazon Encantado"),
    ("20", "Inuyasha", "El Mundo He de Cambiar", "inuyasha el mundo he de cambiar nicolas silva", "Nicolas Silva", "El Mundo He de Cambiar"),
    ("21", "Shaman King", "Over Soul", "shaman king over soul gabriela vega latino", "Gabriela Vega", "Over Soul"),
    ("22", "Rurouni Kenshin", "Sobakasu (Pecas)", "samurai x sobakasu espanol latino", "Rurouni Kenshin", "Sobakasu"),
    ("23", "Digimon 02", "Target", "digimon 02 target cesar franco latino", "Cesar Franco", "Target"),
    ("24", "Yu Yu Hakusho", "Una Gota de Agua", "yu yu hakusho una gota de agua latino", "Yu Yu Hakusho", "Una Gota de Agua"),
    ("25", "Inuyasha", "Fukai Mori (Bosque Profundo)", "inuyasha fukai mori ending 2 latino", "Inuyasha", "Fukai Mori"),
    ("26", "Digimon Adventure", "Si Tú Lo Deseas (Brave Heart)", "digimon brave heart cesar franco espanol", "Cesar Franco", "Brave Heart"),
    ("27", "Corrector Yui", "Danza de la Suerte", "corrector yui opening espanol latino", "Corrector Yui", "Danza de la Suerte"),
    ("28", "Fullmetal Alchemist", "Melissa", "fullmetal alchemist melissa opening 1 latino", "Fullmetal Alchemist", "Melissa"),
    ("29", "Fullmetal Alchemist", "Ready Steady Go", "ready steady go fma opening 2 latino", "Fullmetal Alchemist", "Ready Steady Go"),
    ("30", "Digimon Tamers", "The Biggest Dreamer", "digimon tamers the biggest dreamer latino", "Digimon Tamers", "The Biggest Dreamer"),
    ("31", "Gundam Wing", "Just Communication", "gundam wing just communication opening latino", "Gundam Wing", "Just Communication"),
    ("32", "Hellsing", "A Mis Pies (Shine)", "hellsing ending shine espanol latino", "Hellsing", "Shine"),
    ("33", "Inuyasha", "My Will", "inuyasha my will ending 1 espanol latino", "Inuyasha", "My Will"),
    ("34", "Capitán Futuro", "Capitán Futuro", "capitan futuro tema de apertura original latino", "Capitan Futuro", "Capitan Futuro"),
    ("35", "Evangelion", "Cruel Angel's Thesis", "yoko takahashi cruel angel thesis romaji", "Yoko Takahashi", "Cruel Angel's Thesis"),
    ("36", "Naruto Shippuden", "Silhouette", "kana boon silhouette naruto romaji", "Kana-Boon", "Silhouette"),
    ("37", "Naruto Shippuden", "Blue Bird", "ikimonogakari blue bird naruto romaji", "Ikimonogakari", "Blue Bird"),
    ("38", "Death Note", "The World", "nightmare the world death note romaji", "Nightmare", "The World"),
    ("39", "Fullmetal Alchemist Brotherhood", "Again", "yui again fullmetal alchemist brotherhood romaji", "Yui", "Again"),
    ("40", "One Piece", "We Are!", "hiroshi kitadani we are one piece romaji", "Hiroshi Kitadani", "We Are!"),
    ("41", "Naruto", "GO!!!", "flow go naruto opening 4 romaji", "FLOW", "GO!!!"),
    ("42", "Naruto", "Haruka Kanata", "asian kung fu generation haruka kanata romaji", "Asian Kung-Fu Generation", "Haruka Kanata"),
    ("43", "Demon Slayer", "Gurenge", "lisa gurenge demon slayer romaji", "LiSA", "Gurenge"),
    ("44", "Attack on Titan", "Shinzou wo Sasageyo!", "linked horizon shinzou wo sasageyo romaji", "Linked Horizon", "Shinzou wo Sasageyo!"),
    ("45", "Jujutsu Kaisen", "Kaikai Kitan", "eve kaikai kitan jujutsu kaisen romaji", "Eve", "Kaikai Kitan"),
    ("46", "Tokyo Ghoul", "Unravel", "tk from ling tosite sigure unravel romaji", "TK from Ling Tosite Sigure", "Unravel"),
    ("47", "Oshi no Ko", "Idol", "yoasobi idol oshi no ko romaji", "YOASOBI", "Idol"),
    ("48", "Chainsaw Man", "Kick Back", "kenshi yonezu kick back chainsaw man romaji", "Kenshi Yonezu", "Kick Back"),
    ("49", "Attack on Titan", "The Rumbling", "sim the rumbling attack on titan lyrics", "SiM", "The Rumbling"),
    ("50", "Jujutsu Kaisen", "Specialz", "king gnu specialz jujutsu kaisen romaji", "King Gnu", "Specialz"),
]


def lrclib(artist, title):
    query = urllib.parse.urlencode({"artist_name": artist, "track_name": title})
    url = f"https://lrclib.net/api/search?{query}"
    request = urllib.request.Request(
        url, headers={"User-Agent": "Ritmika-Karaoke-Factory/1.0 (offline asset tool)"}
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception:
        return []


def main():
    tracks = []
    report = []
    for number, anime, title, search, artist, lookup_title in SONGS:
        items = lrclib(artist, lookup_title)
        synced = [item for item in items if item.get("syncedLyrics")]
        plain = [item for item in items if item.get("plainLyrics")]
        report.append((number, anime, title, len(synced), len(plain)))
        tracks.append({
            "id": f"anime-{number}",
            "artist": anime,
            "title": title,
            "search": search,
            "lookup": {"artist": artist, "title": lookup_title},
        })
        time.sleep(0.35)

    path = Path(__file__).with_name("songs-anime.json")
    path.write_text(
        json.dumps({"batch": "anime-01", "tracks": tracks}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"{'#':>3s} {'anime':28s} {'tema':34s} {'sync':>5s} {'plain':>5s}")
    for number, anime, title, n_sync, n_plain in report:
        mark = "OK" if n_sync else ("txt" if n_plain else "NO")
        print(f"{number:>3s} {anime[:28]:28s} {title[:34]:34s} {n_sync:5d} {n_plain:5d}  {mark}")

    ok = sum(1 for row in report if row[3])
    text = sum(1 for row in report if row[3] or row[4])
    print(f"\n{ok}/{len(report)} con letra sincronizada · {text}/{len(report)} con alguna letra")


if __name__ == "__main__":
    main()
