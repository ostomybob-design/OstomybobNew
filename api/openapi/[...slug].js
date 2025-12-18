// Simple, safe OpenAI proxy for demo/dev
// - Usage: POST /api/openai/threads   -> proxies to https://api.openai.com/v1/threads
// - Keeps your OPENAI_API_KEY server-side (must be set in env)
// - Adds a 20s upstream timeout and basic logs to diagnose hangs
//
// IMPORTANT: do NOT log the API key. Keep keys in env vars only.

export default async function handler(req, res) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not set on server' });
  }

  // Build upstream path from catch-all slug, e.g. req.query.slug = ['threads']
  const slug = req.query.slug || [];
  const upstreamPath = slug.join('/') || '';
  const upstreamUrl = `https://api.openai.com/v1/${upstreamPath}`;

  // Only allow safe methods for your use-case; adjust as needed
  const allowed = ['POST', 'GET', 'PUT', 'DELETE'];
  if (!allowed.includes(req.method)) {
    res.setHeader('Allow', allowed.join(', '));
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Do not log secrets; log only what helps debugging
  console.log(`[openai-proxy] ${req.method} ${upstreamPath} - incoming`);

  // Prepare headers for upstream; copy content-type if present
  const headers = {
    Authorization: `Bearer ${OPENAI_API_KEY}`,
  };
  if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];

  // Prepare body: forward raw JSON body if present
  let body = undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    // req.body might already be parsed by Next/Vercel; send JSON string
    try {
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    } catch (e) {
      // fallback
      body = '{}';
    }
  }

  // Timeout using AbortController to avoid infinite hangs
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

    // Copy status and content-type header and stream the response text
    const contentType = upstreamRes.headers.get('content-type') || 'application/json';
    const text = await upstreamRes.text();

    res.status(upstreamRes.status);
    res.setHeader('Content-Type', contentType);
    // Forward any other helpful headers if needed (CORS, etc.)
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