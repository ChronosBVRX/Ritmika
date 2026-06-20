import json, re, time, hashlib, os, sys, urllib.request, urllib.parse, urllib.error

# ── CONFIG ──
R2_ENDPOINT = "https://3bb6544fbc15f95620470c922b1a0dfe.r2.cloudflarestorage.com"
R2_ACCESS_KEY = "32b39cc882fa5587907b4b0062f27567"
R2_SECRET_KEY = "6f89917594e73c6dc9acef60c7238f7b61e3535fd656c453dba2931a00f4d6f4"
R2_BUCKET = "ritmika"
CDN_BASE = "https://media.pixelhub.party"
OLD_DB_PATH = "server/karaoke_db.json"
OUTPUT_PATH = "server/r2_db.json"
MAPPING_LOG = "server/deezer_audit.json"
SUMMARY_PATH = "server/build_summary.json"

# Root genres (user's existing ones)
ROOT_GENRES = ["pop", "reggaeton", "rock", "balada", "banda", "ranchera", "cumbia", "electronica"]

# Deezer genre_id -> our root genre
DEEZER_GENRE_MAP = {
    132: "pop", 116: "pop", 113: "pop", 165: "balada", 85: "rock",
    122: "reggaeton", 152: "rock", 186: "balada", 106: "electronica",
    466: "pop", 144: "reggaeton", 129: "balada", 84: "banda",
    65: "banda", 67: "cumbia", 98: "balada", 464: "rock",
    173: "pop", 169: "pop", 153: "rock", 71: "cumbia",
    95: "pop", 197: "pop", 2: "pop", 16: "pop", 75: "pop", 81: "pop",
    0: "pop"  # default/unknown -> pop
}

