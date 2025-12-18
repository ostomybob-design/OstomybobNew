// server/index.js
// Local posts/search server + OpenAI proxy
// Run with: node index.js  (after npm install)

// Existing local posts server code (keeps current functionality)
const express = require('express');
const path = require('path');
const fs = require('fs');

// Proxy-related deps
const fetch = require('node-fetch'); // v2
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Path to posts JSON (you will edit this file)
const DATA_PATH = path.join(__dirname, 'data', 'posts.json');

// Utility: load posts from disk (sync is OK for simple apps)
function loadPosts() {
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    const items = JSON.parse(raw);
    // normalize tags to string for easier matching/rendering
    return items.map(i => ({
      id: i.id || i.link || (i.title || '').slice(0, 24),
      title: i.title || '',
      tags: Array.isArray(i.tags) ? i.tags.join(', ') : (i.tags || ''),
      link: i.link || ''
    }));
  } catch (err) {
    console.error('Failed to load posts.json', err);
    return [];
  }
}

// Basic tokenized search: all tokens must appear in title, tags or link (case-insensitive)
function searchPosts(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];
  const tokens = q.split(/\s+/).filter(Boolean);
  const posts = loadPosts();
  return posts.filter(p => {
    const hay = `${p.title} ${p.tags} ${p.link}`.toLowerCase();
    return tokens.every(t => hay.includes(t));
  });
}

// Allow your local frontend origin (adjust as needed)
app.use(cors({ origin: ['http://127.0.0.1:5500', 'http://localhost:5500'] }));
app.use(express.json());

// Simple API endpoints (existing)
app.get('/api/posts', (req, res) => {
  const posts = loadPosts();
  res.json({ items: posts });
});

app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ items: [] });
  const items = searchPosts(q);
  res.json({ items });
});

// Optional: serve static files under /server/static for debug (not necessary in prod)
app.use('/server/static', express.static(path.join(__dirname, 'static')));

// Health check
app.get('/_health', (req, res) => res.send('ok'));

// -------- OpenAI proxy logic --------
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.warn("WARNING: OPENAI_API_KEY not set in environment. Set it before starting the server.");
}

// Helper to forward requests to OpenAI.
// targetPath is the path under /v1, e.g. '/v1/threads' or '/v1/threads/:id/messages'
async function forwardToOpenAI(req, res, targetPath) {
  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: "Server misconfigured: OPENAI_API_KEY not set" });
  }

  // Build URL and include any query params from the original request
  const url = new URL(`https://api.openai.com${targetPath}`);
  // append original query params (if any)
  Object.keys(req.query || {}).forEach(k => url.searchParams.append(k, req.query[k]));

  try {
    const fetchOptions = {
      method: req.method,
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      }
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      // req.body already parsed by express.json()
      fetchOptions.body = JSON.stringify(req.body || {});
    }

    const fetchRes = await fetch(url.toString(), fetchOptions);
    const text = await fetchRes.text();

    // Try parse JSON, otherwise return raw text
    try {
      const json = JSON.parse(text);
      res.status(fetchRes.status).json(json);
    } catch (e) {
      res.status(fetchRes.status).send(text);
    }
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(502).json({ error: "Bad gateway" });
  }
}

// Routes mirrored from the client usage
app.post('/api/openai/threads', (req, res) => forwardToOpenAI(req, res, '/v1/threads'));
app.post('/api/openai/threads/:threadId/messages', (req, res) => forwardToOpenAI(req, res, `/v1/threads/${req.params.threadId}/messages`));
app.post('/api/openai/threads/:threadId/runs', (req, res) => forwardToOpenAI(req, res, `/v1/threads/${req.params.threadId}/runs`));
app.get('/api/openai/threads/:threadId/runs/:runId', (req, res) => forwardToOpenAI(req, res, `/v1/threads/${req.params.threadId}/runs/${req.params.runId}`));
app.get('/api/openai/threads/:threadId/messages', (req, res) => forwardToOpenAI(req, res, `/v1/threads/${req.params.threadId}/messages`));

// Fallback: forward any other /api/openai/* paths to the matching /v1/* route
app.all('/api/openai/*', (req, res) => {
  const targetPath = req.path.replace(/^\/api\/openai/, '/v1');
  return forwardToOpenAI(req, res, targetPath);
});

// Start
app.listen(PORT, () => {
  console.log(`Local posts + OpenAI proxy server listening on http://localhost:${PORT}`);
  console.log(`GET /api/posts    - list all posts`);
  console.log(`GET /api/search?q=skin  - tokenized search`);
});