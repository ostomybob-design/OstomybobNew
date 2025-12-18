import fs from "fs/promises";
import path from "path";

/**
 * Simple CORS helper — adjust `allowedOrigin` for production.
 * - For local dev you can use '*' to allow all origins.
 * - If you need cookies/auth, set allowedOrigin to the exact origin (e.g. 'http://localhost:3000')
 *   and also set Access-Control-Allow-Credentials: true.
 */
const allowedOrigin = "*";

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With"
  );
  // If you need cookies/auth in cross-origin requests, uncomment:
  // res.setHeader("Access-Control-Allow-Credentials", "true");
}

export default async function handler(req, res) {
  try {
    // Always set CORS headers on every response
    setCorsHeaders(res);

    // Handle preflight
    if (req.method === "OPTIONS") {
      // No body for preflight; 204 is common
      return res.status(204).end();
    }

    if (req.method !== "GET" && req.method !== "POST") {
      res.setHeader("Allow", "GET, POST, OPTIONS");
      return res.status(405).json({ error: "Method not allowed" });
    }

    // Accept q via query (?q=...) or via POST JSON body { q: "..." }
    let q = "";
    if (req.method === "GET") {
      q = (req.query.q || "").toString().trim().toLowerCase();
    } else if (req.method === "POST") {
      // If body parser is enabled, req.body will be object; otherwise parse raw
      try {
        const body =
          req.body && typeof req.body === "object"
            ? req.body
            : req.body
            ? JSON.parse(req.body)
            : {};
        q = (body.q || "").toString().trim().toLowerCase();
      } catch (err) {
        q = "";
      }
    }

    const dataPath = path.join(process.cwd(), "server", "data", "posts.json");
    const raw = await fs.readFile(dataPath, "utf8");
    let posts = [];
    try {
      posts = JSON.parse(raw);
    } catch (err) {
      console.error("Failed to parse posts.json:", err);
      return res.status(500).json({ error: "Failed to parse posts.json" });
    }

    if (!q) {
      return res.json({ results: posts.slice(0, 20) });
    }

    const results = posts.filter((p) => {
      const title = (p.title || "").toString().toLowerCase();
      const body = (p.body || p.content || "").toString().toLowerCase();
      const tags =
        Array.isArray(p.tags) && p.tags.length ? p.tags.join(" ").toLowerCase() : "";
      return title.includes(q) || body.includes(q) || tags.includes(q);
    });

    return res.json({ results });
  } catch (err) {
    console.error("search handler error:", err);
    // Ensure CORS headers are present even on errors
    try {
      setCorsHeaders(res);
    } catch {}
    return res.status(500).json({ error: "internal server error", detail: String(err) });
  }
}