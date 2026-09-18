#!/usr/bin/env bash
# ============================================================
#  RÍTMIKA — Launcher Linux (equivalente a Ritmika.exe)
#  Mata puerto 3000, inicia Node, abre TV en navegador
#  Uso: ./Ritmika.sh [--no-browser] [--port 3000]
# ============================================================
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
PORT="${PORT:-3000}"
NO_BROWSER=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-browser) NO_BROWSER=true; shift ;;
    --port) PORT="$2"; shift 2 ;;
    --help|-h)
      echo "Uso: ./Ritmika.sh [--no-browser] [--port 3000]"
      echo "  --no-browser  Solo inicia el servidor, no abre navegador"
      echo "  --port PORT   Puerto (default: 3000 o \$PORT del .env)"
      exit 0 ;;
    *) echo "Opción desconocida: $1 (usa --help)"; exit 1 ;;
  esac
done

# Leer PORT de .env si existe y no se pasó por flag
if [[ -f "$ROOT/.env" ]]; then
  ENV_PORT=$(grep -E '^PORT=' "$ROOT/.env" | cut -d= -f2 | tr -d '\r' | xargs 2>/dev/null || true)
  if [[ -n "$ENV_PORT" && "$PORT" == "3000" ]]; then
    # solo override si el usuario no pasó --port explícitamente
    PORT="$ENV_PORT"
  fi
fi

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[Ritmika]${NC} $*"; }
ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail()  { echo -e "${RED}[ERROR]${NC} $*"; }

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   🎤  RÍTMIKA — TÍO AXOLO LISTO (Linux)   ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════╝${NC}"
echo ""

# 1. Verificar Node.js
if ! command -v node >/dev/null 2>&1; then
  fail "No se encontró Node.js."
  echo "  Instala Node.js LTS desde https://nodejs.org"
  echo "  Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs"
  exit 1
fi
info "Node $(node -v)  npm $(npm -v)"

# 2. Instalar deps si faltan
if [[ ! -d "$ROOT/node_modules" ]]; then
  info "Instalando dependencias (npm install)..."
  npm install
fi

# 3. Verificar better-sqlite3 compilado
if ! node -e "require('better-sqlite3')" 2>/dev/null; then
  warn "Recompilando better-sqlite3..."
  npm rebuild better-sqlite3 2>&1 | tail -5
fi

# 4. Matar proceso previo en puerto
kill_port() {
  local port=$1
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" 2>/dev/null || true
  elif command -v lsof >/dev/null 2>&1; then
    local pids
    pids=$(lsof -ti :"$port" 2>/dev/null || true)
    if [[ -n "$pids" ]]; then
      echo "$pids" | xargs kill -9 2>/dev/null || true
    fi
  else
    pkill -f "node.*server/index.js" 2>/dev/null || true
  fi
  sleep 1
}
info "Liberando puerto $PORT..."
kill_port "$PORT"

# 5. Iniciar servidor en background
LOG="$ROOT/server.log"
info "Iniciando servidor en http://localhost:$PORT ..."
PORT="$PORT" nohup node server/index.js > "$LOG" 2>&1 &
SERVER_PID=$!
# trap para matar servidor al cerrar launcher
cleanup() {
  echo ""
  info "Cerrando servidor (PID $SERVER_PID)..."
  kill "$SERVER_PID" 2>/dev/null || true
  # matar hijos huérfanos en el puerto
  kill_port "$PORT" >/dev/null 2>&1 || true
  wait "$SERVER_PID" 2>/dev/null || true
  ok "Servidor detenido. Log en $LOG"
}
trap cleanup EXIT INT TERM

# 6. Esperar health check (max 15s)
info "Esperando a que el servidor responda..."
for i in $(seq 1 15); do
  if curl -sf "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
    ok "Servidor listo (intento $i/15)"
    curl -s "http://localhost:$PORT/api/health" | head -c 200; echo ""
    break
  fi
  # si el proceso murió, abortar
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    fail "El servidor murió. Revisa $LOG"
    cat "$LOG" | tail -30
    exit 1
  fi
  sleep 1
  if [[ $i -eq 15 ]]; then
    fail "Timeout esperando al servidor. Revisa $LOG"
    cat "$LOG" | tail -30
    exit 1
  fi
done

TV_URL="http://localhost:$PORT"
JOIN_URL="http://localhost:$PORT/join"
# Intentar detectar IP LAN para móviles
LAN_IP=""
if command -v hostname >/dev/null 2>&1; then
  LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || true)
fi
if [[ -n "$LAN_IP" && "$LAN_IP" != "127.0.0.1" ]]; then
  JOIN_URL="http://$LAN_IP:$PORT/join"
fi

echo ""
ok "TV:       $TV_URL"
ok "Móviles:  $JOIN_URL  (escanea QR en la TV o abre /join)"
ok "Log:      $LOG  (PID $SERVER_PID)"
echo ""

# 7. Abrir navegador
if [[ "$NO_BROWSER" == true ]]; then
  info "Modo --no-browser: servidor corriendo en foreground. Ctrl+C para salir."
  wait "$SERVER_PID"
else
  # detectar comando de apertura
  OPEN_CMD=""
  if command -v xdg-open >/dev/null 2>&1; then OPEN_CMD="xdg-open"
  elif command -v gio >/dev/null 2>&1; then OPEN_CMD="gio open"
  elif command -v sensible-browser >/dev/null 2>&1; then OPEN_CMD="sensible-browser"
  elif command -v open >/dev/null 2>&1; then OPEN_CMD="open"
  fi

  if [[ -n "$OPEN_CMD" ]]; then
    info "Abriendo TV en navegador ($OPEN_CMD)..."
    "$OPEN_CMD" "$TV_URL" >/dev/null 2>&1 &
  else
    warn "No se encontró xdg-open/gio/open. Abre manualmente: $TV_URL"
  fi
  echo ""
  info "Servidor corriendo. Presiona Ctrl+C para cerrar."
  info "Tip: abre $JOIN_URL en tu celular para probar como jugador."
  wait "$SERVER_PID"
fi