# ── HELPERS ──
def normalize(s):
    if not s: return ""
    s = s.lower()
    s = re.sub(r'[\(\[].*?[\)\]]', '', s)
    s = re.sub(r'\b(in the style of|karaoke|version|instrumental|con letra|letra|original|completo|hd|demo|cover|audio|video|lyrics|no lead vocal|with lyrics|radio version|official|full|hq|avi|mpg|wmv|flv)\b.*', '', s)
    s = re.sub(r'\b(low)\b', '', s, flags=re.IGNORECASE)
    s = re.sub(r'[^a-záéíóúüña-z0-9\s]', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s

def parse_filename(filename):
    name = filename.rsplit('.', 1)[0]
    parts = name.split(' - ', 1)
    if len(parts) == 2:
        artist = parts[0].strip()
        title = parts[1].strip()
        # Clean up common suffixes from artist field
        if artist.lower().endswith(' low'):
            artist = artist[:-4]
        if artist.lower().startswith('multi - '):
            artist = artist[8:]
    else:
        artist = "Unknown"
        title = name.strip()
    return artist.strip(), title.strip()

def make_song_id(artist, title):
    import hashlib
    raw = f"{artist}||{title}".encode('utf-8')
    return "r2_" + hashlib.md5(raw).hexdigest()[:12]

# ── STEP 1: List R2 files ──
print("=" * 60)
print("STEP 1: Listing R2 bucket...")
import boto3
r2 = boto3.client("s3",
    endpoint_url=R2_ENDPOINT,
    aws_access_key_id=R2_ACCESS_KEY,
    aws_secret_access_key=R2_SECRET_KEY,
    region_name="auto")
r2_files = []
for page in r2.get_paginator("list_objects_v2").paginate(Bucket=R2_BUCKET):
    if "Contents" in page:
        for obj in page["Contents"]:
            key = obj["Key"]
            if key.endswith('.mp4'):
                r2_files.append(key)
print(f"  Found {len(r2_files)} MP4 files")

# ── STEP 2: Parse filenames ──
print("\nSTEP 2: Parsing filenames...")
parsed = []
for f in r2_files:
    artist, title = parse_filename(f)
    nartist = normalize(artist)
    ntitle = normalize(title)
    url = f"{CDN_BASE}/{urllib.parse.quote(f)}"
    sid = make_song_id(artist, title)
    parsed.append({"id": sid, "title": title, "artist": artist,
        "nartist": nartist, "ntitle": ntitle, "url": url, "filename": f})
print(f"  Parsed {len(parsed)} songs")

# ── STEP 3: Load old DB and build indexes ──
print("\nSTEP 3: Loading old DB...")
old_db = json.load(open(OLD_DB_PATH, 'r', encoding='utf-8'))
print(f"  Loaded {len(old_db)} songs, {len(set(s['artist'].lower().strip() for s in old_db))} unique artists")

# Index 1: by normalized artist+title (exact match)
exact_idx = {}
for s in old_db:
    key = normalize(s['artist']) + "|||" + normalize(s['title'])
    exact_idx[key] = s['genre']

# Index 2: by normalized artist -> list of (genre, count)
from collections import Counter
artist_genre = {}
for s in old_db:
    a = normalize(s['artist'])
    if a not in artist_genre:
        artist_genre[a] = Counter()
    artist_genre[a][s['genre']] += 1

# ── STEP 4: Cross-reference ──
print("\nSTEP 4: Cross-referencing...")
matched_exact = 0
matched_artist = 0

for song in parsed:
    key = song['nartist'] + "|||" + song['ntitle']
    if key in exact_idx:
        song['genre'] = exact_idx[key]
        song['genre_source'] = 'exact_match'
        matched_exact += 1
        continue
    # Try partial title match within same artist
    found = False
    for s in old_db:
        if normalize(s['artist']) == song['nartist']:
            old_title = normalize(s['title'])
            if (old_title in song['ntitle'] or song['ntitle'] in old_title):
                song['genre'] = s['genre']
                song['genre_source'] = 'partial_match'
                matched_exact += 1
                found = True
                break
    if found:
        continue
    # Fallback: artist-level genre
    if song['nartist'] in artist_genre:
        most_common = artist_genre[song['nartist']].most_common(1)[0][0]
        song['genre'] = most_common
        song['genre_source'] = 'artist_match'
        matched_artist += 1
    else:
        song['genre'] = None
        song['genre_source'] = None

unknown_artists = set(s['nartist'] for s in parsed if s['genre'] is None)
print(f"  Exact/partial matches: {matched_exact}")
print(f"  Artist-level matches: {matched_artist}")
print(f"  Unknown (need Deezer): {len([s for s in parsed if s['genre'] is None])}")
print(f"  Unknown unique artists: {len(unknown_artists)}")

# ── STEP 5: Deezer API for unknown artists ──
print("\nSTEP 5: Deezer API lookup for new artists...")
unknown_songs = [s for s in parsed if s['genre'] is None]
# Group by artist to minimize calls
from collections import defaultdict
artist_songs = defaultdict(list)
for s in unknown_songs:
    artist_songs[s['nartist']].append(s)

# Cache: artist -> genre
deezer_cache = {}
deezer_log = {}
queried = 0
found_genre = 0

for nartist, songs in artist_songs.items():
    original_artist = songs[0]['artist']  # Use original casing
    genre = None
    source_info = None
    
    # Try Deezer search for this artist
    try:
        search_url = f"https://api.deezer.com/search?q=artist:\"{urllib.parse.quote(original_artist)}\"&limit=3&order=RANKING"
        req = urllib.request.Request(search_url, headers={"User-Agent": "Mozilla/5.0"})
        resp = urllib.request.urlopen(req, timeout=10)
        data = json.loads(resp.read())
        
        if data and data.get('data') and len(data['data']) > 0:
            # Get album from first track to determine genre
            track = data['data'][0]
            album_id = track.get('album', {}).get('id')
            if album_id:
                album_url = f"https://api.deezer.com/album/{album_id}"
                req2 = urllib.request.Request(album_url, headers={"User-Agent": "Mozilla/5.0"})
                resp2 = urllib.request.urlopen(req2, timeout=10)
                album_data = json.loads(resp2.read())
                deezer_genre_id = album_data.get('genre_id', 0)
                genre = DEEZER_GENRE_MAP.get(deezer_genre_id, 'pop')
                source_info = {'deezer_genre_id': deezer_genre_id, 'album': album_data.get('title')}
        
        queried += 1
        if queried % 10 == 0:
            print(f"  Queried {queried}/{len(artist_songs)} artists...")
    except Exception as e:
        print(f"  Error on '{original_artist}': {e}")
    
    if genre:
        deezer_cache[nartist] = genre
        found_genre += 1
    else:
        deezer_cache[nartist] = 'pop'  # default fallback
    
    deezer_log[nartist] = {
        'artist': original_artist,
        'found_genre': genre or 'pop',
        'source': source_info
    }
    
    # Apply to all songs by this artist
    for s in songs:
        s['genre'] = deezer_cache.get(nartist, 'pop')
        s['genre_source'] = 'deezer' if genre else 'default_pop'
    
    time.sleep(0.1)  # 100ms between artist lookups

print(f"  Artists queried: {queried}")
print(f"  Found genre for: {found_genre}/{len(artist_songs)}")
print(f"  Defaulted to pop: {len(artist_songs) - found_genre}")

# ── STEP 6: Stats ──
print("\nSTEP 6: Genre distribution:")
genre_counts = {}
source_counts = {}
for s in parsed:
    g = s.get('genre', 'unknown')
    genre_counts[g] = genre_counts.get(g, 0) + 1
    src = s.get('genre_source', 'unknown')
    source_counts[src] = source_counts.get(src, 0) + 1

for g in sorted(genre_counts, key=lambda x: -genre_counts[x]):
    print(f"  {g}: {genre_counts[g]}")
print("\nSource distribution:")
for s in sorted(source_counts, key=lambda x: -source_counts[x]):
    print(f"  {s}: {source_counts[s]}")

# ── STEP 7: Write output ──
print("\nSTEP 7: Writing files...")
output = []
for s in parsed:
    output.append({
        "id": s['id'],
        "title": s['title'],
        "artist": s['artist'],
        "genre": s['genre'],
        "url": s['url'],
        "duration": 180
    })

with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)
print(f"  {OUTPUT_PATH}: {len(output)} songs")

with open(MAPPING_LOG, 'w', encoding='utf-8') as f:
    json.dump(deezer_log, f, ensure_ascii=False, indent=2)
print(f"  {MAPPING_LOG}: {len(deezer_log)} artists logged")

summary = {
    "total_songs": len(output),
    "r2_files": len(r2_files),
    "matched_exact": matched_exact,
    "matched_artist": matched_artist,
    "deezer_artists": queried,
    "defaulted_pop": len(artist_songs) - found_genre,
    "genres": genre_counts,
    "sources": source_counts
}
with open(SUMMARY_PATH, 'w', encoding='utf-8') as f:
    json.dump(summary, f, ensure_ascii=False, indent=2)
print(f"  {SUMMARY_PATH}")

print("\n✅ DONE!")
