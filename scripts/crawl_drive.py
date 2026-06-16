import urllib.request
import re
import json
import concurrent.futures
import time
import os
import html as html_parser

# Load all 287 folders
folders_file = os.path.join("scripts", "all_artist_folders.json")
if os.path.exists(folders_file):
    with open(folders_file, "r", encoding="utf-8") as f:
        folders = json.load(f)
else:
    print(f"Error: {folders_file} not found. Please run parse_all_embedded.py first.")
    exit(1)

# Genre mapping based on artist name
def get_genre(artist_name):
    artist_lower = artist_name.lower()
    
    # Rock / Alternativo / Ska
    rock_artists = [
        "rock", "mana", "aerosmith", "caifanes", "cafe tacuba", "guzman", "syntek", "zoe", 
        "enanitos", "hombres g", "soda stereo", "heroes del silencio", "molotov", 
        "panteon rococo", "bunbury", "charly garcia", "calamaro", "babasonicos", 
        "fobia", "jaguares", "maldita vecindad", "inspector", "la union", "el tri", 
        "slash", "guns", "bon jovi", "queen", "nirvana", "coldplay", "linkin", "red hot"
    ]
    if any(x in artist_lower for x in rock_artists):
        return "rock"
    
    # Cumbia / Salsa
    cumbia_artists = [
        "cumbia", "ilusion", "tropical", "barros", "vives", "angeles azules", "cañaveral", 
        "margarita", "selena", "kumbia", "dinamita", "sonora", "angeles de charly", "salsa", 
        "marc anthony", "celia cruz", "grupo niche", "gilberto santa rosa", "chichi peralta"
    ]
    if any(x in artist_lower for x in cumbia_artists):
        return "cumbia"
        
    # Banda / Norteño / Grupero / Tejano / Regional Mexicano
    banda_artists = [
        "banda", "romero", "alacranes", "carnaval", "cuisillos", "recodo", "trakalosa", 
        "recoditos", "ms", "musical", "rancho", "sagrada", "bronco", "pulido", "aventura", 
        "intocable", "pesado", "tigres", "tucanes", "duelo", "calibre", "arrolladora", 
        "jenni rivera", "espinosa paz", "fidel rueda", "gerardo ortiz", "julion alvarez", 
        "ariel camacho", "christian nodal", "firme", "frontera", "calibre 50", "danny lux", 
        "fuerza regida", "peso pluma", "junior h"
    ]
    if any(x in artist_lower for x in banda_artists):
        return "banda"
        
    # Ranchera / Mariachi / Bolero
    ranchera_artists = [
        "ranchera", "fernandez", "aguilar", "villareal", "mariachi", "pedro infante", 
        "jorge negrete", "javier solis", "jose alfredo", "rocio durcal", "juan gabriel", 
        "chavela vargas", "lucha villa"
    ]
    if any(x in artist_lower for x in ranchera_artists):
        return "ranchera"
        
    # Reggaeton / Urban / Hip-Hop
    reggaeton_artists = [
        "reggaeton", "daddy yankee", "fido", "khriz", "arcangel", "3ball", "akon", 
        "don omar", "wisin", "yandel", "j balvin", "bad bunny", "ozuna", "maluma", 
        "karol g", "anuel", "daddy", "farruko", "tito", "hector", "pitbull", "50 cent", 
        "eminem", "snoop", "drake", "rihanna", "usher", "jay z", "bizarrap", "quevedo",
        "rauw alejandro", "feid", "myke towers", "ryan castro"
    ]
    if any(x in artist_lower for x in reggaeton_artists):
        return "reggaeton"
        
    # Balada / Romantico
    balada_artists = [
        "balada", "ubago", "miguel", "gabriel", "manzanero", "fernando", "sanz", "luis miguel", 
        "adele", "acha", "chayanne", "emmanuel", "enrique iglesias", "camilo sesto", "jose jose", 
        "cristian castro", "sin bandera", "camila", "reik", "ha*ash", "yuridia", "yahir", 
        "yuri", "gloria trevi", "ricardo arjona", "maro", "pablo alboran", "la oreja de van gogh",
        "natalia Lafourcade", "julieta venegas", "morat", "camilo"
    ]
    if any(x in artist_lower for x in balada_artists):
        return "balada"
        
    # Pop / Default
    return "pop"

