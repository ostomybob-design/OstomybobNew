#!/usr/bin/env bash
# Simple dev starter for ostomyBuddyWeb
# Place this in the project root (e.g. /Users/nomadjoe/ostomyBuddyWeb)
# Make executable: chmod +x dev-start.sh
# Run: ./dev-start.sh

set -u

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$PROJECT_ROOT/server"
INDEX_JS="$SERVER_DIR/index.js"
SERVER_LOG="$PROJECT_ROOT/server.log"
HTTP_LOG="$PROJECT_ROOT/http-server.log"

echo "Project root: $PROJECT_ROOT"
echo

# Helper: find PIDs listening on a TCP port
pids_for_port() {
  local port="$1"
  lsof -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true
}

# 1) Show processes on 3000/8080 and optionally kill them
P3000=$(pids_for_port 3000)
P8080=$(pids_for_port 8080)

if [ -n "$P3000" ] || [ -n "$P8080" ]; then
  echo "Found processes listening on ports:"
  [ -n "$P3000" ] && echo "  3000: $P3000"
  [ -n "$P8080" ] && echo "  8080: $P8080"
  read -r -p "Kill these processes? (y/N): " ans
  if [[ "$ans" =~ ^[Yy]$ ]]; then
    [ -n "$P3000" ] && kill $P3000 2>/dev/null || true
    [ -n "$P8080" ] && kill $P8080 2>/dev/null || true
    sleep 0.3
    echo "Killed (if permitted)."
  else
    echo "Leaving existing processes running (may conflict)."
  fi
else
  echo "No processes found on 3000 or 8080."
fi

# 2) Ensure server directory exists
if [ ! -d "$SERVER_DIR" ]; then
  echo "ERROR: server directory not found at $SERVER_DIR"
  exit 1
fi

# 3) Install server deps and cors
echo
echo "Installing server dependencies..."
cd "$SERVER_DIR"
npm install

# install cors if not present
if ! grep -qE "\"cors\"\\s*:" package.json 2>/dev/null && ! npm ls cors >/dev/null 2>&1; then
  echo "Installing cors..."
  npm install cors
else
  echo "cors already present or listed in package.json."
fi

# 4) Patch index.js to enable CORS if missing
if [ -f "$INDEX_JS" ]; then
  if grep -qE "require\\(['\"]cors['\"]\\)" "$INDEX_JS" || grep -qE "app\\.use\\(cors" "$INDEX_JS"; then
    echo "CORS already configured in index.js (skipping patch)."
  else
    echo "Patching $INDEX_JS to enable CORS (backup created)."
    cp "$INDEX_JS" "$INDEX_JS.bak"
    # add require at top
    awk 'NR==1{print "const cors = require('\''cors'\'');"} {print}' "$INDEX_JS" > "$INDEX_JS.tmp" && mv "$INDEX_JS.tmp" "$INDEX_JS"
    # insert app.use(cors()) after app creation, or append if not found
    if grep -qE "const\\s+app\\s*=\\s*express\\(|let\\s+app\\s*=\\s*express\\(|var\\s+app\\s*=\\s*express\\(" "$INDEX_JS"; then
      awk '
        { print $0 }
        !done && /(const|let|var)[[:space:]]+app[[:space:]]*=[[:space:]]*express[[:space:]]*\(/ {
          print "app.use(cors());"
          done=1
        }
      ' "$INDEX_JS" > "$INDEX_JS.tmp" && mv "$INDEX_JS.tmp" "$INDEX_JS"
    else
      echo "" >> "$INDEX_JS"
      echo "app.use(cors());" >> "$INDEX_JS"
    fi
    echo "Patched index.js (backup at $INDEX_JS.bak)."
  fi
else
  echo "Warning: $INDEX_JS not found — cannot auto-patch CORS."
fi

# 5) Start API server in background and log
echo
echo "Starting API server (node index.js)..."
cd "$SERVER_DIR"
nohup node index.js > "$SERVER_LOG" 2>&1 &
API_PID=$!
sleep 0.4
echo "API PID: $API_PID   (logs: $SERVER_LOG)"

# 6) Start static server in background and log
echo
echo "Starting static server (http-server) on port 8080..."
cd "$PROJECT_ROOT"
nohup npx http-server -p 8080 > "$HTTP_LOG" 2>&1 &
HTTP_PID=$!
sleep 0.4
echo "Static server PID: $HTTP_PID   (logs: $HTTP_LOG)"

# 7) Summary + quick commands
echo
echo "Done."
echo "  API:   http://localhost:3000    (PID: $API_PID)"
echo "  Front: http://127.0.0.1:8080    (PID: $HTTP_PID)"
echo
echo "View logs: tail -f $SERVER_LOG"
echo "Stop servers: kill $API_PID ; kill $HTTP_PID"