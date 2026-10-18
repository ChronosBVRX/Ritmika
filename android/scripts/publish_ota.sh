#!/usr/bin/env bash
#
# publica una nueva version del APK de Ritmika TV en el VPS y actualiza el
# manifiesto OTA (latest.json) que consulta UpdateManager.kt.
#
# Uso:
#   ./publish_ota.sh [patch|minor|major] ["notas de la version"]
#
# Ejemplos:
#   ./publish_ota.sh patch "Corrige audio del lobby"
#   ./publish_ota.sh minor "Modo Fiesta Emo en TV"
#
# Variables de entorno opcionales:
#   VPS_HOST (opc@159.54.146.146)   VPS_KEY (/tmp/opencode/oci_key_dec.pem)
#   PUBLIC_BASE (https://ritmika.duckdns.org/download)
#   REMOTE_DIR (/srv/ritmika-download)
#   GRADLE (/tmp/opencode/tools/gradle-8.11.1/bin/gradle)
#   JAVA_HOME (/usr/lib/jvm/java-17-openjdk-amd64)
#
set -euo pipefail

BUMP="${1:-patch}"
NOTES="${2:-}"

VPS_HOST="${VPS_HOST:-opc@159.54.146.146}"
VPS_KEY="${VPS_KEY:-/tmp/opencode/oci_key_dec.pem}"
PUBLIC_BASE="${PUBLIC_BASE:-https://ritmika.duckdns.org/download}"
REMOTE_DIR="${REMOTE_DIR:-/srv/ritmika-download}"
GRADLE="${GRADLE:-/tmp/opencode/tools/gradle-8.11.1/bin/gradle}"
export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-17-openjdk-amd64}"

SSH="ssh -i $VPS_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=15"
SCP="scp -i $VPS_KEY -o StrictHostKeyChecking=no"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

APK="app/build/outputs/apk/release/app-release.apk"
STABLE_NAME="ritmika-tv.apk"

echo "==> Bump de version ($BUMP)"
node - "$BUMP" <<'NODE'
const fs = require('fs');
const bump = process.argv[2];
const file = 'app/build.gradle.kts';
let src = fs.readFileSync(file, 'utf8');

const mCode = src.match(/versionCode\s*=\s*(\d+)/);
const mName = src.match(/versionName\s*=\s*"(\d+)\.(\d+)\.(\d+)"/);
if (!mCode || !mName) { console.error('No se pudo leer versionCode/versionName'); process.exit(1); }

let code = parseInt(mCode[1], 10) + 1;
let [maj, min, pat] = [ +mName[1], +mName[2], +mName[3] ];
if (bump === 'major') { maj++; min = 0; pat = 0; }
else if (bump === 'minor') { min++; pat = 0; }
else { pat++; }
const name = `${maj}.${min}.${pat}`;

src = src.replace(/versionCode\s*=\s*\d+/, `versionCode = ${code}`);
src = src.replace(/versionName\s*=\s*"\d+\.\d+\.\d+"/, `versionName = "${name}"`);
fs.writeFileSync(file, src);
console.log(`    versionCode=${code} versionName=${name}`);
fs.writeFileSync('.version.env', `VERSION_CODE=${code}\nVERSION_NAME=${name}\n`);
NODE

source .version.env
rm -f .version.env

echo "==> Build release (versionCode=$VERSION_CODE versionName=$VERSION_NAME)"
"$GRADLE" --no-daemon assembleRelease

if [ ! -f "$APK" ]; then
  echo "ERROR: no se genero el APK en $APK" >&2
  exit 1
fi

SHA256="$(sha256sum "$APK" | cut -d' ' -f1)"
SIZE="$(stat -c%s "$APK")"
echo "==> APK: $SIZE bytes sha256=$SHA256"

VERSIONED_NAME="ritmika-tv-${VERSION_NAME}.apk"
MANIFEST="/tmp/ritmika-latest.json"

cat > "$MANIFEST" <<EOF
{
  "versionCode": ${VERSION_CODE},
  "versionName": "${VERSION_NAME}",
  "url": "${PUBLIC_BASE}/${STABLE_NAME}",
  "sha256": "${SHA256}",
  "size": ${SIZE},
  "mandatory": false,
  "notes": "${NOTES}"
}
EOF

echo "==> Subiendo a $VPS_HOST:$REMOTE_DIR"
cp "$APK" "/tmp/${STABLE_NAME}"
$SCP "$APK" "$VPS_HOST:/tmp/${VERSIONED_NAME}"
$SCP "/tmp/${STABLE_NAME}" "$VPS_HOST:/tmp/${STABLE_NAME}"
$SCP "$MANIFEST" "$VPS_HOST:/tmp/ritmika-latest.json"

$SSH "$VPS_HOST" "
set -e
sudo install -m 644 -o opc -g opc /tmp/${STABLE_NAME} '${REMOTE_DIR}/${STABLE_NAME}'
sudo install -m 644 -o opc -g opc /tmp/${VERSIONED_NAME} '${REMOTE_DIR}/${VERSIONED_NAME}'
sudo install -m 644 -o root -g root /tmp/ritmika-latest.json '${REMOTE_DIR}/latest.json'
rm -f /tmp/${STABLE_NAME} /tmp/${VERSIONED_NAME} /tmp/ritmika-latest.json
ls -la '${REMOTE_DIR}'
"

echo "==> Verificando endpoints publicos"
curl -fsS "${PUBLIC_BASE}/latest.json"
echo
curl -fsS -o /dev/null -D- "${PUBLIC_BASE}/${STABLE_NAME}" | grep -iE "HTTP/|content-length|content-type"

echo "==> OK: ${PUBLIC_BASE}/${STABLE_NAME} (${VERSION_NAME}, ${VERSION_CODE})"
