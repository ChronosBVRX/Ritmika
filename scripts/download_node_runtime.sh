#!/usr/bin/env bash
set -e
NODE_VERSION="${1:-22.18.0}"
DEST="$(cd "$(dirname "$0")/../runtime/node" 2>/dev/null && pwd || echo "$(dirname "$0")/../runtime/node")"
DEST="$(realpath -m "$DEST" 2>/dev/null || echo "$DEST")"
mkdir -p "$DEST"
echo "Descargando Node.js $NODE_VERSION para linux-x64..."
URL="https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.xz"
TMP="/tmp/node-v$NODE_VERSION-linux-x64.tar.xz"
curl -fsSL "$URL" -o "$TMP"
echo "Extrayendo a $DEST ..."
tar -xf "$TMP" -C /tmp
SRC="/tmp/node-v$NODE_VERSION-linux-x64/bin/node"
cp -f "$SRC" "$DEST/node"
chmod +x "$DEST/node"
# copiar npm
cp -rf "/tmp/node-v$NODE_VERSION-linux-x64/lib/node_modules" "$DEST/" 2>/dev/null || true
cp -f "/tmp/node-v$NODE_VERSION-linux-x64/bin/npm" "$DEST/npm" 2>/dev/null || true
cp -f "/tmp/node-v$NODE_VERSION-linux-x64/bin/npx" "$DEST/npx" 2>/dev/null || true
"$DEST/node" --version
rm -rf "/tmp/node-v$NODE_VERSION-linux-x64" "$TMP"
echo "OK"
