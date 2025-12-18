#!/usr/bin/env bash
# Setup script to add/replace an OpenAI proxy handler in a Next/Vercel project,
# optionally commit & push the change, and start vercel dev with a provided OPENAI_API_KEY.
#
# Usage:
#   1) Save this file as ./scripts/setup_openai_proxy.sh in your repo.
#   2) Make it executable: chmod +x ./scripts/setup_openai_proxy.sh
#   3) Run it from your repo root: ./scripts/setup_openai_proxy.sh
#
# Important:
#  - The script will NOT print your key to the console. It reads the key securely.
#  - It will back up any existing api/openai/[...slug].js to backups/.
#  - You must run this locally in a shell (do NOT paste your key into chat).
#  - If you choose to commit & push the file, the script will run `git commit` and `git push`.
#  - If you need to stop the process after it starts, focus the terminal where vercel dev runs and press Ctrl+C.
set -euo pipefail

PROXY_PATH="api/openai/[...slug].js"
BACKUP_DIR="backups"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
REPO_ROOT="$(pwd)"

function die() {
  echo "ERROR: $*" >&2
  exit 1
}

# Basic checks
if [ ! -d ".git" ]; then
  echo "Warning: it doesn't look like you're running this from a git repo root."
  echo "Proceeding, but commits/push will fail if git isn't initialized."
fi

command -v npx >/dev/null 2>&1 || {
  echo "npx not found. Install Node (which provides npx). On mac: brew install node"
  echo "Or install Node from https://nodejs.org/"
  read -p "Continue anyway (vercel dev will fail) ? [y/N] " cont && [[ "$cont" =~ ^[Yy]$ ]] || die "Aborted."
}

# Create backups dir
mkdir -p "$BACKUP_DIR"

# Back up existing file if present
if [ -f "$PROXY_PATH" ]; then
  cp "$PROXY_PATH" "$BACKUP_DIR/$(basename "$PROXY_PATH").$TIMESTAMP.bak"
  echo "Backed up existing $PROXY_PATH -> $BACKUP_DIR/$(basename "$PROXY_PATH").$TIMESTAMP.bak"
else
  echo "No existing $PROXY_PATH found. Will create a new file."
fi

# Write the proxy file
mkdir -p "$(dirname "$PROXY_PATH")"

cat > "$PROXY_PATH" <<'EOF'
// Simple, safe OpenAI proxy for demo/dev
// - Usage: POST /api/openai/threads -> proxies to https://api.openai.com/v1/threads
// - Keeps your OPENAI_API_KEY server-side (must be set in env)
// - Adds a 20s upstream timeout and basic logs to diagnose hangs
//
// IMPORTANT: do NOT log the API key. Keep keys in env vars only.

export default async function handler(req, res) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not set on server' });
  }

  const slug = req.query.slug || [];
  const upstreamPath = slug.join('/') || '';
  const upstreamUrl = `https://api.openai.com/v1/${upstreamPath}`;

  const allowed = ['POST', 'GET', 'PUT', 'DELETE'];
  if (!allowed.includes(req.method)) {
    res.setHeader('Allow', allowed.join(', '));
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // helpful debug log (does NOT include secrets)
  console.log(`[openai-proxy] ${req.method} ${upstreamPath} - incoming`);

  const headers = {
    Authorization: `Bearer ${OPENAI_API_KEY}`,
  };
  if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];

  let body = undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    try {
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    } catch (e) {
      body = '{}';
    }
  }

  const controller = new AbortController();
  const timeoutMs = 20000; // 20s
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const upstreamRes = await fetch(upstreamUrl, {
      method: req.method,
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const contentType = upstreamRes.headers.get('content-type') || 'application/json';
    const text = await upstreamRes.text();

    res.status(upstreamRes.status);
    res.setHeader('Content-Type', contentType);
    return res.send(text);
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      console.error('[openai-proxy] upstream timeout', upstreamPath);
      return res.status(504).json({ error: 'upstream timeout' });
    }
    console.error('[openai-proxy] error', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'proxy error', detail: err.message || String(err) });
  }
}
EOF

echo "Wrote $PROXY_PATH"

# Ask user whether to git add/commit/push
if command -v git >/dev/null 2>&1; then
  read -p "Do you want to git add & commit this change? [y/N] " do_commit
  if [[ "$do_commit" =~ ^[Yy]$ ]]; then
    git add "$PROXY_PATH"
    read -p "Commit message (default: Add OpenAI proxy handler): " commit_msg
    commit_msg=${commit_msg:-"Add OpenAI proxy handler (api/openai/[...slug].js)"}
    git commit -m "$commit_msg"
    read -p "Push commit to remote? [y/N] " do_push
    if [[ "$do_push" =~ ^[Yy]$ ]]; then
      git push
    else
      echo "Skipping git push."
    fi
  else
    echo "Skipping git commit."
  fi
else
  echo "git not found; skipping commit step."
fi

# Offer to kill any process on port 3000
if command -v lsof >/dev/null 2>&1; then
  PID_ON_3000="$(lsof -tiTCP:3000 -sTCP:LISTEN || true)"
  if [ -n "$PID_ON_3000" ]; then
    echo "Found process listening on port 3000: PID $PID_ON_3000"
    read -p "Kill this process? [y/N] " killp
    if [[ "$killp" =~ ^[Yy]$ ]]; then
      kill "$PID_ON_3000" || kill -9 "$PID_ON_3000" || true
      echo "Killed $PID_ON_3000"
    else
      echo "Leaving existing process running. You may need to stop it manually."
    fi
  fi
fi

# Obtain OPENAI_API_KEY: either from environment or prompt securely
if [ -n "${OPENAI_API_KEY:-}" ]; then
  echo "Found OPENAI_API_KEY in current environment; will use it to run vercel dev."
  KEY="${OPENAI_API_KEY}"
else
  echo "No OPENAI_API_KEY found in current environment."
  read -p "Do you want to enter one now to run vercel dev? [y/N] " use_key
  if [[ "$use_key" =~ ^[Yy]$ ]]; then
    # read key silently
    printf "Enter OPENAI_API_KEY (input hidden): "
    # shellcheck disable=SC2034
    read -r -s KEY
    printf "\n"
    if [ -z "$KEY" ]; then
      echo "No key entered. You can export OPENAI_API_KEY later and run vercel dev manually."
    fi
  else
    KEY=""
    echo "You can export OPENAI_API_KEY later and start vercel dev manually."
  fi
fi

# Ask to start vercel dev now (if npx present)
if command -v npx >/dev/null 2>&1; then
  read -p "Start 'vercel dev' now? (This will run in foreground, press Ctrl+C to stop) [y/N] " start_dev
  if [[ "$start_dev" =~ ^[Yy]$ ]]; then
    echo "Starting vercel dev. If prompted, follow the CLI auth/link prompts. Logs will appear in this terminal."
    if [ -n "${KEY:-}" ]; then
      # Start with inline key for this process only
      OPENAI_API_KEY="$KEY" npx vercel dev
    else
      # Use current env (if exported) or just run without key (will error).
      npx vercel dev
    fi
  else
    echo "Skipped starting vercel dev. To start it later with a key, run:"
    echo '  OPENAI_API_KEY="sk-..." npx vercel dev'
  fi
else
  echo "npx not found; cannot start vercel dev. Install Node or run vercel dev manually later."
fi

echo "Done. If you started vercel dev, watch the terminal for logs like:"
echo "  [openai-proxy] POST threads - incoming"