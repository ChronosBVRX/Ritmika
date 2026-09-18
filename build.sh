#!/usr/bin/env bash
# ============================================================
#  RÍTMIKA — Build Linux (equivalente a build.bat)
#  Verifica deps, hace npm install y deja Ritmika.sh listo
# ============================================================
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
echo ""
echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}   RITMIKA — BUILD LINUX${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""

echo "[1/3] Verificando Node.js..."
if ! command -v node >/dev/null 2>&1; then
  echo "  [ERROR] Node.js no encontrado. Instala LTS: https://nodejs.org"
  exit 1
fi
echo "  Node $(node -v)  npm $(npm -v)"

echo ""
echo "[2/3] Instalando dependencias..."
npm install

echo ""
echo "[3/3] Preparando ejecutable..."
chmod +x "$ROOT/Ritmika.sh"
if [[ -f "$ROOT/.env" ]]; then
  echo "  .env ya existe"
else
  echo "  Creando .env por defecto..."
  cat > "$ROOT/.env" << 'EOF'
PORT=3000
# R2_ACCESS_KEY_ID=
# R2_SECRET_ACCESS_KEY=
# R2_ENDPOINT=https://3bb6544fbc15f95620470c922b1a0dfe.r2.cloudflarestorage.com
# ADMIN_TOKEN=
# GITHUB_TOKEN=
EOF
fi

echo ""
echo -e "${GREEN}[OK] Build completo.${NC}"
echo "  Ejecuta: ./Ritmika.sh"
echo "  TV:      http://localhost:3000"
echo "  Móvil:   http://localhost:3000/join"
echo ""
echo "  Opciones:"
echo "    ./Ritmika.sh --help        Ayuda"
echo "    ./Ritmika.sh --no-browser  Solo servidor"
echo ""