# Cleanup title logic
def clean_title(filename, artist_name):
    # Remove file extension
    base = filename
    for ext in [".mp4", ".avi", ".mkv", ".webm", ".mov", ".3gp"]:
        if base.lower().endswith(ext):
            base = base[:-len(ext)]
            
    # Remove artist name if present (case-insensitive)
    # E.g. "Caifanes - Afuera" -> "Afuera"
    pattern = re.compile(re.escape(artist_name), re.IGNORECASE)
    base = pattern.sub("", base)
    
    # Remove common karaoke tags
    remove_patterns = [
        r'\bkaraoke\b',
        r'\bKARAOKE\b',
        r'\bKaraoke\b',
        r'\bhd\b',
        r'\bHD\b',
        r'\bfull hd\b',
        r'\bFULL HD\b',
        r'\b1080p\b',
        r'\b1080\b',
        r'\b720p\b',
        r'\b720\b',
        r'\bcon voz\b',
        r'\bsin voz\b',
        r'\bvideo lyric\b',
        r'\blyrics\b',
        r'\blyric\b',
        r'\boficial\b',
        r'\bcustom\b'
    ]
    for pat in remove_patterns:
        base = re.sub(pat, "", base, flags=re.IGNORECASE)
        
    # Replace separators and clean up punctuation
    base = base.replace("_", " ")
    
    # Clean up parentheses or brackets
    base = re.sub(r'\[.*?\]', '', base)
    base = re.sub(r'\(.*?\)', '', base)
    
    # Replace multiple hyphens or spaces
    base = re.sub(r'-+', ' ', base)
    base = re.sub(r'\s+', ' ', base)
    
    # Strip leading/trailing spaces and dashes
    base = base.strip(" -_")
    
    # Capitalize first letter of each word (Title Case)
    base = base.title()
    
    # If the clean title became empty, fallback to the original filename without extension
    if not base:
        base = filename
        for ext in [".mp4", ".avi", ".mkv", ".webm", ".mov", ".3gp"]:
            if base.lower().endswith(ext):
                base = base[:-len(ext)]
                
    return base

# Function to fetch and parse a single folder
def fetch_folder_songs(folder):
    folder_id = folder["id"]
    artist_name = html_parser.unescape(folder["name"])  # Decode &amp; -> &
    url = f"https://drive.google.com/drive/folders/{folder_id}?usp=sharing"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
    }
    req = urllib.request.Request(url, headers=headers)
    
    try:
        with urllib.request.urlopen(req) as response:
            html = response.read().decode('utf-8')
    except Exception as e:
        # Silently fail or return empty on network transient errors
        return []
        
    # Extract file entries
    pattern = re.compile(r'\[\[null,"([a-zA-Z0-9_-]+)"\],null,null,null,"([^"]+)".*?\[\[\["([^"]+)"')
    matches = pattern.findall(html)
    
    songs = []
    for match in matches:
        file_id = match[0]
        mime_type = match[1]
        file_name = match[2]
        
        # Keep only video and common audio files
        if not ("video/" in mime_type or "audio/" in mime_type or "octet-stream" in mime_type or file_name.lower().endswith(('.mp4', '.mkv', '.avi', '.mp3', '.wav', '.webm'))):
            continue
            
        cleaned_title = clean_title(file_name, artist_name)
        genre = get_genre(artist_name)
        stream_url = f"https://drive.google.com/uc?export=download&id={file_id}"
        
        song_entry = {
            "id": f"gdrive_{file_id}",
            "title": cleaned_title,
            "artist": artist_name,
            "genre": genre,
            "url": stream_url,
            "duration": 180
        }
        songs.append(song_entry)
        
    return songs

# Main crawl function
def crawl():
    print(f"Starting crawl of all {len(folders)} Google Drive folders in parallel...")
    start_time = time.time()
    
    all_songs = []
    
    # Run in parallel with ThreadPoolExecutor (20 workers)
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        futures = {executor.submit(fetch_folder_songs, folder): folder for folder in folders}
        completed_count = 0
        for future in concurrent.futures.as_completed(futures):
            folder = futures[future]
            completed_count += 1
            try:
                songs = future.result()
                all_songs.extend(songs)
                if completed_count % 30 == 0 or completed_count == len(folders):
                    print(f"Progress: {completed_count}/{len(folders)} folders processed...")
            except Exception as exc:
                print(f"Folder {folder['name']} generated an exception: {exc}")
                
    # Save results to server/karaoke_db.json
    output_path = os.path.join("server", "karaoke_db.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_songs, f, indent=2, ensure_ascii=False)
        
    elapsed_time = time.time() - start_time
    print(f"\nCrawl completed! Found {len(all_songs)} total songs across {len(folders)} folders.")
    print(f"Saved to {output_path} in {elapsed_time:.2f} seconds.")

if __name__ == "__main__":
    crawl()
